/**
 * Tools de Forecast para uso del agente Kesito (chat interno + WhatsApp).
 *
 * Encapsula la lógica del dashboard /api/dashboard/forecast en funciones
 * que devuelven payloads compactos optimizados para que el modelo los
 * narre, sin la sobrecarga de history+forecastByStore completos.
 *
 * No llama a Claude internamente: solo SQL + cálculo. El narrado lo hace
 * el agente que la invoca.
 */

import { query } from '@/lib/db';
import {
    forecastSeasonalMA,
    type HistoryPoint,
    type ForecastPoint,
} from './seasonal-moving-average';
import { getHolidaysInRange } from './mx-holidays';
import { computeHolidayBoosts } from './holiday-adjust';

const DAY_MS = 24 * 60 * 60 * 1000;

function toISO(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export interface AgentMetaSummary {
    period: { start: string; end: string };
    target: number;
    actualToDate: number;
    projectedTotal: number;
    percentExpected: number;
    daysRemaining: number;
    storesIncluded: number;
    hasConcepts: boolean;
    note?: string;
}

export interface AgentHolidaySummary {
    fecha: string;
    name: string;
    impact: 'high' | 'medium' | 'low';
    multiplier?: number;
}

export interface AgentForecastSummary {
    horizonDays: number;
    historyDays: number;
    scope: { storeIds: number[]; storeNames: string[]; label: string };
    period: { start: string; end: string };

    totalForecast: number;
    sameLengthHistorySum: number;
    projectedVsHistoryPct: number;
    avgDaily: number;
    trend: number;
    confidence: number;
    mape: number | null;

    forecastSample: Array<{ fecha: string; predicted: number; lower: number; upper: number }>;
    topStores: Array<{ idTienda: number; tienda: string; total: number; share: number }>;
    activeMetas: AgentMetaSummary[];
    upcomingHolidays: AgentHolidaySummary[];
}

async function resolveStores(opts: { storeIds?: number[]; storeNames?: string[] }): Promise<{ ids: number[]; names: string[] }> {
    const safeIds = (opts.storeIds || [])
        .map(n => Number(n))
        .filter(n => Number.isFinite(n));
    const names = (opts.storeNames || []).filter(s => typeof s === 'string' && s.trim());

    if (safeIds.length === 0 && names.length === 0) {
        return { ids: [], names: [] };
    }

    const conditions: string[] = [];
    if (safeIds.length > 0) conditions.push(`IdTienda IN (${safeIds.join(',')})`);
    if (names.length > 0) {
        const likes = names.map(n => `Tienda LIKE '%${n.replace(/'/g, "''").trim()}%'`).join(' OR ');
        conditions.push(`(${likes})`);
    }
    const rows = await query(
        `SELECT DISTINCT IdTienda, Tienda FROM tblTiendas WHERE Status = 0 AND (${conditions.join(' OR ')})`
    ) as Array<{ IdTienda: number; Tienda: string }>;

    return {
        ids: rows.map(r => r.IdTienda),
        names: rows.map(r => r.Tienda),
    };
}

export async function runForecastForAgent(opts: {
    storeIds?: number[];
    storeNames?: string[];
    horizonDays?: number;
}): Promise<AgentForecastSummary> {
    const horizonDays = Math.max(1, Math.min(180, Number(opts.horizonDays) || 30));
    const historyDays = Math.max(400, horizonDays * 4);
    const resolved = await resolveStores({ storeIds: opts.storeIds, storeNames: opts.storeNames });

    const today = new Date();
    const rawStart = new Date(today.getTime() - historyDays * DAY_MS);
    const startDate = new Date(rawStart.getFullYear(), rawStart.getMonth(), 1);

    let whereStore = '';
    if (resolved.ids.length > 0) {
        whereStore = ` AND IdTienda IN (${resolved.ids.join(',')})`;
    }

    const sql = `
        SELECT
            CAST([Fecha Venta] AS DATE) AS Fecha,
            IdTienda,
            Tienda,
            SUM(Total) AS Total
        FROM Ventas
        WHERE [Fecha Venta] >= '${toISO(startDate)}' AND [Fecha Venta] <= '${toISO(today)} 23:59:59'
        ${whereStore}
        GROUP BY CAST([Fecha Venta] AS DATE), IdTienda, Tienda
        ORDER BY Fecha ASC
    `;
    const rows = await query(sql) as Array<{ Fecha: Date | string; IdTienda: number; Tienda: string; Total: number }>;

    const storeNamesById = new Map<number, string>();
    const totalsByDate = new Map<string, number>();
    const totalsByStore = new Map<number, number>();

    for (const r of rows) {
        const fecha = r.Fecha instanceof Date ? toISO(r.Fecha) : String(r.Fecha).split('T')[0];
        const t = Number(r.Total || 0);
        if (r.IdTienda) {
            storeNamesById.set(r.IdTienda, r.Tienda);
            totalsByStore.set(r.IdTienda, (totalsByStore.get(r.IdTienda) || 0) + t);
        }
        totalsByDate.set(fecha, (totalsByDate.get(fecha) || 0) + t);
    }

    const history: HistoryPoint[] = Array.from(totalsByDate.entries())
        .map(([fecha, total]) => ({ fecha, total }))
        .sort((a, b) => a.fecha.localeCompare(b.fecha));

    const lastHistFecha = history.length > 0 ? history[history.length - 1].fecha : toISO(today);
    const lastHist = new Date(`${lastHistFecha}T00:00:00`);
    const forecastStartStr = toISO(new Date(lastHist.getTime() + DAY_MS));
    const forecastEndStr = toISO(new Date(lastHist.getTime() + horizonDays * DAY_MS));

    const boosts = computeHolidayBoosts(history, forecastStartStr, forecastEndStr);
    const result = forecastSeasonalMA(history, horizonDays, boosts);

    const totalForecast = result.forecast.reduce((a, b) => a + b.predicted, 0);
    const sameLengthHistorySum = history.slice(-horizonDays).reduce((a, b) => a + b.total, 0);
    const projectedVsHistoryPct = sameLengthHistorySum > 0
        ? (totalForecast - sameLengthHistorySum) / sameLengthHistorySum
        : 0;
    const avgDaily = result.forecast.length > 0 ? totalForecast / result.forecast.length : 0;

    const holidaysRaw = getHolidaysInRange(forecastStartStr, forecastEndStr);
    const upcomingHolidays: AgentHolidaySummary[] = holidaysRaw
        .filter(h => h.impact !== 'low')
        .map(h => {
            const b = boosts.get(h.fecha);
            return b
                ? { fecha: h.fecha, name: h.name, impact: h.impact, multiplier: b.multiplier }
                : { fecha: h.fecha, name: h.name, impact: h.impact };
        });

    // Top stores by total forecast share
    const totalAllStores = Array.from(totalsByStore.values()).reduce((a, b) => a + b, 0);
    const topStores = Array.from(totalsByStore.entries())
        .map(([id, total]) => ({
            idTienda: id,
            tienda: storeNamesById.get(id) || `Tienda ${id}`,
            total,
            share: totalAllStores > 0 ? total / totalAllStores : 0,
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

    // Meta projections (compact)
    const activeMetas = await computeAgentMetaProjections({
        lastHistFecha,
        horizonDays,
        userSelectedStoreIds: resolved.ids,
        forecast: result.forecast,
    });

    const scopeLabel = resolved.ids.length === 0
        ? 'todas las sucursales'
        : resolved.ids.length === 1
            ? (storeNamesById.get(resolved.ids[0]) || resolved.names[0] || '1 sucursal')
            : `${resolved.ids.length} sucursales`;

    return {
        horizonDays,
        historyDays,
        scope: {
            storeIds: resolved.ids,
            storeNames: resolved.ids.length > 0 ? resolved.ids.map(id => storeNamesById.get(id) || '') : [],
            label: scopeLabel,
        },
        period: { start: forecastStartStr, end: forecastEndStr },
        totalForecast,
        sameLengthHistorySum,
        projectedVsHistoryPct,
        avgDaily,
        trend: result.trend,
        confidence: result.confidence,
        mape: result.mape,
        forecastSample: result.forecast.slice(0, 14).map(p => ({
            fecha: p.fecha,
            predicted: p.predicted,
            lower: p.lower,
            upper: p.upper,
        })),
        topStores,
        activeMetas,
        upcomingHolidays,
    };
}

async function computeAgentMetaProjections(args: {
    lastHistFecha: string;
    horizonDays: number;
    userSelectedStoreIds: number[];
    forecast: ForecastPoint[];
}): Promise<AgentMetaSummary[]> {
    const { lastHistFecha, horizonDays, userSelectedStoreIds, forecast } = args;
    const lastHist = new Date(`${lastHistFecha}T00:00:00`);

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
    const out: AgentMetaSummary[] = [];

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

        const effectiveIds = userSelectedStoreIds.length === 0
            ? metaStoreIds
            : metaStoreIds.filter(id => userStoreSet.has(id));
        if (effectiveIds.length === 0) continue;

        const effectiveSet = new Set(effectiveIds);
        const target = storeTargets
            .filter(t => effectiveSet.has(t.IdTienda))
            .reduce((a, b) => a + (Number(b.MontoMeta) || 0), 0);

        const fechaFinDate = new Date(`${fechaFin}T00:00:00`);
        const daysRemaining = Math.max(0, Math.round((fechaFinDate.getTime() - lastHist.getTime()) / DAY_MS));

        if (hasConcepts) {
            out.push({
                period: { start: fechaInicio, end: fechaFin },
                target,
                actualToDate: 0,
                projectedTotal: 0,
                percentExpected: 0,
                daysRemaining,
                storesIncluded: effectiveIds.length,
                hasConcepts: true,
                note: 'Filtra por departamento/familia/SKU — la proyección de venta total no aplica.',
            });
            continue;
        }

        const actualsRows = await query(`
            SELECT SUM(Total) AS Actual
            FROM Ventas
            WHERE [Fecha Venta] >= '${fechaInicio}'
              AND [Fecha Venta] <= '${lastHistFecha} 23:59:59'
              AND IdTienda IN (${effectiveIds.join(',')})
        `) as Array<{ Actual: number | null }>;
        const actualToDate = Number(actualsRows[0]?.Actual || 0);

        // Approx: scale forecast sum by share of effective stores (forecast already filtered)
        let forecastWithinHorizon = 0;
        for (const p of forecast) {
            if (p.fecha <= fechaFin) forecastWithinHorizon += p.predicted;
        }

        // If meta extends beyond forecast horizon, extrapolate with avg daily
        const forecastEndDate = new Date(lastHist.getTime() + horizonDays * DAY_MS);
        let extrapolation = 0;
        if (fechaFinDate > forecastEndDate && forecast.length > 0) {
            const avgDaily = forecast.reduce((a, b) => a + b.predicted, 0) / forecast.length;
            const extraDays = Math.round((fechaFinDate.getTime() - forecastEndDate.getTime()) / DAY_MS);
            extrapolation = avgDaily * extraDays;
        }
        const projectedRemaining = forecastWithinHorizon + extrapolation;
        const projectedTotal = actualToDate + projectedRemaining;
        const percentExpected = target > 0 ? projectedTotal / target : 0;

        out.push({
            period: { start: fechaInicio, end: fechaFin },
            target,
            actualToDate,
            projectedTotal,
            percentExpected,
            daysRemaining,
            storesIncluded: effectiveIds.length,
            hasConcepts: false,
        });
    }

    return out;
}

// === Product recommendations (pure data, no Claude) ===

export interface AgentProductSignal {
    codigoInterno: number;
    descripcion: string;
    depto: string;
    recentTotal: number;
    recentUnits: number;
    recentGrowthPct: number;
    lyHorizonTotal: number;
    lyHorizonUnits: number;
    seasonalityRatio: number;
    actionHint: 'stock_up' | 'push' | 'monitor' | 'reduce';
    actionReason: string;
    score: number;
}

async function topProductsForAgent(
    dateStart: string,
    dateEnd: string,
    storeIds: number[],
    topN: number
): Promise<Array<{ CodigoInterno: number; Descripcion: string; Depto: string; Total: number; Unidades: number }>> {
    const storeFilter = storeIds.length > 0 ? `AND v.IdTienda IN (${storeIds.join(',')})` : '';
    return await query(`
        SELECT TOP ${topN}
            a.CodigoInterno,
            ISNULL(a.Descripcion, 'S/N') AS Descripcion,
            ISNULL(d.Depto, '') AS Depto,
            SUM(dv.PrecioVenta * dv.Cantidad) AS Total,
            SUM(dv.Cantidad) AS Unidades
        FROM tblVentas v
        JOIN tblDetalleVentas dv ON v.IdVenta = dv.IdVenta AND v.IdTienda = dv.IdTienda AND v.IdComputadora = dv.IdComputadora
        JOIN tblArticulos a ON dv.CodigoInterno = a.CodigoInterno
        LEFT JOIN tblDeptos d ON a.IdDepto = d.IdDepto
        WHERE v.FechaVenta >= '${dateStart}' AND v.FechaVenta <= '${dateEnd} 23:59:59'
        ${storeFilter}
        GROUP BY a.CodigoInterno, a.Descripcion, d.Depto
        ORDER BY Total DESC
    `) as Array<{ CodigoInterno: number; Descripcion: string; Depto: string; Total: number; Unidades: number }>;
}

async function totalsForCodes(
    codes: number[],
    dateStart: string,
    dateEnd: string,
    storeIds: number[]
): Promise<Map<number, { total: number; unidades: number }>> {
    const map = new Map<number, { total: number; unidades: number }>();
    if (codes.length === 0) return map;
    const storeFilter = storeIds.length > 0 ? `AND v.IdTienda IN (${storeIds.join(',')})` : '';
    const rows = await query(`
        SELECT dv.CodigoInterno,
            SUM(dv.PrecioVenta * dv.Cantidad) AS Total,
            SUM(dv.Cantidad) AS Unidades
        FROM tblVentas v
        JOIN tblDetalleVentas dv ON v.IdVenta = dv.IdVenta AND v.IdTienda = dv.IdTienda AND v.IdComputadora = dv.IdComputadora
        WHERE v.FechaVenta >= '${dateStart}' AND v.FechaVenta <= '${dateEnd} 23:59:59'
          AND dv.CodigoInterno IN (${codes.join(',')})
        ${storeFilter}
        GROUP BY dv.CodigoInterno
    `) as Array<{ CodigoInterno: number; Total: number; Unidades: number }>;
    for (const r of rows) {
        map.set(r.CodigoInterno, { total: Number(r.Total || 0), unidades: Number(r.Unidades || 0) });
    }
    return map;
}

function classifyAction(p: {
    recentGrowthPct: number;
    seasonalityRatio: number;
    recentTotal: number;
    lyHorizonTotal: number;
}): { action: 'stock_up' | 'push' | 'monitor' | 'reduce'; reason: string } {
    const growthPctText = (p.recentGrowthPct >= 0 ? '+' : '') + (p.recentGrowthPct * 100).toFixed(0) + '%';
    if (p.seasonalityRatio >= 1.4 && p.lyHorizonTotal > 0) {
        return {
            action: 'stock_up',
            reason: `LY mismo período ×${p.seasonalityRatio.toFixed(2)} sobre baseline — oportunidad estacional`,
        };
    }
    if (p.recentGrowthPct >= 0.15) {
        return {
            action: 'push',
            reason: `Tendencia reciente ${growthPctText} vs. mes previo`,
        };
    }
    if (p.recentGrowthPct <= -0.20 && p.seasonalityRatio < 1.1) {
        return {
            action: 'reduce',
            reason: `Cae ${growthPctText} y sin soporte estacional LY`,
        };
    }
    return {
        action: 'monitor',
        reason: `Señales mixtas (crec. ${growthPctText}, estacional ×${p.seasonalityRatio.toFixed(2)})`,
    };
}

export async function getProductRecommendationsForAgent(opts: {
    storeIds?: number[];
    storeNames?: string[];
    horizonDays?: number;
    topN?: number;
}): Promise<{ scopeLabel: string; products: AgentProductSignal[] }> {
    const horizonDays = Math.max(1, Math.min(180, Number(opts.horizonDays) || 30));
    const topN = Math.max(5, Math.min(30, Number(opts.topN) || 15));
    const resolved = await resolveStores({ storeIds: opts.storeIds, storeNames: opts.storeNames });
    const storeIds = resolved.ids;

    const today = new Date();
    const recentEnd = today;
    const recentStart = new Date(today.getTime() - 30 * DAY_MS);
    const priorEnd = recentStart;
    const priorStart = new Date(recentStart.getTime() - 30 * DAY_MS);
    const horizonStart = new Date(today.getTime() + DAY_MS);
    const horizonEnd = new Date(today.getTime() + horizonDays * DAY_MS);
    const lyHorizonStart = new Date(horizonStart.getTime() - 365 * DAY_MS);
    const lyHorizonEnd = new Date(horizonEnd.getTime() - 365 * DAY_MS);
    const lyBaselineEnd = lyHorizonStart;
    const lyBaselineStart = new Date(lyHorizonStart.getTime() - 30 * DAY_MS);

    const [recentTop, lyHorizonTop] = await Promise.all([
        topProductsForAgent(toISO(recentStart), toISO(recentEnd), storeIds, topN + 5),
        topProductsForAgent(toISO(lyHorizonStart), toISO(lyHorizonEnd), storeIds, topN + 5),
    ]);

    const byCode = new Map<number, { CodigoInterno: number; Descripcion: string; Depto: string }>();
    for (const r of recentTop) byCode.set(r.CodigoInterno, r);
    for (const r of lyHorizonTop) if (!byCode.has(r.CodigoInterno)) byCode.set(r.CodigoInterno, r);
    const allCodes = Array.from(byCode.keys());

    if (allCodes.length === 0) {
        return {
            scopeLabel: storeIds.length === 0 ? 'todas las sucursales' : `${storeIds.length} sucursal(es)`,
            products: [],
        };
    }

    const [priorTotals, lyHorizonTotals, lyBaselineTotals, recentTotals] = await Promise.all([
        totalsForCodes(allCodes, toISO(priorStart), toISO(priorEnd), storeIds),
        totalsForCodes(allCodes, toISO(lyHorizonStart), toISO(lyHorizonEnd), storeIds),
        totalsForCodes(allCodes, toISO(lyBaselineStart), toISO(lyBaselineEnd), storeIds),
        totalsForCodes(allCodes, toISO(recentStart), toISO(recentEnd), storeIds),
    ]);

    const enriched: AgentProductSignal[] = allCodes.map(code => {
        const meta = byCode.get(code)!;
        const recent = recentTotals.get(code) || { total: 0, unidades: 0 };
        const prior = priorTotals.get(code) || { total: 0, unidades: 0 };
        const lyH = lyHorizonTotals.get(code) || { total: 0, unidades: 0 };
        const lyB = lyBaselineTotals.get(code) || { total: 0, unidades: 0 };

        const recentGrowthPct = prior.total > 0 ? (recent.total - prior.total) / prior.total : 0;
        const seasonalityRatio = lyB.total > 0 ? lyH.total / lyB.total : (lyH.total > 0 ? 2 : 1);
        const score = recent.total * 0.6 + lyH.total * 0.4
            + Math.max(0, recentGrowthPct) * 10000
            + Math.max(0, seasonalityRatio - 1) * 5000;
        const cls = classifyAction({
            recentGrowthPct,
            seasonalityRatio,
            recentTotal: recent.total,
            lyHorizonTotal: lyH.total,
        });
        return {
            codigoInterno: code,
            descripcion: meta.Descripcion,
            depto: meta.Depto,
            recentTotal: recent.total,
            recentUnits: recent.unidades,
            recentGrowthPct,
            lyHorizonTotal: lyH.total,
            lyHorizonUnits: lyH.unidades,
            seasonalityRatio,
            actionHint: cls.action,
            actionReason: cls.reason,
            score,
        };
    });

    enriched.sort((a, b) => b.score - a.score);
    return {
        scopeLabel: storeIds.length === 0
            ? 'todas las sucursales'
            : storeIds.length === 1
                ? (resolved.names[0] || '1 sucursal')
                : `${storeIds.length} sucursales`,
        products: enriched.slice(0, topN),
    };
}

// === Compact text rendering for agent prompts ===

export function renderForecastSummaryForAgent(summary: AgentForecastSummary): string {
    const fmtMxn = (n: number) => new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 }).format(n);
    const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;
    const lines: string[] = [];

    lines.push(`FORECAST AGGREGADO (${summary.scope.label}, horizonte ${summary.horizonDays} días: ${summary.period.start} a ${summary.period.end}):`);
    lines.push(`  Proyección total: $${fmtMxn(summary.totalForecast)} (promedio diario $${fmtMxn(summary.avgDaily)})`);
    lines.push(`  Histórico mismo número de días: $${fmtMxn(summary.sameLengthHistorySum)} (variación ${summary.projectedVsHistoryPct >= 0 ? '+' : ''}${fmtPct(summary.projectedVsHistoryPct)})`);
    lines.push(`  Tendencia mensual: ${summary.trend >= 0 ? '+' : ''}${fmtPct(summary.trend)} · Confianza ${(summary.confidence * 100).toFixed(0)}% · MAPE backtest ${summary.mape !== null ? fmtPct(summary.mape) : 'N/A'}`);

    if (summary.forecastSample.length > 0) {
        lines.push(`PRIMEROS ${summary.forecastSample.length} DÍAS:`);
        for (const p of summary.forecastSample) {
            lines.push(`  ${p.fecha}: $${fmtMxn(p.predicted)}  (rango $${fmtMxn(p.lower)}–$${fmtMxn(p.upper)})`);
        }
    }

    if (summary.topStores.length > 0) {
        lines.push(`TOP SUCURSALES (por venta acumulada en el histórico):`);
        for (const s of summary.topStores) {
            lines.push(`  ${s.tienda}: $${fmtMxn(s.total)} (${fmtPct(s.share)})`);
        }
    }

    if (summary.activeMetas.length > 0) {
        lines.push(`METAS ACTIVAS:`);
        for (const m of summary.activeMetas) {
            if (m.hasConcepts) {
                lines.push(`  ${m.period.start} – ${m.period.end}: meta $${fmtMxn(m.target)} (con filtros de concepto, proyección no aplicable directamente)`);
                continue;
            }
            const diff = m.projectedTotal - m.target;
            const status = m.percentExpected >= 1 ? 'EXCEDE' : m.percentExpected >= 0.9 ? 'CERCA' : 'ATRASADA';
            lines.push(`  ${m.period.start} – ${m.period.end} (${m.storesIncluded} suc): meta $${fmtMxn(m.target)}, real a hoy $${fmtMxn(m.actualToDate)}, proyección cierre $${fmtMxn(m.projectedTotal)} (${fmtPct(m.percentExpected)}, ${status}, ${diff >= 0 ? 'excede' : 'falta'} $${fmtMxn(Math.abs(diff))}, restan ${m.daysRemaining}d)`);
        }
    }

    if (summary.upcomingHolidays.length > 0) {
        lines.push(`FESTIVOS EN HORIZONTE:`);
        for (const h of summary.upcomingHolidays) {
            const adj = typeof h.multiplier === 'number'
                ? `ajuste ×${h.multiplier.toFixed(2)}`
                : 'sin ajuste';
            lines.push(`  ${h.fecha} ${h.name} (impacto ${h.impact}, ${adj})`);
        }
    }

    return lines.join('\n');
}

export function renderProductRecommendationsForAgent(data: { scopeLabel: string; products: AgentProductSignal[] }, horizonDays: number): string {
    const fmtMxn = (n: number) => new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 }).format(n);
    const fmtPct = (n: number) => `${(n * 100).toFixed(0)}%`;
    const lines: string[] = [];
    lines.push(`SUGERENCIAS DE PRODUCTOS (${data.scopeLabel}, horizonte ${horizonDays} días):`);
    if (data.products.length === 0) {
        lines.push(`  (sin datos suficientes)`);
        return lines.join('\n');
    }
    lines.push(`  Top ${data.products.length} productos ordenados por relevancia combinada (reciente + LY estacional):`);
    for (const p of data.products) {
        const growth = (p.recentGrowthPct >= 0 ? '+' : '') + fmtPct(p.recentGrowthPct);
        lines.push(`  · #${p.codigoInterno} ${p.descripcion}${p.depto ? ` [${p.depto}]` : ''}`);
        lines.push(`    → ${p.actionHint.toUpperCase()}: ${p.actionReason}`);
        lines.push(`    reciente 30d $${fmtMxn(p.recentTotal)} (${growth}) · LY mismo período $${fmtMxn(p.lyHorizonTotal)} (×${p.seasonalityRatio.toFixed(2)})`);
    }
    return lines.join('\n');
}
