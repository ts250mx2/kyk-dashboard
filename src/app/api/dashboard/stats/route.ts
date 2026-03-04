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

        // 1. Grouped Data for Chart/Details (We'll use these to calculate totals too)
        const chartDataVentasSql = `
            SELECT a.IdTienda, Tienda, SUM(Total) as Total, COUNT(*) as Operaciones, SUM(Total)/NULLIF(COUNT(*), 0) as TicketPromedio
            FROM tblVentas a
            JOIN tblTiendas t ON a.IdTienda = t.IdTienda
            WHERE FechaVenta >= ${startStr} AND FechaVenta <= ${endStr}
            GROUP BY a.IdTienda, Tienda
            ORDER BY Total DESC
        `;

        // 2. Aperturas (Openings started in range)
        const chartDataAperturasSql = `
            SELECT a.IdTienda, t.Tienda, COUNT(a.IdApertura) as Total
            FROM tblAperturasCierres a
            JOIN tblTiendas t ON a.IdTienda = t.IdTienda
            WHERE a.FechaApertura >= ${startStr} AND a.FechaApertura <= ${endStr}
            GROUP BY a.IdTienda, t.Tienda
            ORDER BY Total DESC
        `;

        const chartDataCancelacionesSql = `
            SELECT IdTienda, Tienda, SUM(Total) as Total, COUNT(*) as Cantidad, SUM(Total)/NULLIF(COUNT(*), 0) as Promedio
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

        // Execute core queries (5 queries - dept/family loaded on-demand)
        const [chartVentas, chartAperturas, chartCancelaciones, chartRetiros, chartDevoluciones] = await Promise.all([
            query(chartDataVentasSql),
            query(chartDataAperturasSql),
            query(chartDataCancelacionesSql),
            query(chartDataRetirosSql),
            query(chartDataDevolucionesSql)
        ]);

        // Calculate aggregate metrics from grouped data
        const totalVentas = (chartVentas as any[]).reduce((acc, curr) => acc + curr.Total, 0);
        const totalOps = (chartVentas as any[]).reduce((acc, curr) => acc + curr.Operaciones, 0);

        const totalAperturas = (chartAperturas as any[]).reduce((acc, curr) => acc + curr.Total, 0);

        const totalMontoCancel = (chartCancelaciones as any[]).reduce((acc, curr) => acc + (curr.Total || 0), 0);
        const totalCantCancel = (chartCancelaciones as any[]).reduce((acc, curr) => acc + (curr.Cantidad || 0), 0);

        const totalMontoRetiros = (chartRetiros as any[]).reduce((acc, curr) => acc + (curr.Total || 0), 0);
        const totalCantRetiros = (chartRetiros as any[]).reduce((acc, curr) => acc + (curr.Cantidad || 0), 0);

        const totalMontoDevols = (chartDevoluciones as any[]).reduce((acc, curr) => acc + (curr.Total || 0), 0);
        const totalCantDevols = (chartDevoluciones as any[]).reduce((acc, curr) => acc + (curr.Cantidad || 0), 0);

        return NextResponse.json({
            metrics: {
                ventas: {
                    TotalVentas: totalVentas,
                    Operaciones: totalOps,
                    TicketPromedio: totalOps > 0 ? totalVentas / totalOps : 0
                },
                aperturas: totalAperturas,
                cancelaciones: {
                    MontoCancelaciones: totalMontoCancel,
                    CantidadCancelaciones: totalCantCancel,
                    PromedioCancelacion: totalCantCancel > 0 ? totalMontoCancel / totalCantCancel : 0
                },
                retiros: {
                    MontoRetiros: totalMontoRetiros,
                    CantidadRetiros: totalCantRetiros,
                    PromedioRetiro: totalCantRetiros > 0 ? totalMontoRetiros / totalCantRetiros : 0
                },
                devoluciones: {
                    MontoDevoluciones: totalMontoDevols,
                    CantidadDevoluciones: totalCantDevols,
                    Promedio: totalCantDevols > 0 ? totalMontoDevols / totalCantDevols : 0
                }
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
