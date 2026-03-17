import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const fechaInicio = searchParams.get('fechaInicio');
        const fechaFin = searchParams.get('fechaFin');
        const idTienda = searchParams.get('idTienda');

        if (!fechaInicio || !fechaFin) {
            return NextResponse.json({ error: 'Missing date parameters' }, { status: 400 });
        }

        const startStr = `'${fechaInicio} 00:00:00'`;
        const endStr = `'${fechaFin} 23:59:59'`;

        let whereClause = `WHERE FechaVenta >= ${startStr} AND FechaVenta <= ${endStr}`;
        if (idTienda && idTienda !== 'all') {
            whereClause += ` AND IdTienda = ${parseInt(idTienda)}`;
        }

        // We use DATEPART(WEEKDAY, FechaVenta) and DATEPART(HOUR, FechaVenta)
        // SET DATEFIRST 7 is standard but let's be explicit if needed. 
        // In SQL Server, 1=Sunday, 2=Monday... 7=Saturday (depending on DATEFIRST)
        const sql = `
            SET DATEFIRST 7;
            SELECT 
                DATEPART(WEEKDAY, FechaVenta) as DiaSemana,
                DATEPART(HOUR, FechaVenta) as Hora,
                SUM(Total) as TotalVentas,
                COUNT(*) as CantidadTickets
            FROM tblVentas
            ${whereClause}
            GROUP BY DATEPART(WEEKDAY, FechaVenta), DATEPART(HOUR, FechaVenta)
            ORDER BY DiaSemana, Hora
        `;

        const results = await query(sql);

        // Also fetch only stores that actually had sales in this period for the sidebar
        // CRITICAL: This list should only depend on the date range, NOT on idTienda filter
        const storesWhere = `WHERE FechaVenta >= ${startStr} AND FechaVenta <= ${endStr}`;
        const storesSql = `
            SELECT DISTINCT t.IdTienda, t.Tienda 
            FROM tblVentas v
            JOIN tblTiendas t ON v.IdTienda = t.IdTienda
            ${storesWhere.replace(/FechaVenta/g, 'v.FechaVenta')}
            ORDER BY t.Tienda
        `;
        const stores = await query(storesSql);

        return NextResponse.json({ 
            data: results,
            stores: stores
        });

    } catch (error: any) {
        console.error('Error fetching heatmap data:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
