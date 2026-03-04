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
            WHERE [Fecha Cancelacion] >= ${startStr} AND [Fecha Cancelacion] <= ${endStr}
        `;

        // 4. Retiros
        const withdrawalsSql = `
            SELECT 
                ISNULL(SUM(Monto), 0) as MontoRetiros,
                COUNT(*) as CantidadRetiros,
                ISNULL(SUM(Monto)/NULLIF(COUNT(*), 0), 0) as PromedioRetiro
            FROM Retiros
            WHERE [Fecha Retiro] >= ${startStr} AND [Fecha Retiro] <= ${endStr}
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
            WHERE [Fecha Cancelacion] >= ${startStr} AND [Fecha Cancelacion] <= ${endStr}
            GROUP BY IdTienda, Tienda
            ORDER BY Total DESC
        `;

        const chartDataRetirosSql = `
            SELECT IdTienda, Tienda, SUM(Monto) as Total, COUNT(*) as Cantidad, ISNULL(SUM(Monto)/NULLIF(COUNT(*), 0), 0) as Promedio
            FROM Retiros
            WHERE [Fecha Retiro] >= ${startStr} AND [Fecha Retiro] <= ${endStr}
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

        const storeId = searchParams.get('storeId');
        let storeFilter = '';
        if (storeId && storeId !== 'undefined' && storeId !== 'null') {
            storeFilter = `AND v.IdTienda = ${storeId}`;
        }

        const chartDataVentasDeptoSql = `
            SELECT a.IdDepto, d.Depto AS Departamento, SUM(dv.PrecioVenta*dv.Cantidad) as Total, COUNT(*) as Operaciones, SUM(dv.PrecioVenta*dv.Cantidad)/COUNT(*) as TicketPromedio
            FROM tblVentas v
            JOIN tblDetalleVentas dv ON v.IdVenta = dv.IdVenta AND v.IdTienda = dv.IdTienda AND v.IdComputadora = dv.IdComputadora 
            JOIN tblArticulos a ON dv.CodigoInterno = a.CodigoInterno
            JOIN tblDeptos d ON a.IdDepto = d.IdDepto
            WHERE v.FechaVenta >= ${startStr} AND v.FechaVenta <= ${endStr} ${storeFilter}
            GROUP BY a.IdDepto, d.Depto
            ORDER BY Total DESC
        `;

        const chartDataVentasFamiliaSql = `
            SELECT TOP 20 CASE WHEN a.Familia = '' THEN 'Sin Familia' ELSE a.Familia END AS Familia, SUM(dv.PrecioVenta*dv.Cantidad) as Total, COUNT(*) as Operaciones, SUM(dv.PrecioVenta*dv.Cantidad)/COUNT(*) as TicketPromedio
            FROM tblVentas v
            JOIN tblDetalleVentas dv ON v.IdVenta = dv.IdVenta AND v.IdTienda = dv.IdTienda
            JOIN tblArticulos a ON dv.CodigoInterno = a.CodigoInterno
            WHERE v.FechaVenta >= ${startStr} AND v.FechaVenta <= ${endStr} ${storeFilter}
            GROUP BY a.Familia
            ORDER BY Total DESC
        `;

        const [sales, openings, cancelaciones, withdrawals, returns, chartVentas, chartVentasDepto, chartVentasFamilia, chartAperturas, chartCancelaciones, chartRetiros, chartDevoluciones] = await Promise.all([
            query(salesSql),
            query(openingsSql),
            query(cancelacionesSql),
            query(withdrawalsSql),
            query(returnsSql),
            query(chartDataVentasSql),
            query(chartDataVentasDeptoSql),
            query(chartDataVentasFamiliaSql),
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
                retiros: withdrawals[0] || { MontoRetiros: 0, CantidadRetiros: 0, PromedioRetiro: 0 },
                devoluciones: returns[0] || { MontoDevoluciones: 0, CantidadDevoluciones: 0 }
            },
            data: {
                ventas: chartVentas,
                ventas_depto: chartVentasDepto,
                ventas_familia: chartVentasFamilia,
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
