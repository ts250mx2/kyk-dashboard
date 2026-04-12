import { NextResponse } from 'next/server';
import { mysqlQuery } from '@/lib/mysql';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate') ? `${searchParams.get('endDate')} 23:59:59` : null;
    const storeId = searchParams.get('storeId');
    const metric = searchParams.get('metric') || 'compras';

    if (!startDate || !endDate) {
        return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
    }

    try {
        let sql = '';
        let params: any[] = [startDate, endDate];
        const storeFilter = storeId ? ' AND A.IdTienda = ?' : '';
        if (storeId) params.push(storeId);

        if (metric === 'compras' || metric === 'devoluciones') {
            const devFilter = metric === 'devoluciones' ? ' AND A.Devolucion = 1' : ' AND A.Devolucion = 0';
            sql = `
                SELECT A.*, A.FolioReciboMovil as FolioRecibo, B.Proveedor, B.RFC AS RFCProveedor, C.Tienda 
                FROM tblReciboMovil A 
                INNER JOIN tblProveedores B ON A.IdProveedor = B.IdProveedor 
                INNER JOIN tblTiendas C ON A.IdTienda = C.IdTienda 
                WHERE A.FechaRecibo >= ? AND A.FechaRecibo <= ?  ${storeFilter}
                ORDER BY A.FechaRecibo DESC
            `;
        } else if (metric === 'transferenciasSalida') {
            sql = `
                SELECT 
                    A.FolioSalida as FolioRecibo, 
                    A.FechaSalida as FechaRecibo, 
                    C.Tienda,
                    'TR-SALIDA' as Proveedor,
                    '' as RFC,
                    A.IdTransferenciaSalida as IdReciboSAP,
                    A.FolioSalida as Numero,
                    SUM(B.Costo * B.Mov) as Total,
                    '' as UUID
                FROM tblTransferenciasSalidas A
                INNER JOIN tblDetalleTransferenciasSalidas B ON A.IdTransferenciaSalida = B.IdTransferenciaSalida AND A.IdTienda = B.IdTienda
                INNER JOIN tblTiendas C ON A.IdTienda = C.IdTienda
                WHERE A.FechaSalida >= ? AND A.FechaSalida <= ? ${storeFilter}
                GROUP BY A.IdTransferenciaSalida, A.IdTienda
                ORDER BY A.FechaSalida DESC
            `;
        } else if (metric === 'transferenciasEntrada') {
            // Filter by IdTiendaDestino
            const destStoreFilter = storeId ? ' AND A.IdTiendaDestino = ?' : '';
            sql = `
                SELECT 
                    A.FolioEntrada as FolioRecibo, 
                    A.FechaEntrada as FechaRecibo, 
                    C.Tienda,
                    'TR-ENTRADA' as Proveedor,
                    '' as RFC,
                    A.IdTransferenciaSalida as IdReciboSAP,
                    A.FolioEntrada as Numero,
                    SUM(B.Costo * B.Mov) as Total,
                    '' as UUID
                FROM tblTransferenciasSalidas A
                INNER JOIN tblDetalleTransferenciasSalidas B ON A.IdTransferenciaSalida = B.IdTransferenciaSalida AND A.IdTienda = B.IdTienda
                INNER JOIN tblTiendas C ON A.IdTiendaDestino = C.IdTienda
                WHERE A.FechaEntrada >= ? AND A.FechaEntrada <= ? ${destStoreFilter}
                GROUP BY A.IdTransferenciaSalida, A.IdTiendaDestino
                ORDER BY A.FechaEntrada DESC
            `;
        } else {
            return NextResponse.json({ error: 'Invalid metric' }, { status: 400 });
        }

        const rows: any = await mysqlQuery(sql, params);
        return NextResponse.json(rows);
    } catch (error: any) {
        console.error('Purchases Details Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
