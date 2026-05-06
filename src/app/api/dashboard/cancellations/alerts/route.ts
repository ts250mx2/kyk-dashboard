import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const fechaInicio = searchParams.get('fechaInicio');
        const fechaFin = searchParams.get('fechaFin');

        if (!fechaInicio || !fechaFin) {
            return NextResponse.json({ error: 'Missing date parameters' }, { status: 400 });
        }

        const startStr = `'${fechaInicio} 00:00:00'`;
        const endStr = `'${fechaFin} 23:59:59'`;

        // 1. Time series for all stores combined (for the trend chart)
        const groupBy = searchParams.get('groupBy') || 'dia';
        let dateSelector = 'CAST(FechaCancelacion AS DATE)';
        if (groupBy === 'semana') {
            dateSelector = 'DATEADD(WEEK, DATEDIFF(WEEK, 0, FechaCancelacion), 0)';
        } else if (groupBy === 'mes') {
            dateSelector = 'DATEFROMPARTS(YEAR(FechaCancelacion), MONTH(FechaCancelacion), 1)';
        }

        const timeSeriesSql = `
            SELECT 
                ${dateSelector} as Fecha,
                SUM(vd.Cantidad * vd.PrecioVenta) as Total,
                COUNT(DISTINCT a.IdCancelacion) as Operaciones
            FROM tblCancelaciones a
            JOIN tblDetalleCancelaciones vd ON a.IdCancelacion = vd.IdCancelacion AND a.IdTienda = vd.IdTienda AND a.IdComputadora = vd.IdComputadora
            WHERE FechaCancelacion >= ${startStr} AND FechaCancelacion <= ${endStr}
            GROUP BY ${dateSelector}
            ORDER BY Fecha ASC
        `;

        // 2. Average cancellations per store (for the benchmark)
        const avgPerStoreSql = `
            SELECT 
                AVG(storeTotal) as PromedioTotalPorTienda,
                AVG(storeCantidad) as PromedioCantidadPorTienda,
                SUM(storeTotal) as GranTotal,
                SUM(storeCantidad) as GranCantidad,
                COUNT(*) as NumTiendas
            FROM (
                SELECT 
                    a.IdTienda,
                    SUM(vd.Cantidad * vd.PrecioVenta) as storeTotal,
                    COUNT(DISTINCT a.IdCancelacion) as storeCantidad
                FROM tblCancelaciones a
                JOIN tblDetalleCancelaciones vd ON a.IdCancelacion = vd.IdCancelacion AND a.IdTienda = vd.IdTienda AND a.IdComputadora = vd.IdComputadora
                WHERE FechaCancelacion >= ${startStr} AND FechaCancelacion <= ${endStr}
                GROUP BY a.IdTienda
            ) sub
        `;

        // 3. Top 10 cajeros with most cancellations
        const topCajerosSql = `
            SELECT TOP 10
                D.IdUsuario,
                D.Usuario AS Cajero,
                E.Tienda,
                COUNT(DISTINCT A.IdCancelacion) AS Cantidad,
                SUM(B.PrecioVenta * B.Cantidad) AS Total,
                SUM(B.PrecioVenta * B.Cantidad) / NULLIF(COUNT(DISTINCT A.IdCancelacion), 0) AS PromedioCancelacion
            FROM tblCancelaciones A
            INNER JOIN tblDetalleCancelaciones B ON A.IdTienda = B.IdTienda AND A.IdComputadora = B.IdComputadora AND A.IdCancelacion = B.IdCancelacion
            INNER JOIN tblAperturasCierres C ON A.IdTienda = C.IdTienda AND A.IdComputadora = C.IdComputadora AND A.IdApertura = C.IdApertura
            INNER JOIN tblUsuarios D ON C.IdCajero = D.IdUsuario
            INNER JOIN tblTiendas E ON A.IdTienda = E.IdTienda
            WHERE FechaCancelacion >= ${startStr} AND FechaCancelacion <= ${endStr}
            GROUP BY D.IdUsuario, D.Usuario, E.Tienda
            ORDER BY SUM(B.PrecioVenta * B.Cantidad) DESC
        `;

        // 4. Top 10 supervisors who authorize the most cancellations
        const topSupervisoresSql = `
            SELECT TOP 10
                D.IdUsuario,
                D.Usuario AS Supervisor,
                E.Tienda,
                COUNT(DISTINCT A.IdCancelacion) AS Cantidad,
                SUM(B.PrecioVenta * B.Cantidad) AS Total,
                SUM(B.PrecioVenta * B.Cantidad) / NULLIF(COUNT(DISTINCT A.IdCancelacion), 0) AS PromedioCancelacion
            FROM tblCancelaciones A
            INNER JOIN tblDetalleCancelaciones B ON A.IdTienda = B.IdTienda AND A.IdComputadora = B.IdComputadora AND A.IdCancelacion = B.IdCancelacion
            INNER JOIN tblUsuarios D ON A.IdSupervisor = D.IdUsuario
            INNER JOIN tblTiendas E ON A.IdTienda = E.IdTienda
            WHERE FechaCancelacion >= ${startStr} AND FechaCancelacion <= ${endStr}
            GROUP BY D.IdUsuario, D.Usuario, E.Tienda
            ORDER BY SUM(B.PrecioVenta * B.Cantidad) DESC
        `;

        // 5. Cancellations per store
        const perStoreSql = `
            SELECT 
                E.IdTienda, E.Tienda,
                COUNT(DISTINCT A.IdCancelacion) AS Cantidad,
                SUM(B.PrecioVenta * B.Cantidad) AS Total,
                SUM(B.PrecioVenta * B.Cantidad) / NULLIF(COUNT(DISTINCT A.IdCancelacion), 0) AS PromedioCancelacion
            FROM tblCancelaciones A
            INNER JOIN tblDetalleCancelaciones B ON A.IdTienda = B.IdTienda AND A.IdComputadora = B.IdComputadora AND A.IdCancelacion = B.IdCancelacion
            INNER JOIN tblTiendas E ON A.IdTienda = E.IdTienda
            WHERE FechaCancelacion >= ${startStr} AND FechaCancelacion <= ${endStr}
            GROUP BY E.IdTienda, E.Tienda
            ORDER BY Total DESC
        `;

        // 6. Hourly cancellation patterns
        const hourlySql = `
            SELECT 
                DATEPART(hour, FechaCancelacion) as Hora,
                COUNT(DISTINCT A.IdCancelacion) as Cantidad,
                SUM(B.PrecioVenta * B.Cantidad) as Total
            FROM tblCancelaciones A
            INNER JOIN tblDetalleCancelaciones B ON A.IdTienda = B.IdTienda AND A.IdComputadora = B.IdComputadora AND A.IdCancelacion = B.IdCancelacion
            WHERE FechaCancelacion >= ${startStr} AND FechaCancelacion <= ${endStr}
            GROUP BY DATEPART(hour, FechaCancelacion)
            ORDER BY Hora
        `;

        const [timeSeries, avgPerStore, topCajeros, topSupervisores, perStore, hourly] = await Promise.all([
            query(timeSeriesSql),
            query(avgPerStoreSql),
            query(topCajerosSql),
            query(topSupervisoresSql),
            query(perStoreSql),
            query(hourlySql)
        ]);

        return NextResponse.json({
            timeSeries,
            avgPerStore: avgPerStore[0] || { PromedioTotalPorTienda: 0, PromedioCantidadPorTienda: 0, GranTotal: 0, GranCantidad: 0, NumTiendas: 0 },
            topCajeros,
            topSupervisores,
            perStore,
            hourly
        });

    } catch (error: any) {
        console.error('Cancellation Alerts API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
