import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const fechaInicio = searchParams.get('fechaInicio');
        const fechaFin = searchParams.get('fechaFin');
        const idDepto = searchParams.get('idDepto');
        const familia = searchParams.get('familia');
        const storeId = searchParams.get('storeId');
        const tipo = searchParams.get('tipo') || 'articulo'; // 'articulo' | 'familia'

        if (!fechaInicio || !fechaFin) {
            return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        const startStr = `'${fechaInicio} 00:00:00'`;
        const endStr = `'${fechaFin} 23:59:59'`;

        let storeFilter = '';
        if (storeId && storeId !== 'undefined' && storeId !== 'null') {
            storeFilter = `AND v.IdTienda = ${storeId}`;
        }

        let mainFilter = '';
        if (idDepto) {
            mainFilter = `AND a.IdDepto = ${idDepto}`;
        } else if (familia) {
            if (familia === 'Sin Familia') {
                mainFilter = `AND (a.Familia = '' OR a.Familia IS NULL)`;
            } else {
                mainFilter = `AND a.Familia = '${familia}'`;
            }
        }

        let sql = '';
        if (tipo === 'familia') {
            sql = `
                WITH FamilySales AS (
                    SELECT 
                        CASE WHEN a.Familia = '' OR a.Familia IS NULL THEN 'Sin Familia' ELSE a.Familia END AS Familia,
                        SUM(dv.PrecioVenta*dv.Cantidad) as Total, 
                        SUM(dv.Cantidad) as Cantidad, 
                        COUNT(*) as Operaciones, 
                        SUM(dv.PrecioVenta*dv.Cantidad)/NULLIF(COUNT(*), 0) as TicketPromedio
                    FROM tblVentas v
                    JOIN tblDetalleVentas dv ON v.IdVenta = dv.IdVenta AND v.IdTienda = dv.IdTienda AND v.IdComputadora = dv.IdComputadora
                    JOIN tblArticulos a ON dv.CodigoInterno = a.CodigoInterno
                    WHERE v.FechaVenta >= ${startStr} AND v.FechaVenta <= ${endStr} 
                      ${mainFilter}
                      ${storeFilter}
                    GROUP BY CASE WHEN a.Familia = '' OR a.Familia IS NULL THEN 'Sin Familia' ELSE a.Familia END
                ),
                TotalSales AS (
                    SELECT SUM(Total) as GrandTotal FROM FamilySales
                )
                SELECT 
                    s.*,
                    (s.Total / NULLIF(t.GrandTotal, 0)) * 100 as PorcentajeParticipacion,
                    SUM(s.Total) OVER (ORDER BY s.Total DESC) as CumulativeSales,
                    t.GrandTotal,
                    (SUM(s.Total) OVER (ORDER BY s.Total DESC) / NULLIF(t.GrandTotal, 0)) * 100 as PorcentajeAcumulado
                FROM FamilySales s, TotalSales t
                ORDER BY Total DESC
            `;
        } else {
            sql = `
                WITH ItemSales AS (
                    SELECT A.CodigoBarras, a.Descripcion, d.Depto AS Departamento, a.Familia, 
                           SUM(dv.PrecioVenta*dv.Cantidad) as Total, 
                           SUM(dv.Cantidad) as Cantidad, 
                           COUNT(*) as Operaciones, 
                           SUM(dv.PrecioVenta*dv.Cantidad)/COUNT(*) as TicketPromedio
                    FROM tblVentas v
                    JOIN tblDetalleVentas dv ON v.IdVenta = dv.IdVenta AND v.IdTienda = dv.IdTienda AND v.IdComputadora = dv.IdComputadora
                    JOIN tblArticulos a ON dv.CodigoInterno = a.CodigoInterno
                    JOIN tblDeptos d ON a.IdDepto = d.IdDepto
                    WHERE v.FechaVenta >= ${startStr} AND v.FechaVenta <= ${endStr} 
                      ${mainFilter}
                      ${storeFilter}
                    GROUP BY d.Depto, A.CodigoBarras, a.Descripcion, a.Familia
                ),
                TotalDepto AS (
                    SELECT SUM(Total) as GrandTotal FROM ItemSales
                ),
                Calculated AS (
                    SELECT 
                        s.*,
                        (s.Total / NULLIF(t.GrandTotal, 0)) * 100 as PorcentajeParticipacion,
                        SUM(s.Total) OVER (ORDER BY s.Total DESC) as CumulativeSales,
                        t.GrandTotal
                    FROM ItemSales s, TotalDepto t
                )
                SELECT 
                    *,
                    (CumulativeSales / NULLIF(GrandTotal, 0)) * 100 as PorcentajeAcumulado
                FROM Calculated
                ORDER BY Total DESC
            `;
        }

        const details = await query(sql);
        return NextResponse.json(details);
    } catch (error) {
        console.error('Error fetching department details:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
