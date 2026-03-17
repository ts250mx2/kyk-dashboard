import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const fecha = searchParams.get('fecha'); // Expects YYYY-MM-DD

        if (!fecha) {
            return NextResponse.json({ error: 'Missing date parameter' }, { status: 400 });
        }

        const startStr = `'${fecha} 00:00:00'`;
        const endStr = `'${fecha} 23:59:59'`;

        // 1. Stores with metrics (KPIs)
        const storesSql = `
            SELECT B.IdTienda, B.Tienda, 
                   ISNULL(A.TotalAperturas, 0) as aperturas,
                   ISNULL(V.TotalVentas, 0) as ventas,
                   ISNULL(V.Operaciones, 0) as ventasCount,
                   CASE WHEN ISNULL(V.Operaciones, 0) > 0 THEN ISNULL(V.TotalVentas, 0) / V.Operaciones ELSE 0 END as ticketPromedio
            FROM tblTiendas B
            INNER JOIN (
                SELECT IdTienda, COUNT(DISTINCT IdApertura) as TotalAperturas
                FROM tblAperturasCierres
                WHERE FechaApertura >= ${startStr} AND FechaApertura <= ${endStr}
                GROUP BY IdTienda
            ) A ON B.IdTienda = A.IdTienda
            LEFT JOIN (
                SELECT IdTienda, SUM(Total) as TotalVentas, COUNT(*) as Operaciones
                FROM tblVentas
                WHERE FechaVenta >= ${startStr} AND FechaVenta <= ${endStr}
                GROUP BY IdTienda
            ) V ON B.IdTienda = V.IdTienda
            ORDER BY B.Tienda
        `;

        // 2. Detailed Openings & Closures (Includes Supervisor and Closing Time)
        const openingsSql = `
            SELECT A.IdTienda, A.IdApertura, 
                   CAST(A.IdComputadora AS VARCHAR(2)) + '-' + CAST(A.IdApertura AS VARCHAR(6)) AS [Z],
                   CONVERT(VARCHAR(5), A.FechaApertura, 108) as HoraApertura, 
                   A.FechaApertura AS RawFechaApertura, A.FechaCierre AS RawFechaCierre,
                   CONVERT(VARCHAR(5), A.FechaCierre, 108) as HoraCierre, A.IdComputadora AS Caja, 
                   C.Usuario AS Cajero, SUM(Total) AS Total, COUNT(IdVenta) AS Operaciones, D.Usuario AS Supervisor
            FROM tblAperturasCierres A 
            INNER JOIN tblVentas B ON A.IdApertura = B.IdApertura AND A.IdComputadora = B.IdComputadora AND A.IdTienda = B.IdTienda
            INNER JOIN tblUsuarios C ON A.IdCajero = C.IdUsuario
            LEFT JOIN tblUsuarios D ON A.IdSupervisorCierre = D.IdUsuario
            WHERE FechaApertura >= ${startStr} AND FechaApertura <= ${endStr}
            GROUP BY A.IdTienda, A.IdApertura, A.IdComputadora, C.Usuario, A.FechaApertura, A.FechaCierre, D.Usuario
            ORDER BY A.IdComputadora
        `;

        // 3. Cancellations (Grouped by Opening to align them)
        const cancellationsSql = `
            SELECT A.IdTienda, IdApertura, A.IdComputadora, COUNT(*) as Cantidad, SUM(B.PrecioVenta*B.Cantidad) as Monto
            FROM tblCancelaciones A
            INNER JOIN tblDetalleCancelaciones B ON A.IdTienda = B.IdTienda AND A.IdComputadora = B.IdComputadora AND A.IdCancelacion = B.IdCancelacion
            WHERE FechaCancelacion >= ${startStr} AND FechaCancelacion <= ${endStr}
            GROUP BY A.IdTienda, IdApertura, A.IdComputadora
        `;

        const [stores, openingDetails, cancellations] = await Promise.all([
            query(storesSql),
            query(openingsSql),
            query(cancellationsSql)
        ]);

        const storesList = stores as any[];
        const openingDetailsList = openingDetails as any[];
        const cancellationsList = cancellations as any[];

        const result = storesList.map(store => {
            const storeOpenings = openingDetailsList.filter(o => o.IdTienda === store.IdTienda);

            // Map openings with their respective cancellations
            const detailedOpenings = storeOpenings.map(op => {
                const cancel = cancellationsList.find(c =>
                    c.IdTienda === store.IdTienda &&
                    c.IdApertura === op.IdApertura &&
                    c.IdComputadora === op.Caja
                );

                return {
                    ...op,
                    cancelaciones: cancel?.Cantidad || 0,
                    cancelacionesMonto: cancel?.Monto || 0
                };
            });

            return {
                id: store.IdTienda,
                name: store.Tienda,
                aperturas: store.aperturas,
                ventas: store.ventas,
                ventasCount: store.ventasCount,
                ticketPromedio: store.ticketPromedio,
                details: {
                    openings: detailedOpenings,
                    // Store-level aggregates for the KPI card
                    cancelaciones: detailedOpenings.reduce((acc, curr) => acc + curr.cancelaciones, 0),
                    cancelacionesMonto: detailedOpenings.reduce((acc, curr) => acc + curr.cancelacionesMonto, 0),
                    cortes: detailedOpenings.filter(op => op.HoraCierre && op.Supervisor).length
                }
            };
        });

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('Error fetching operations data:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
