import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// On-demand endpoint for Department and Family sales breakdown charts.
// Called only when the user switches to the "Deptos" or "Familias" tab.
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const fechaInicio = searchParams.get('fechaInicio');
        const fechaFin = searchParams.get('fechaFin');
        const tipo = searchParams.get('tipo'); // 'departamento' | 'familia'
        const storeId = searchParams.get('storeId');

        if (!fechaInicio || !fechaFin || !tipo) {
            return NextResponse.json({ error: 'Missing parameters (fechaInicio, fechaFin, tipo)' }, { status: 400 });
        }

        const startStr = `'${fechaInicio} 00:00:00'`;
        const endStr = `'${fechaFin} 23:59:59'`;

        let storeFilter = '';
        if (storeId && storeId !== 'undefined' && storeId !== 'null') {
            storeFilter = `AND v.IdTienda = ${storeId}`;
        }

        let sql = '';

        if (tipo === 'departamento') {
            sql = `
                SELECT TOP 20 a.IdDepto, d.Depto AS Departamento,
                    SUM(dv.PrecioVenta*dv.Cantidad) as Total,
                    COUNT(*) as Operaciones,
                    SUM(dv.PrecioVenta*dv.Cantidad)/NULLIF(COUNT(*), 0) as TicketPromedio
                FROM tblVentas v
                JOIN tblDetalleVentas dv ON v.IdVenta = dv.IdVenta AND v.IdTienda = dv.IdTienda AND v.IdComputadora = dv.IdComputadora
                JOIN tblArticulos a ON dv.CodigoInterno = a.CodigoInterno
                JOIN tblDeptos d ON a.IdDepto = d.IdDepto
                WHERE v.FechaVenta >= ${startStr} AND v.FechaVenta <= ${endStr} ${storeFilter}
                GROUP BY a.IdDepto, d.Depto
                ORDER BY Total DESC
            `;
        } else if (tipo === 'familia') {
            sql = `
                SELECT TOP 20
                    CASE WHEN a.Familia = '' THEN 'Sin Familia' ELSE a.Familia END AS Familia,
                    SUM(dv.PrecioVenta*dv.Cantidad) as Total,
                    COUNT(*) as Operaciones,
                    SUM(dv.PrecioVenta*dv.Cantidad)/NULLIF(COUNT(*), 0) as TicketPromedio
                FROM tblVentas v
                JOIN tblDetalleVentas dv ON v.IdVenta = dv.IdVenta AND v.IdTienda = dv.IdTienda
                JOIN tblArticulos a ON dv.CodigoInterno = a.CodigoInterno
                WHERE v.FechaVenta >= ${startStr} AND v.FechaVenta <= ${endStr} ${storeFilter}
                GROUP BY a.Familia
                ORDER BY Total DESC
            `;
        } else {
            return NextResponse.json({ error: 'Invalid tipo parameter. Use "departamento" or "familia".' }, { status: 400 });
        }

        const result = await query(sql);
        return NextResponse.json({ data: result });

    } catch (error: any) {
        console.error('Error fetching ventas desglose:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
