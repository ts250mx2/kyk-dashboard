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

        const sql = `
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

        const details = await query(sql);
        return NextResponse.json(details);
    } catch (error) {
        console.error('Error fetching department details:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
