import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

interface RawRow {
    CodigoInterno: number;
    Descripcion: string;
    Depto: string;
    IdTienda: number;
    Tienda: string;
    StockActual: number;
    Costo: number | null;
    FechaAct: Date | string | null;
    Total30d: number;
    Unidades30d: number;
    DiasConVenta: number;
}

export interface StockoutItem {
    codigoInterno: number;
    descripcion: string;
    depto: string;
    idTienda: number;
    tienda: string;
    stockActual: number;
    costo: number;
    fechaAct: string | null;
    total30d: number;
    unidades30d: number;
    diasConVenta: number;
    avgDailyRevenue: number;
    avgDailyUnits: number;
    estimatedLostRevenue: number;
    estimatedLostUnits: number;
    severity: 'critico' | 'alto' | 'medio';
}

export interface StockoutsResponse {
    scope: { storeIds: number[]; label: string };
    filters: { threshold: number; lookbackDays: number; horizonDays: number };
    kpis: {
        skusInBreakdown: number;
        storesAffected: number;
        estimatedLostRevenue: number;
        estimatedLostUnits: number;
        avgDailyLostRevenue: number;
        totalSkusWithSales: number;
    };
    byStore: Array<{ idTienda: number; tienda: string; skus: number; estimatedLostRevenue: number }>;
    byDepto: Array<{ depto: string; skus: number; estimatedLostRevenue: number }>;
    items: StockoutItem[];
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const rawStoreIds: number[] = Array.isArray(body.storeIds) ? body.storeIds : [];
        const storeIds = rawStoreIds.map(n => Number(n)).filter(n => Number.isFinite(n));
        const threshold = Math.max(0, Math.min(100, Number(body.threshold ?? 0)));
        const lookbackDays = Math.max(7, Math.min(180, Number(body.lookbackDays ?? 30)));
        const horizonDays = Math.max(1, Math.min(90, Number(body.horizonDays ?? 7)));

        const storeFilter = storeIds.length > 0 ? `AND e.IdTienda IN (${storeIds.join(',')})` : '';
        const storeFilterSales = storeIds.length > 0 ? `AND v.IdTienda IN (${storeIds.join(',')})` : '';

        const sql = `
            WITH RecentSales AS (
                SELECT
                    dv.CodigoInterno,
                    v.IdTienda,
                    SUM(dv.PrecioVenta * dv.Cantidad) AS Total30d,
                    SUM(dv.Cantidad) AS Unidades30d,
                    COUNT(DISTINCT CAST(v.FechaVenta AS DATE)) AS DiasConVenta
                FROM tblVentas v
                JOIN tblDetalleVentas dv ON v.IdVenta = dv.IdVenta AND v.IdTienda = dv.IdTienda AND v.IdComputadora = dv.IdComputadora
                WHERE v.FechaVenta >= DATEADD(day, -${lookbackDays}, GETDATE())
                ${storeFilterSales}
                GROUP BY dv.CodigoInterno, v.IdTienda
            )
            SELECT
                e.CodigoInterno,
                ISNULL(a.Descripcion, 'S/N') AS Descripcion,
                ISNULL(d.Depto, '') AS Depto,
                e.IdTienda,
                ISNULL(t.Tienda, CONCAT('Tienda ', e.IdTienda)) AS Tienda,
                e.Exi AS StockActual,
                ISNULL(e.Costo, 0) AS Costo,
                e.FechaAct,
                rs.Total30d,
                rs.Unidades30d,
                rs.DiasConVenta
            FROM tblExistencias e
            INNER JOIN RecentSales rs ON e.CodigoInterno = rs.CodigoInterno AND e.IdTienda = rs.IdTienda
            LEFT JOIN tblArticulos a ON e.CodigoInterno = a.CodigoInterno
            LEFT JOIN tblDeptos d ON a.IdDepto = d.IdDepto
            LEFT JOIN tblTiendas t ON e.IdTienda = t.IdTienda
            WHERE e.Exi <= ${threshold}
            ${storeFilter}
            ORDER BY rs.Total30d DESC
        `;

        const rows = await query(sql) as RawRow[];

