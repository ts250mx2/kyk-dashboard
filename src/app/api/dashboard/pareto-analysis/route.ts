import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const fechaInicio = searchParams.get('fechaInicio');
        const fechaFin = searchParams.get('fechaFin');
        const storeId = searchParams.get('storeId');
        const groupBy = searchParams.get('groupBy') || 'articulo';

        if (!fechaInicio || !fechaFin) {
            return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        const startStr = `'${fechaInicio} 00:00:00'`;
        const endStr = `'${fechaFin} 23:59:59'`;

        let storeFilter = '';
        if (storeId && storeId !== 'undefined' && storeId !== 'null') {
            storeFilter = `AND v.IdTienda = ${storeId}`;
        }

        let selectFields = '';
        let groupByFields = '';

        if (groupBy === 'departamento') {
            selectFields = `d.Depto as Descripcion, d.Depto as Departamento, '' as CodigoBarras, '' as Familia`;
            groupByFields = `d.Depto`;
        } else if (groupBy === 'familia') {
            selectFields = `ISNULL(NULLIF(a.Familia, ''), 'SIN FAMILIA') as Descripcion, '' as Departamento, '' as CodigoBarras, ISNULL(NULLIF(a.Familia, ''), 'SIN FAMILIA') as Familia`;
            groupByFields = `a.Familia`;
        } else {
            selectFields = `a.CodigoBarras, a.Descripcion, a.Familia, d.Depto as Departamento`;
            groupByFields = `a.CodigoBarras, a.Descripcion, a.Familia, d.Depto`;
        }

        const sql = `
            WITH SalesByItem AS (
                SELECT 
                    ${selectFields},
                    SUM(dv.PrecioVenta * dv.Cantidad) as TotalItemVenta,
                    SUM(dv.Cantidad) as CantidadVendida,
                    COUNT(DISTINCT v.IdVenta) as Operaciones
                FROM tblVentas v
                JOIN tblDetalleVentas dv ON v.IdVenta = dv.IdVenta AND v.IdTienda = dv.IdTienda AND v.IdComputadora = dv.IdComputadora
                JOIN tblArticulos a ON dv.CodigoInterno = a.CodigoInterno
                JOIN tblDeptos d ON a.IdDepto = d.IdDepto
                WHERE v.FechaVenta >= ${startStr} AND v.FechaVenta <= ${endStr}
                  ${storeFilter}
                GROUP BY ${groupByFields}
            ),
            TotalSales AS (
                SELECT SUM(TotalItemVenta) as GrandTotal FROM SalesByItem
            ),
            ParetoCalculation AS (
                SELECT 
                    s.*,
                    SUM(s.TotalItemVenta) OVER (ORDER BY s.TotalItemVenta DESC) as CumulativeSales,
                    t.GrandTotal
                FROM SalesByItem s, TotalSales t
            ),
            ParetoResult AS (
                SELECT 
                    p.*,
                    (p.CumulativeSales / CASE WHEN p.GrandTotal = 0 THEN 1 ELSE p.GrandTotal END) * 100 as CumulativePercentage,
                    (p.TotalItemVenta / CASE WHEN p.GrandTotal = 0 THEN 1 ELSE p.GrandTotal END) * 100 as IndividualPercentage
                FROM ParetoCalculation p
            )
            SELECT * 
            FROM ParetoResult 
            ORDER BY TotalItemVenta DESC
        `;

        const details = await query(sql);
        return NextResponse.json(details);
    } catch (error) {
        console.error('Error in pareto-analysis API:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
