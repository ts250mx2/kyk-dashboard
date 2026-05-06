import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { fechaInicio, fechaFin, idTienda, groupBy = 'dia', groupA, groupB } = body;

        if (!fechaInicio || !fechaFin) {
            return NextResponse.json({ error: 'Missing date parameters' }, { status: 400 });
        }

        const startStr = `'${fechaInicio} 00:00:00'`;
        const endStr = `'${fechaFin} 23:59:59'`;

        let storeFilter = '';
        const params: any[] = [];
        if (idTienda && idTienda !== 'all') {
            const ids = typeof idTienda === 'string' 
                ? idTienda.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
                : idTienda;
            if (ids.length > 0) {
                storeFilter = ` AND a.IdTienda IN (${ids.join(',')})`;
            }
        }

        const buildFilters = (group: any) => {
            let detailFilters = '';
            let needsDetails = false;

            if (group.idDepto && group.idDepto.length > 0) {
                detailFilters += ` AND art.IdDepto IN (${group.idDepto.join(',')})`;
                needsDetails = true;
            }
            if (group.familia && group.familia.length > 0) {
                const values = group.familia.map((f: string) => `'${f.replace(/'/g, "''").trim()}'`);
                detailFilters += ` AND art.Familia IN (${values.join(',')})`;
                needsDetails = true;
            }
            if (group.codigoInterno && group.codigoInterno.length > 0) {
                detailFilters += ` AND vd.CodigoInterno IN (${group.codigoInterno.join(',')})`;
                needsDetails = true;
            }
            if (group.idProveedor && group.idProveedor.length > 0) {
                const idList = group.idProveedor.join(',');
                detailFilters += ` AND (art.IdProveedorDefault IN (${idList}) OR EXISTS (SELECT 1 FROM tblArticulosProveedor ap WHERE ap.CodigoInterno = vd.CodigoInterno AND ap.IdProveedor IN (${idList})))`;
                needsDetails = true;
            }

            return { detailFilters, needsDetails };
        };

        const filtersA = buildFilters(groupA);
        const filtersB = buildFilters(groupB);

        let dateSelector = 'CAST(FechaVenta AS DATE)';
        if (groupBy === 'semana') {
            dateSelector = 'DATEADD(WEEK, DATEDIFF(WEEK, 0, FechaVenta), 0)';
        } else if (groupBy === 'mes') {
            dateSelector = 'DATEFROMPARTS(YEAR(FechaVenta), MONTH(FechaVenta), 1)';
        }

        const buildGroupQuery = (filters: any, groupName: string) => {
            const fromClause = filters.needsDetails 
                ? `tblVentas a 
                   JOIN tblDetalleVentas vd ON a.IdVenta = vd.IdVenta AND a.IdTienda = vd.IdTienda AND a.IdComputadora = vd.IdComputadora
                   JOIN tblArticulos art ON vd.CodigoInterno = art.CodigoInterno`
                : 'tblVentas a';

            const selectTotal = filters.needsDetails ? 'SUM(vd.Cantidad * vd.PrecioVenta)' : 'SUM(a.Total)';
            const selectOps = filters.needsDetails ? 'COUNT(DISTINCT a.IdVenta)' : 'COUNT(*)';

            return `
                SELECT 
                    ${dateSelector} as Fecha,
                    '${groupName}' as GroupName,
                    ISNULL(${selectTotal}, 0) as Total,
                    ${selectOps} as Operaciones
                FROM ${fromClause}
                WHERE FechaVenta >= ${startStr} AND FechaVenta <= ${endStr}
                ${storeFilter}
                ${filters.detailFilters}
                GROUP BY ${dateSelector}
            `;
        };

        const sqlA = buildGroupQuery(filtersA, 'Grupo A');
        const sqlB = buildGroupQuery(filtersB, 'Grupo B');

        const [resultsA, resultsB] = await Promise.all([
            query(sqlA),
            query(sqlB)
        ]);

        return NextResponse.json({
            groupA: resultsA,
            groupB: resultsB
        });

    } catch (error: any) {
        console.error('Sales Comparison API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
