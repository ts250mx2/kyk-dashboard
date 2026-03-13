import { NextResponse } from 'next/server';
import { mysqlQuery } from '@/lib/mysql';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const idOrdenCompra = searchParams.get('idOrdenCompra');
    const idTiendaDestino = searchParams.get('idTiendaDestino');
    const idTransferenciaSalida = searchParams.get('idTransferenciaSalida');
    const idTiendaOrdenCompra = searchParams.get('idTiendaOrdenCompra'); // Origin store

    if (!idOrdenCompra || !idTiendaDestino) {
        return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    try {
        let query = '';
        let params = [];

        if (idTransferenciaSalida === '0' || !idTransferenciaSalida) {
            query = `
                SELECT 
                    A.Cantidad, 
                    B.MedidaCompra, 
                    A.PiezasPedido AS Piezas, 
                    'PZS' AS MedidaPiezas, 
                    B.CodigoBarras, 
                    B.Descripcion 
                FROM tblDetalleDistribuciones A
                INNER JOIN tblArticulosSAP B ON A.CodigoInterno = B.CodigoInterno
                WHERE A.IdOrdenCompra = ? AND A.IdTiendaDestino = ?
            `;
            params = [idOrdenCompra, idTiendaDestino];
        } else {
            // Case where we have a formal transfer
            query = `
                SELECT 
                    A.Mov AS CantidadSalida, 
                    B.MedidaVenta AS Medida, 
                    A.PiezasPedido AS PiezasPedido, 
                    A.PiezasRecibo AS PiezasRecibo, 
                    'PZS' AS MedidaPiezas,
                    B.CodigoBarras, 
                    B.Descripcion, 
                    A.Costo, 
                    A.Mov * A.Costo AS Total
                FROM tblDetalleTransferenciasSalidas A
                INNER JOIN tblArticulosSAP B ON A.CodigoInterno = B.CodigoInterno
                WHERE A.IdTransferenciaSalida = ? AND A.IdTienda = ?
            `;
            params = [idTransferenciaSalida, idTiendaOrdenCompra];
        }

        const items = await mysqlQuery(query, params);
        return NextResponse.json(items);
    } catch (error) {
        console.error('Error fetching distribution details:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
