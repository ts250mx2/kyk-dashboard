import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { forecastSeasonalMA, HistoryPoint, ForecastPoint } from '@/lib/forecast/seasonal-moving-average';
import { getHolidaysInRange } from '@/lib/forecast/mx-holidays';
import { computeHolidayBoosts } from '@/lib/forecast/holiday-adjust';

const DAY_MS = 24 * 60 * 60 * 1000;

const toISO = (d: Date | string) => {
    if (d instanceof Date) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }
    return String(d).split('T')[0];
};

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const storeIds: number[] = Array.isArray(body.storeIds) ? body.storeIds : [];
        const horizonDays: number = Math.max(1, Math.min(180, Number(body.horizonDays) || 30));
        const historyDays: number = Math.max(60, Math.min(540, Number(body.historyDays) || 120));
        const includeLastYear: boolean = Boolean(body.includeLastYear);

        const today = new Date();
        const rawStart = new Date(today.getTime() - historyDays * DAY_MS);
        const startDate = new Date(rawStart.getFullYear(), rawStart.getMonth(), 1);
        const startStr = `'${toISO(startDate)}'`;
        const endStr = `'${toISO(today)} 23:59:59'`;

        let whereStore = '';
        if (storeIds.length > 0) {
            const safeIds = storeIds.map(id => parseInt(String(id), 10)).filter(n => Number.isFinite(n));
            if (safeIds.length > 0) {
                whereStore = ` AND IdTienda IN (${safeIds.join(',')})`;
            }
        }

        const sql = `
            SELECT
                CAST([Fecha Venta] AS DATE) AS Fecha,
                IdTienda,
                Tienda,
                SUM(Total) AS Total
            FROM Ventas
            WHERE [Fecha Venta] >= ${startStr} AND [Fecha Venta] <= ${endStr}
            ${whereStore}
            GROUP BY CAST([Fecha Venta] AS DATE), IdTienda, Tienda
            ORDER BY Fecha ASC
        `;

        const rows = await query(sql) as Array<{
            Fecha: Date | string;
            IdTienda: number;
            Tienda: string;
            Total: number;
        }>;

        const storeNamesById = new Map<number, string>();
        for (const r of rows) {
            if (r.IdTienda) storeNamesById.set(r.IdTienda, r.Tienda);
        }
        const storeIdsActive = Array.from(storeNamesById.keys());

        const totalsByDate = new Map<string, number>();
        const totalsByDateStore = new Map<string, Map<number, number>>();

        for (const r of rows) {
            const fecha = toISO(r.Fecha);
            const total = Number(r.Total || 0);
            totalsByDate.set(fecha, (totalsByDate.get(fecha) || 0) + total);

            let dayMap = totalsByDateStore.get(fecha);
            if (!dayMap) {
                dayMap = new Map<number, number>();
                totalsByDateStore.set(fecha, dayMap);
            }
            dayMap.set(r.IdTienda, (dayMap.get(r.IdTienda) || 0) + total);
        }

        const history: HistoryPoint[] = Array.from(totalsByDate.entries())
            .map(([fecha, total]) => ({ fecha, total }))
            .sort((a, b) => a.fecha.localeCompare(b.fecha));

        // Forecast horizon dates for holiday boost computation. The forecast
        // starts at history's last date + 1 day (same convention as forecastSeasonalMA).
        const lastHistFecha = history.length > 0 ? history[history.length - 1].fecha : toISO(today);
        const lastHistDate = new Date(`${lastHistFecha}T00:00:00`);
        const forecastStartStr = toISO(new Date(lastHistDate.getTime() + DAY_MS));
        const forecastEndStr = toISO(new Date(lastHistDate.getTime() + horizonDays * DAY_MS));

        const totalBoosts = computeHolidayBoosts(history, forecastStartStr, forecastEndStr);
        const result = forecastSeasonalMA(history, horizonDays, totalBoosts);

        // Per-store history + forecast (boosts computed from each store's own history)
        const historyByStore: Record<number, HistoryPoint[]> = {};
        const forecastByStore: Record<number, ForecastPoint[]> = {};

        for (const storeId of storeIdsActive) {
            const storeHistory: HistoryPoint[] = [];
            for (const [fecha] of Array.from(totalsByDate.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
                const dayMap = totalsByDateStore.get(fecha);
                const total = dayMap?.get(storeId) || 0;
                storeHistory.push({ fecha, total });
            }
            historyByStore[storeId] = storeHistory;
            const storeBoosts = computeHolidayBoosts(storeHistory, forecastStartStr, forecastEndStr);
            forecastByStore[storeId] = forecastSeasonalMA(storeHistory, horizonDays, storeBoosts).forecast;
        }

        // Last year same range (history start..forecast end, shifted -365 days)
        let lastYear: HistoryPoint[] | null = null;
        if (includeLastYear) {
            const lyEnd = new Date(today.getTime() + horizonDays * DAY_MS - 365 * DAY_MS);
            const lyStart = new Date(startDate.getTime() - 365 * DAY_MS);
            const lySql = `
                SELECT
                    CAST([Fecha Venta] AS DATE) AS Fecha,
                    SUM(Total) AS Total
                FROM Ventas
                WHERE [Fecha Venta] >= '${toISO(lyStart)}' AND [Fecha Venta] <= '${toISO(lyEnd)} 23:59:59'
                ${whereStore}
                GROUP BY CAST([Fecha Venta] AS DATE)
                ORDER BY Fecha ASC
            `;
            const lyRows = await query(lySql) as Array<{ Fecha: Date | string; Total: number }>;
            lastYear = lyRows.map(r => {
                const orig = new Date(`${toISO(r.Fecha)}T00:00:00`);
                const shifted = new Date(orig.getTime() + 365 * DAY_MS);
                return { fecha: toISO(shifted), total: Number(r.Total || 0) };
            });
        }

        const totalForecast = result.forecast.reduce((a, b) => a + b.predicted, 0);
        const sameLengthHistorySum = history.slice(-horizonDays).reduce((a, b) => a + b.total, 0);
        const projectedVsHistoryPct = sameLengthHistorySum > 0
            ? (totalForecast - sameLengthHistorySum) / sameLengthHistorySum
            : 0;

        const forecastEnd = result.forecast.length > 0
            ? result.forecast[result.forecast.length - 1].fecha
            : toISO(today);
        const holidaysRaw = getHolidaysInRange(toISO(startDate), forecastEnd);
        const holidays = holidaysRaw.map(h => {
            const boost = totalBoosts.get(h.fecha);
            return boost
                ? { ...h, multiplier: boost.multiplier, sourceFecha: boost.sourceFecha }
                : h;
        });

        let metaProjections: MetaProjection[] = [];
        try {
            metaProjections = await computeMetaProjections({
                lastHistFecha,
                horizonDays,
                userSelectedStoreIds: storeIds,
                forecastByStore,
            });
        } catch (metaErr) {
            console.error('Meta projections failed (non-fatal):', metaErr);
        }

        return NextResponse.json({
            history,
            forecast: result.forecast,
            historyByStore,
            forecastByStore,
            lastYear,
            holidays,
            backtest: result.backtest,
            metaProjections,
            metrics: {
                trend: result.trend,
                confidence: result.confidence,
                mape: result.mape,
                totalForecast,
                sameLengthHistorySum,
                projectedVsHistoryPct,
                horizonDays,
                historyDays,
                stores: Array.from(storeNamesById.entries()).map(([id, name]) => ({ id, name })),
            },
        });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Forecast error';
        console.error('Forecast API error:', error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

type MetaProjection = {
    idMeta: number;
    fechaInicio: string;
    fechaFin: string;
    daysElapsed: number;
    daysRemaining: number;
    storesIncluded: number;
    storesTotal: number;
    effectiveStoreIds: number[];
    target: number;
    actualToDate: number;
    projectedRemaining: number;
    projectedTotal: number;
    percentExpected: number;
    percentActual: number;
    hasConcepts: boolean;
    extrapolatedDays: number;
    note?: string;
};

async function computeMetaProjections(args: {
    lastHistFecha: string;
    horizonDays: number;
    userSelectedStoreIds: number[];
    forecastByStore: Record<number, ForecastPoint[]>;
}): Promise<MetaProjection[]> {
    const { lastHistFecha, horizonDays, userSelectedStoreIds, forecastByStore } = args;
    const lastHist = new Date(`${lastHistFecha}T00:00:00`);
    const forecastEnd = new Date(lastHist.getTime() + horizonDays * DAY_MS);

    const metasRaw = await query(
        `SELECT IdMeta, FechaInicio, FechaFin
         FROM tblMetas
         WHERE Status = 0
           AND FechaInicio <= ?
           AND FechaFin >= ?
         ORDER BY FechaAct DESC`,
        [lastHistFecha, lastHistFecha]
    ) as Array<{ IdMeta: number; FechaInicio: Date; FechaFin: Date }>;

    const userStoreSet = new Set(userSelectedStoreIds);
    const out: MetaProjection[] = [];

    for (const m of metasRaw) {
        const fechaInicio = toISO(m.FechaInicio);
        const fechaFin = toISO(m.FechaFin);

        const conceptCount = await query(
            `SELECT COUNT(*) AS Cnt FROM tblMetasConceptos WHERE IdMeta = ?`,
            [m.IdMeta]
        ) as Array<{ Cnt: number }>;
        const hasConcepts = (conceptCount[0]?.Cnt || 0) > 0;

        const storeTargets = await query(
            `SELECT IdTienda, MontoMeta FROM tblMetasTiendas WHERE IdMeta = ?`,
            [m.IdMeta]
        ) as Array<{ IdTienda: number; MontoMeta: number }>;
        const metaStoreIds = storeTargets.map(s => s.IdTienda);

        const effectiveStoreIds = userSelectedStoreIds.length === 0
            ? metaStoreIds
            : metaStoreIds.filter(id => userStoreSet.has(id));

        if (effectiveStoreIds.length === 0) continue;

        const effectiveSet = new Set(effectiveStoreIds);
        const target = storeTargets
            .filter(t => effectiveSet.has(t.IdTienda))
            .reduce((a, b) => a + (Number(b.MontoMeta) || 0), 0);

        const fechaInicioDate = new Date(`${fechaInicio}T00:00:00`);
        const fechaFinDate = new Date(`${fechaFin}T00:00:00`);
        const daysElapsed = Math.round((lastHist.getTime() - fechaInicioDate.getTime()) / DAY_MS) + 1;
        const daysRemaining = Math.max(0, Math.round((fechaFinDate.getTime() - lastHist.getTime()) / DAY_MS));

        if (hasConcepts) {
            out.push({
                idMeta: m.IdMeta,
                fechaInicio,
                fechaFin,
                daysElapsed,
                daysRemaining,
                storesIncluded: effectiveStoreIds.length,
                storesTotal: metaStoreIds.length,
                effectiveStoreIds,
                target,
                actualToDate: 0,
                projectedRemaining: 0,
                projectedTotal: 0,
                percentExpected: 0,
                percentActual: 0,
                hasConcepts: true,
                extrapolatedDays: 0,
                note: 'Esta meta filtra por departamento/familia/SKU — la proyección de venta total no aplica.',
            });
            continue;
        }

        const actualsRows = await query(`
            SELECT SUM(Total) AS Actual
            FROM Ventas
            WHERE [Fecha Venta] >= '${fechaInicio}'
              AND [Fecha Venta] <= '${lastHistFecha} 23:59:59'
              AND IdTienda IN (${effectiveStoreIds.join(',')})
        `) as Array<{ Actual: number | null }>;
        const actualToDate = Number(actualsRows[0]?.Actual || 0);

        // Sum forecast within [forecastStart, FechaFin]
        let forecastWithinHorizon = 0;
        for (const sid of effectiveStoreIds) {
            const arr = forecastByStore[sid] || [];
            for (const p of arr) {
                if (p.fecha <= fechaFin) forecastWithinHorizon += p.predicted;
            }
        }

        // Extrapolate if meta extends beyond forecast horizon
        let extrapolation = 0;
        let extrapolatedDays = 0;
        if (fechaFinDate > forecastEnd) {
            let totalEff = 0;
            let dayCount = 0;
            for (const sid of effectiveStoreIds) {
                const arr = forecastByStore[sid] || [];
                for (const p of arr) {
                    totalEff += p.predicted;
                    dayCount++;
                }
            }
            const horizon = effectiveStoreIds.length > 0 ? dayCount / effectiveStoreIds.length : 0;
            const avgDailyAcrossStores = horizon > 0 ? totalEff / horizon : 0;
            extrapolatedDays = Math.round((fechaFinDate.getTime() - forecastEnd.getTime()) / DAY_MS);
            extrapolation = avgDailyAcrossStores * extrapolatedDays;
        }

        const projectedRemaining = forecastWithinHorizon + extrapolation;
        const projectedTotal = actualToDate + projectedRemaining;
        const percentExpected = target > 0 ? projectedTotal / target : 0;
        const percentActual = target > 0 ? actualToDate / target : 0;

        out.push({
            idMeta: m.IdMeta,
            fechaInicio,
            fechaFin,
            daysElapsed,
            daysRemaining,
            storesIncluded: effectiveStoreIds.length,
            storesTotal: metaStoreIds.length,
            effectiveStoreIds,
            target,
            actualToDate,
            projectedRemaining,
            projectedTotal,
            percentExpected,
            percentActual,
            hasConcepts: false,
            extrapolatedDays,
        });
    }

    return out;
}