        const items: StockoutItem[] = rows.map(r => {
            const total30d = Number(r.Total30d || 0);
            const unidades30d = Number(r.Unidades30d || 0);
            const avgDailyRevenue = total30d / lookbackDays;
            const avgDailyUnits = unidades30d / lookbackDays;
            const estimatedLostRevenue = avgDailyRevenue * horizonDays;
            const estimatedLostUnits = avgDailyUnits * horizonDays;
            const severity: StockoutItem['severity'] = avgDailyRevenue >= 1000
                ? 'critico'
                : avgDailyRevenue >= 200
                    ? 'alto'
                    : 'medio';
            const fechaAct = r.FechaAct
                ? (r.FechaAct instanceof Date ? r.FechaAct.toISOString() : String(r.FechaAct))
                : null;
            return {
                codigoInterno: r.CodigoInterno,
                descripcion: r.Descripcion,
                depto: r.Depto,
                idTienda: r.IdTienda,
                tienda: r.Tienda,
                stockActual: Number(r.StockActual || 0),
                costo: Number(r.Costo || 0),
                fechaAct,
                total30d,
                unidades30d,
                diasConVenta: Number(r.DiasConVenta || 0),
                avgDailyRevenue,
                avgDailyUnits,
                estimatedLostRevenue,
                estimatedLostUnits,
                severity,
            };
        });

        // KPIs
        const uniqueSkus = new Set(items.map(i => i.codigoInterno));
        const uniqueStores = new Set(items.map(i => i.idTienda));
        const totalLostRevenue = items.reduce((a, b) => a + b.estimatedLostRevenue, 0);
        const totalLostUnits = items.reduce((a, b) => a + b.estimatedLostUnits, 0);
        const avgDailyLost = totalLostRevenue / horizonDays;

        // By store
        const byStoreMap = new Map<number, { idTienda: number; tienda: string; skus: number; estimatedLostRevenue: number }>();
        for (const it of items) {
            const cur = byStoreMap.get(it.idTienda) || { idTienda: it.idTienda, tienda: it.tienda, skus: 0, estimatedLostRevenue: 0 };
            cur.skus += 1;
            cur.estimatedLostRevenue += it.estimatedLostRevenue;
            byStoreMap.set(it.idTienda, cur);
        }
        const byStore = Array.from(byStoreMap.values()).sort((a, b) => b.estimatedLostRevenue - a.estimatedLostRevenue);

        // By depto
        const byDeptoMap = new Map<string, { depto: string; skus: number; estimatedLostRevenue: number }>();
        for (const it of items) {
            const key = it.depto || '(sin depto)';
            const cur = byDeptoMap.get(key) || { depto: key, skus: 0, estimatedLostRevenue: 0 };
            cur.skus += 1;
            cur.estimatedLostRevenue += it.estimatedLostRevenue;
            byDeptoMap.set(key, cur);
        }
        const byDepto = Array.from(byDeptoMap.values()).sort((a, b) => b.estimatedLostRevenue - a.estimatedLostRevenue);

        // Total SKUs with sales (denominator for context)
        const totalSkusRows = await query(`
            SELECT COUNT(DISTINCT CONCAT(dv.CodigoInterno, '-', v.IdTienda)) AS Total
            FROM tblVentas v
            JOIN tblDetalleVentas dv ON v.IdVenta = dv.IdVenta AND v.IdTienda = dv.IdTienda AND v.IdComputadora = dv.IdComputadora
            WHERE v.FechaVenta >= DATEADD(day, -${lookbackDays}, GETDATE())
            ${storeFilterSales}
        `) as Array<{ Total: number }>;
        const totalSkusWithSales = Number(totalSkusRows[0]?.Total || 0);

        const scopeLabel = storeIds.length === 0
            ? 'Todas las sucursales'
            : storeIds.length === 1
                ? (items.find(i => i.idTienda === storeIds[0])?.tienda || '1 sucursal')
                : `${storeIds.length} sucursales`;

        const response: StockoutsResponse = {
            scope: { storeIds, label: scopeLabel },
            filters: { threshold, lookbackDays, horizonDays },
            kpis: {
                skusInBreakdown: uniqueSkus.size,
                storesAffected: uniqueStores.size,
                estimatedLostRevenue: totalLostRevenue,
                estimatedLostUnits: totalLostUnits,
                avgDailyLostRevenue: avgDailyLost,
                totalSkusWithSales,
            },
            byStore,
            byDepto,
            items,
        };

        return NextResponse.json(response);
    } catch (error: unknown) {
        console.error('Stockouts API error:', error);
        const msg = error instanceof Error ? error.message : 'Error generando reporte';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
