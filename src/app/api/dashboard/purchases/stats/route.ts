import { NextResponse } from 'next/server';
import { mysqlQuery } from '@/lib/mysql';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate') ? `${searchParams.get('endDate')} 23:59:59` : null;

    if (!startDate || !endDate) {
        console.log('[Purchases Stats API] Missing dates:', { startDate, endDate });
        return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
    }

    console.log('[Purchases Stats API] Fetching stats for:', { startDate, endDate });

    const storeId = searchParams.get('storeId');

    try {
        const params = [startDate, endDate];

        // 1. Compras (Always get all stores for the breakdown)
        const purchasesSql = `
            SELECT 
                B.Tienda, 
                A.IdTienda, 
                SUM(A.TotalRecibo) AS Total, 
                COUNT(A.IdReciboMovil) AS Operaciones 
            FROM tblReciboMovil A
            INNER JOIN tblTiendas B ON A.IdTienda = B.IdTienda
            WHERE A.FechaRecibo >= ? AND A.FechaRecibo <= ?
            GROUP BY B.Tienda, A.IdTienda
            ORDER BY Total DESC
        `;
        const purchasesRows: any = await mysqlQuery(purchasesSql, params);

        // 2. Devoluciones (Always get all stores)
        const returnsSql = `
            SELECT 
                C.Tienda,
                A.IdTienda,
                SUM(B.Rec * B.Costo) AS Total, 
                COUNT(DISTINCT A.FolioReciboMovil) AS Operaciones 
            FROM tblReciboMovil A
            INNER JOIN tblDetalleReciboMovil B ON A.IdTienda = B.IdTienda AND A.IdReciboMovil = B.IdReciboMovil
            INNER JOIN tblTiendas C ON A.IdTienda = C.IdTienda
            WHERE B.Devolucion = 1 AND A.FechaRecibo >= ? AND A.FechaRecibo <= ?
            GROUP BY C.Tienda, A.IdTienda
            ORDER BY Total DESC
        `;
        const returnsRows: any = await mysqlQuery(returnsSql, params);

        // 3. Transferencias Salida (Always get all stores)
        const transfersOutSql = `
            SELECT 
                C.Tienda,
                A.IdTienda,
                SUM(B.Costo * B.Mov) AS Total, 
                COUNT(DISTINCT A.FolioSalida) AS Operaciones 
            FROM tblTransferenciasSalidas A
            INNER JOIN tblDetalleTransferenciasSalidas B ON A.IdTransferenciaSalida = B.IdTransferenciaSalida AND A.IdTienda = B.IdTienda
            INNER JOIN tblTiendas C ON A.IdTienda = C.IdTienda
            WHERE A.FechaSalida >= ? AND A.FechaSalida <= ?
            GROUP BY C.Tienda, A.IdTienda
            ORDER BY Total DESC
        `;
        const transfersOutRows: any = await mysqlQuery(transfersOutSql, params);

        // 4. Transferencias Entrada (Always get all stores)
        const transfersInSql = `
            SELECT 
                C.Tienda,
                A.IdTiendaDestino as IdTienda,
                SUM(B.Costo * B.Mov) AS Total, 
                COUNT(DISTINCT A.FolioEntrada) AS Operaciones 
            FROM tblTransferenciasSalidas A
            INNER JOIN tblDetalleTransferenciasSalidas B ON A.IdTransferenciaSalida = B.IdTransferenciaSalida AND A.IdTienda = B.IdTienda
            INNER JOIN tblTiendas C ON A.IdTiendaDestino = C.IdTienda
            WHERE A.FechaEntrada >= ? AND A.FechaEntrada <= ?
            GROUP BY C.Tienda, A.IdTiendaDestino
            ORDER BY Total DESC
        `;
        const transfersInRows: any = await mysqlQuery(transfersInSql, params);

        // Helper to filter and sum rows for KPIs
        const filterAndSum = (rows: any[], id: string | null) => {
            const filtered = id ? rows.filter(r => r.IdTienda.toString() === id) : rows;
            return {
                total: filtered.reduce((acc, row) => acc + (row.Total || 0), 0),
                operaciones: filtered.reduce((acc, row) => acc + (row.Operaciones || 0), 0)
            };
        };

        const response = {
            kpis: {
                compras: filterAndSum(purchasesRows, null),
                devoluciones: filterAndSum(returnsRows, null),
                transferenciasSalida: filterAndSum(transfersOutRows, null),
                transferenciasEntrada: filterAndSum(transfersInRows, null)
            },
            data: {
                compras: purchasesRows,
                devoluciones: returnsRows,
                transferenciasSalida: transfersOutRows,
                transferenciasEntrada: transfersInRows
            }
        };

        return NextResponse.json(response);
    } catch (error: any) {
        console.error('Purchases Stats Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
