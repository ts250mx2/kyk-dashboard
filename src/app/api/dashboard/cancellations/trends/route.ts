import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const fechaInicio = searchParams.get('fechaInicio');
        const fechaFin = searchParams.get('fechaFin');
        const idTienda = searchParams.get('idTienda');
        const idDepto = searchParams.get('idDepto');
        const familia = searchParams.get('familia');
        const codigoInterno = searchParams.get('codigoInterno');
        const idProveedor = searchParams.get('idProveedor');

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

        // Additional Filters
        let detailFilters = '';
        
        // Cancellations ALWAYS need details to calculate Total (Quantity * Price)
        const needsDetails = true; 

        if (idDepto) {
            const ids = idDepto.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
            if (ids.length > 0) {
                detailFilters += ` AND art.IdDepto IN (${ids.join(',')})`;
            }
        }
        if (familia) {
            const values = familia.split(',').map(f => `'${f.replace(/'/g, "''").trim()}'`);
            if (values.length > 0) {
                detailFilters += ` AND art.Familia IN (${values.join(',')})`;
            }
        }
        if (codigoInterno) {
            const ids = codigoInterno.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
            if (ids.length > 0) {
                detailFilters += ` AND vd.CodigoInterno IN (${ids.join(',')})`;
            }
        }
        if (idProveedor) {
            const ids = idProveedor.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
            if (ids.length > 0) {
                const idList = ids.join(',');
                detailFilters += ` AND (art.IdProveedorDefault IN (${idList}) OR EXISTS (SELECT 1 FROM tblArticulosProveedor ap WHERE ap.CodigoInterno = vd.CodigoInterno AND ap.IdProveedor IN (${idList})))`;
            }
        }

        const groupBy = searchParams.get('groupBy') || 'dia';

        let dateSelector = 'CAST(FechaCancelacion AS DATE)';
        if (groupBy === 'semana') {
            dateSelector = 'DATEADD(WEEK, DATEDIFF(WEEK, 0, FechaCancelacion), 0)';
        } else if (groupBy === 'mes') {
            dateSelector = 'DATEFROMPARTS(YEAR(FechaCancelacion), MONTH(FechaCancelacion), 1)';
        }

        const isMulti = idTienda && idTienda !== 'all' && idTienda.includes(',');
        const storeFields = isMulti ? ', a.IdTienda, t.Tienda' : '';
        const storeJoin = isMulti ? 'LEFT JOIN tblTiendas t ON a.IdTienda = t.IdTienda' : '';
        const storeGrouping = isMulti ? ', a.IdTienda, t.Tienda' : '';

        const fromClause = `tblCancelaciones a 
               JOIN tblDetalleCancelaciones vd ON a.IdCancelacion = vd.IdCancelacion AND a.IdTienda = vd.IdTienda AND a.IdComputadora = vd.IdComputadora
               JOIN tblArticulos art ON vd.CodigoInterno = art.CodigoInterno`;

        const selectTotal = 'SUM(vd.Cantidad * vd.PrecioVenta)';
        const selectOps = 'COUNT(DISTINCT a.IdCancelacion)';

        const timeSeriesSql = `
            SELECT 
                ${dateSelector} as Fecha,
                ${selectTotal} as Total,
                ${selectOps} as Operaciones
                ${storeFields}
            FROM ${fromClause}
            ${storeJoin}
            WHERE FechaCancelacion >= ${startStr} AND FechaCancelacion <= ${endStr}
            ${storeFilter}
            ${detailFilters}
            GROUP BY ${dateSelector} ${storeGrouping}
            ORDER BY Fecha ASC
        `;

        // Comparison Period
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
                SELECT a.IdTienda, ${selectTotal} as Total
                FROM ${fromClause}
                WHERE FechaCancelacion >= ${startStr} AND FechaCancelacion <= ${endStr}
                ${detailFilters}
                GROUP BY a.IdTienda
            ) currentSales ON t.IdTienda = currentSales.IdTienda
            LEFT JOIN (
                SELECT a.IdTienda, ${selectTotal} as Total
                FROM ${fromClause}
                WHERE FechaCancelacion >= ${prevStartStr} AND FechaCancelacion <= ${prevEndStr}
                ${detailFilters}
                GROUP BY a.IdTienda
            ) prevSales ON t.IdTienda = prevSales.IdTienda
            WHERE t.IdTienda IN (SELECT DISTINCT IdTienda FROM tblCancelaciones WHERE FechaCancelacion >= ${prevStartStr} AND FechaCancelacion <= ${endStr})
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
        console.error('Cancellation Trends API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
