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
        
        let storeFilter = '';
        const params: any[] = [];
        if (idTienda && idTienda !== 'all') {
            const ids = idTienda.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
            if (ids.length > 0) {
                const placeholders = ids.map((_, i) => `@p${i}`).join(',');
                storeFilter = ` AND a.IdTienda IN (${placeholders})`;
                ids.forEach(id => params.push(id));
            }
        }

        const groupBy = searchParams.get('groupBy') || 'dia';

        let dateSelector = 'CAST(FechaVenta AS DATE)';
        if (groupBy === 'semana') {
            // Group by start of week (Monday)
            dateSelector = 'DATEADD(WEEK, DATEDIFF(WEEK, 0, FechaVenta), 0)';
        } else if (groupBy === 'mes') {
            // Group by start of month
            dateSelector = 'DATEFROMPARTS(YEAR(FechaVenta), MONTH(FechaVenta), 1)';
        }

        // 1. Time Series Data
        // If multi-selection, we need to group by store to show multiple lines
        const isMulti = idTienda && idTienda !== 'all' && idTienda.includes(',');
        const storeFields = isMulti ? ', a.IdTienda, t.Tienda' : '';
        const storeJoin = isMulti ? 'LEFT JOIN tblTiendas t ON a.IdTienda = t.IdTienda' : '';
        const storeGrouping = isMulti ? ', a.IdTienda, t.Tienda' : '';

        const timeSeriesSql = `
            SELECT 
                ${dateSelector} as Fecha,
                SUM(Total) as Total,
                COUNT(*) as Operaciones
                ${storeFields}
            FROM tblVentas a
            ${storeJoin}
            WHERE FechaVenta >= ${startStr} AND FechaVenta <= ${endStr}
            ${storeFilter}
            GROUP BY ${dateSelector} ${storeGrouping}
            ORDER BY Fecha ASC
        `;

        // 2. Branch Breakdown and Trends
        // We compare the selected period with the immediately preceding period of the same length
        const diffDays = Math.ceil((new Date(fechaFin).getTime() - new Date(fechaInicio).getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const prevStart = new Date(fechaInicio);
        prevStart.setDate(prevStart.getDate() - diffDays);
        const prevEnd = new Date(fechaInicio);
        prevEnd.setDate(prevEnd.getDate() - 1);

        const prevStartStr = `'${prevStart.toISOString().split('T')[0]} 00:00:00'`;
        const prevEndStr = `'${prevEnd.toISOString().split('T')[0]} 23:59:59'`;

        const branchTrendsSql = `
            SELECT 
                t.IdTienda,
                t.Tienda,
                ISNULL(currentSales.Total, 0) as CurrentTotal,
                ISNULL(prevSales.Total, 0) as PrevTotal,
                CASE 
                    WHEN ISNULL(prevSales.Total, 0) = 0 THEN 0 
                    ELSE ((ISNULL(currentSales.Total, 0) - prevSales.Total) / prevSales.Total) * 100 
                END as TrendPercentage
            FROM tblTiendas t
            LEFT JOIN (
                SELECT IdTienda, SUM(Total) as Total
                FROM tblVentas
                WHERE FechaVenta >= ${startStr} AND FechaVenta <= ${endStr}
                GROUP BY IdTienda
            ) currentSales ON t.IdTienda = currentSales.IdTienda
            LEFT JOIN (
                SELECT IdTienda, SUM(Total) as Total
                FROM tblVentas
                WHERE FechaVenta >= ${prevStartStr} AND FechaVenta <= ${prevEndStr}
                GROUP BY IdTienda
            ) prevSales ON t.IdTienda = prevSales.IdTienda
            WHERE t.IdTienda IN (SELECT DISTINCT IdTienda FROM tblVentas WHERE FechaVenta >= ${prevStartStr} AND FechaVenta <= ${endStr})
            ORDER BY CurrentTotal DESC
        `;

        const [timeSeries, branchTrends] = await Promise.all([
            query(timeSeriesSql, params),
            query(branchTrendsSql)
        ]);

        return NextResponse.json({
            timeSeries,
            branchTrends,
            comparisonPeriod: {
                start: prevStart.toISOString().split('T')[0],
                end: prevEnd.toISOString().split('T')[0]
            }
        });

    } catch (error: any) {
        console.error('Sales Trends API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
