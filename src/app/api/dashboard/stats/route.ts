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

        // 1. Ventas, Operaciones, Ticket Promedio
        const salesSql = `
            SELECT 
                ISNULL(SUM(Total), 0) as TotalVentas, 
                COUNT(IdVenta) AS Operaciones, SUM(Total)/COUNT(IdVenta) AS TicketPromedio
            FROM tblVentas
            WHERE FechaVenta >= ${startStr} AND FechaVenta <= ${endStr}
        `;

        // 2. Aperturas (Openings started in range)
        const openingsSql = `
            SELECT COUNT(*) as TotalAperturas
            FROM tblAperturasCierres
            WHERE FechaApertura >= ${startStr} AND FechaApertura <= ${endStr}
        `;

        // 3. Cancelaciones
        const cancelacionesSql = `
            SELECT SUM(Total) as MontoCancelaciones, COUNT(IdCancelacion) as CantidadCancelaciones, SUM(Total)/COUNT(IdCancelacion) as PromedioCancelacion
            FROM Cancelaciones 
            WHERE FechaCancelacion >= ${startStr} AND FechaCancelacion <= ${endStr}
        `;

        // 4. Retiros
        const withdrawalsSql = `
            SELECT ISNULL(SUM(Monto), 0) as MontoRetiros
            FROM Retiros
            WHERE Fecha >= ${startStr} AND Fecha <= ${endStr}
        `;

        const returnsSql = `
            SELECT ISNULL(SUM(A.Cantidad*A.PrecioVenta), 0) AS MontoDevoluciones, COUNT(A.CodigoInterno) AS CantidadDevoluciones
            FROM tblDetalleDevolucionesVenta A
            INNER JOIN tblDevolucionesVenta B ON A.IdDevolucionVenta = B.IdDevolucionVenta AND A.IdTienda = B.IdTienda
            WHERE A.Cantidad > 0 AND B.FechaDevolucionVenta >= ${startStr} AND B.FechaDevolucionVenta <= ${endStr}
        `;

        // 6. Grouped Data for Chart/Details
        const chartDataVentasSql = `
            SELECT a.IdTienda, Tienda, SUM(Total) as Total, COUNT(*) as Operaciones, SUM(Total)/COUNT(*) as TicketPromedio
            FROM tblVentas a
            JOIN tblTiendas t ON a.IdTienda = t.IdTienda
            WHERE FechaVenta >= ${startStr} AND FechaVenta <= ${endStr}
            GROUP BY a.IdTienda, Tienda
            ORDER BY Total DESC
        `;

        const chartDataAperturasSql = `
            SELECT a.IdTienda, t.Tienda, COUNT(a.IdApertura) as Total
            FROM tblAperturasCierres a
            JOIN tblTiendas t ON a.IdTienda = t.IdTienda
            WHERE a.FechaApertura >= ${startStr} AND a.FechaApertura <= ${endStr}
            GROUP BY a.IdTienda, t.Tienda
            ORDER BY Total DESC
        `;

        const chartDataCancelacionesSql = `
            SELECT IdTienda, Tienda, SUM(Total) as Total, COUNT(*) as Cantidad, SUM(Total)/COUNT(*) as Promedio
            FROM Cancelaciones
            WHERE FechaCancelacion >= ${startStr} AND FechaCancelacion <= ${endStr}
            GROUP BY IdTienda, Tienda
            ORDER BY Total DESC
        `;

        const chartDataRetirosSql = `
            SELECT IdTienda, Tienda, SUM(Monto) as Total
            FROM Retiros
            WHERE Fecha >= ${startStr} AND Fecha <= ${endStr}
            GROUP BY IdTienda, Tienda
            ORDER BY Total DESC
        `;

        const chartDataDevolucionesSql = `
            SELECT B.IdTienda, T.Tienda, SUM(A.Cantidad*A.PrecioVenta) AS Total, COUNT(A.CodigoInterno) AS Cantidad, 
            ISNULL(SUM(A.Cantidad*A.PrecioVenta)/NULLIF(COUNT(A.CodigoInterno), 0), 0) AS Promedio
            FROM tblDetalleDevolucionesVenta A
            INNER JOIN tblDevolucionesVenta B ON A.IdDevolucionVenta = B.IdDevolucionVenta AND A.IdTienda = B.IdTienda
            INNER JOIN tblTiendas T ON B.IdTienda = T.IdTienda
            WHERE A.Cantidad > 0 AND B.FechaDevolucionVenta >= ${startStr} AND B.FechaDevolucionVenta <= ${endStr}
            GROUP BY B.IdTienda, T.Tienda
            ORDER BY Total DESC
        `;

        const [sales, openings, cancelaciones, withdrawals, returns, chartVentas, chartAperturas, chartCancelaciones, chartRetiros, chartDevoluciones] = await Promise.all([
            query(salesSql),
            query(openingsSql),
            query(cancelacionesSql),
            query(withdrawalsSql),
            query(returnsSql),
            query(chartDataVentasSql),
            query(chartDataAperturasSql),
            query(chartDataCancelacionesSql),
            query(chartDataRetirosSql),
            query(chartDataDevolucionesSql)
        ]);

        return NextResponse.json({
            metrics: {
                ventas: sales[0] || { TotalVentas: 0, Operaciones: 0, TicketPromedio: 0 },
                aperturas: openings[0]?.TotalAperturas || 0,
                cancelaciones: cancelaciones[0] || { MontoCancelaciones: 0, CantidadCancelaciones: 0 },
                retiros: withdrawals[0]?.MontoRetiros || 0,
                devoluciones: returns[0] || { MontoDevoluciones: 0, CantidadDevoluciones: 0 }
            },
            data: {
                ventas: chartVentas,
                aperturas: chartAperturas,
                cancelaciones: chartCancelaciones,
                retiros: chartRetiros,
                devoluciones: chartDevoluciones
            }
        });

    } catch (error: any) {
        console.error('Error fetching dashboard stats:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
