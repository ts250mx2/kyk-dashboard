import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

type CompareMode = 'periodo' | 'anio';

const DAY_MS = 86400000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function shiftOneYearBack(dateStr: string): string {
    const [y, m, d] = dateStr.split('-');
    const day = m === '02' && d === '29' ? '28' : d;
    return `${Number(y) - 1}-${m}-${day}`;
}

/** Calcula el periodo de comparación: mismo rango del año pasado o el periodo inmediato anterior de igual duración. */
function getComparePeriod(fechaInicio: string, fechaFin: string, mode: CompareMode) {
    if (mode === 'anio') {
        return { fechaInicio: shiftOneYearBack(fechaInicio), fechaFin: shiftOneYearBack(fechaFin) };
    }
    const start = new Date(`${fechaInicio}T00:00:00Z`);
    const end = new Date(`${fechaFin}T00:00:00Z`);
    const durationMs = end.getTime() - start.getTime();
    const prevEnd = new Date(start.getTime() - DAY_MS);
    const prevStart = new Date(prevEnd.getTime() - durationMs);
    return {
        fechaInicio: prevStart.toISOString().split('T')[0],
        fechaFin: prevEnd.toISOString().split('T')[0],
    };
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const fechaInicio = searchParams.get('fechaInicio');
        const fechaFin = searchParams.get('fechaFin');
        const storeId = searchParams.get('storeId');
        const groupBy = searchParams.get('groupBy') || 'articulo';
        const compareWith: CompareMode = searchParams.get('compareWith') === 'anio' ? 'anio' : 'periodo';

        if (!fechaInicio || !fechaFin) {
            return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }
        if (!DATE_RE.test(fechaInicio) || !DATE_RE.test(fechaFin)) {
            return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
        }

        const prev = getComparePeriod(fechaInicio, fechaFin, compareWith);

        const startStr = `'${fechaInicio} 00:00:00'`;
        const endStr = `'${fechaFin} 23:59:59'`;
        const prevStartStr = `'${prev.fechaInicio} 00:00:00'`;
        const prevEndStr = `'${prev.fechaFin} 23:59:59'`;

        let storeFilter = '';
        if (storeId && storeId !== 'undefined' && storeId !== 'null') {
            const storeIdNum = Number(storeId);
            if (!Number.isInteger(storeIdNum)) {
                return NextResponse.json({ error: 'Invalid storeId' }, { status: 400 });
            }
            storeFilter = `AND v.IdTienda = ${storeIdNum}`;
        }

        let selectFields = '';
        let groupByFields = '';
        let prevKeyExpr = '';
        let prevJoinCondition = '';
        let extraJoin = '';

        if (groupBy === 'departamento') {
            selectFields = `d.Depto as Descripcion, d.Depto as Departamento, '' as CodigoBarras, '' as Familia`;
            groupByFields = `d.Depto`;
            prevKeyExpr = `d.Depto`;
            prevJoinCondition = `s.Descripcion = pv.PrevKey`;
        } else if (groupBy === 'familia') {
            selectFields = `ISNULL(NULLIF(a.Familia, ''), 'SIN FAMILIA') as Descripcion, '' as Departamento, '' as CodigoBarras, ISNULL(NULLIF(a.Familia, ''), 'SIN FAMILIA') as Familia`;
            groupByFields = `a.Familia`;
            prevKeyExpr = `ISNULL(NULLIF(a.Familia, ''), 'SIN FAMILIA')`;
            prevJoinCondition = `s.Descripcion = pv.PrevKey`;
        } else if (groupBy === 'sucursal') {
            selectFields = `t.Tienda as Descripcion, '' as Departamento, '' as CodigoBarras, '' as Familia`;
            groupByFields = `t.Tienda`;
            prevKeyExpr = `t.Tienda`;
            prevJoinCondition = `s.Descripcion = pv.PrevKey`;
            extraJoin = `JOIN tblTiendas t ON v.IdTienda = t.IdTienda`;
        } else {
            selectFields = `a.CodigoBarras, a.Descripcion, a.Familia, d.Depto as Departamento`;
            groupByFields = `a.CodigoBarras, a.Descripcion, a.Familia, d.Depto`;
            prevKeyExpr = `a.CodigoBarras`;
            prevJoinCondition = `s.CodigoBarras = pv.PrevKey`;
        }

        const baseJoins = `
                FROM tblVentas v
                JOIN tblDetalleVentas dv ON v.IdVenta = dv.IdVenta AND v.IdTienda = dv.IdTienda AND v.IdComputadora = dv.IdComputadora
                JOIN tblArticulos a ON dv.CodigoInterno = a.CodigoInterno
                JOIN tblDeptos d ON a.IdDepto = d.IdDepto
                ${extraJoin}`;

        const sql = `
            WITH SalesByItem AS (
                SELECT
                    ${selectFields},
                    SUM(dv.PrecioVenta * dv.Cantidad) as TotalItemVenta,
                    SUM(dv.Cantidad) as CantidadVendida,
                    COUNT(DISTINCT v.IdVenta) as Operaciones
                ${baseJoins}
                WHERE v.FechaVenta >= ${startStr} AND v.FechaVenta <= ${endStr}
                  ${storeFilter}
                GROUP BY ${groupByFields}
            ),
            PrevSalesByItem AS (
                SELECT
                    ${prevKeyExpr} as PrevKey,
                    SUM(dv.PrecioVenta * dv.Cantidad) as TotalItemVentaPrev
                ${baseJoins}
                WHERE v.FechaVenta >= ${prevStartStr} AND v.FechaVenta <= ${prevEndStr}
                  ${storeFilter}
                GROUP BY ${prevKeyExpr}
            ),
            TotalSales AS (
                SELECT SUM(TotalItemVenta) as GrandTotal FROM SalesByItem
            ),
            ParetoCalculation AS (
                SELECT
                    s.*,
                    SUM(s.TotalItemVenta) OVER (ORDER BY s.TotalItemVenta DESC) as CumulativeSales,
                    t.GrandTotal,
                    pv.TotalItemVentaPrev
                FROM SalesByItem s
                CROSS JOIN TotalSales t
                LEFT JOIN PrevSalesByItem pv ON ${prevJoinCondition}
            ),
            ParetoResult AS (
                SELECT
                    p.*,
                    (p.CumulativeSales / CASE WHEN p.GrandTotal = 0 THEN 1 ELSE p.GrandTotal END) * 100 as CumulativePercentage,
                    (p.TotalItemVenta / CASE WHEN p.GrandTotal = 0 THEN 1 ELSE p.GrandTotal END) * 100 as IndividualPercentage,
                    ISNULL(p.TotalItemVentaPrev, 0) as VentaAnterior,
                    p.TotalItemVenta - ISNULL(p.TotalItemVentaPrev, 0) as VariacionImporte,
                    CASE
                        WHEN ISNULL(p.TotalItemVentaPrev, 0) = 0 THEN NULL
                        ELSE ((p.TotalItemVenta - p.TotalItemVentaPrev) / p.TotalItemVentaPrev) * 100
                    END as VariacionPct,
                    CASE WHEN p.TotalItemVentaPrev IS NULL THEN 1 ELSE 0 END as EsNuevo
                FROM ParetoCalculation p
            )
            SELECT *
            FROM ParetoResult
            ORDER BY TotalItemVenta DESC
        `;

        const rows = await query(sql);
        return NextResponse.json({
            rows,
            compare: { mode: compareWith, ...prev },
        });
    } catch (error) {
        console.error('Error in pareto-analysis API:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
