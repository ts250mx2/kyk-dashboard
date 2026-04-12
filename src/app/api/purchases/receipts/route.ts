import { NextResponse } from 'next/server';
import { mysqlQuery } from '@/lib/mysql';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const storeIdsStr = searchParams.get('storeIds');

    if (!startDate || !endDate) {
        return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
    }

    try {
        const storeIds = storeIdsStr ? storeIdsStr.split(',').map(Number).filter(n => !isNaN(n)) : [];
        let storeFilter = '';
        const params: any[] = [startDate, endDate + ' 23:59:59'];

        if (storeIds.length > 0) {
            storeFilter = ` AND A.IdTienda IN (${storeIds.map(() => '?').join(',')})`;
            params.push(...storeIds);
        }

        const sql = `
            SELECT A.IdReciboMovil, A.IdTienda, A.IdProveedor, A.FolioReciboMovil, A.FechaRecibo, A.IdReciboSAP, A.Numero, A.Total, A.UUID, A.DescuentosDevoluciones, 
            B.Proveedor, B.RFC AS RFCProveedor, C.Tienda, COUNT(D.IdInterfaceReciboSAP) AS CountInterfaceSAP, MAX(D.FechaAct) AS MaxFechaInterfaceSAP, 
            COUNT(E.IdAutorizacionSAP) AS CountAutorizacionSAP, MAX(E.FechaAutorizacionSAP) AS MaxFechaAutorizacionSAP, F.IdOrdenCompra,
            CASE WHEN COUNT(E.IdAutorizacionSAP) > 1 THEN CONCAT(CAST(COUNT(E.IdAutorizacionSAP) AS CHAR(2)),' Autorizadas') ELSE CASE WHEN A.IdReciboSAP > 0 OR COUNT(D.IdInterfaceReciboSAP) > 0 THEN 'Enviado SAP' ELSE CASE WHEN COUNT(E.IdAutorizacionSAP) = 0 THEN 'Sin Autorizar' ELSE 'Autorizado' END END END AS DescripcionAutorizacion, 
            CASE WHEN A.DescuentosDevoluciones = 0 THEN 'Sin Devoluciones' ELSE CASE WHEN COUNT(E.IdAutorizacionSAP) > 1 THEN CONCAT(CAST(COUNT(E.IdAutorizacionSAP) AS CHAR(2)),' Autorizadas') ELSE CASE WHEN A.IdDevolucionSAP > 0 OR COUNT(D.IdInterfaceReciboSAP) > 0 THEN 'Enviado SAP' ELSE CASE WHEN COUNT(E.IdAutorizacionSAP) = 0 THEN 'Sin Autorizar' ELSE 'Autorizado' END END END END AS DescripcionAutorizacionDevolucion, 
            CASE WHEN COUNT(E.IdAutorizacionSAP) > 1 THEN 2 ELSE CASE WHEN A.IdReciboSAP > 0 OR COUNT(D.IdInterfaceReciboSAP) > 0 THEN 99 ELSE CASE WHEN COUNT(E.IdAutorizacionSAP) = 0 THEN 0 ELSE 1 END END END AS StatusAutorizacion, 
            CASE WHEN A.DescuentosDevoluciones = 0 THEN -1 ELSE CASE WHEN COUNT(E.IdAutorizacionSAP) > 1 THEN 2 ELSE CASE WHEN A.IdDevolucionSAP > 0 OR COUNT(D.IdInterfaceReciboSAP) > 0 THEN 99 ELSE CASE WHEN COUNT(E.IdAutorizacionSAP) = 0 THEN 0 ELSE 1 END END END END AS StatusAutorizacionDevolucion 
            FROM tblReciboMovil A 
            INNER JOIN tblProveedores B ON A.IdProveedor = B.IdProveedor 
            INNER JOIN tblTiendas C ON A.IdTienda = C.IdTienda 
            LEFT JOIN tblInterfaceRecibosSAP D ON A.IdReciboMovil = D.IdReciboMovil AND A.IdTienda = D.IdTienda 
            LEFT JOIN tblAutorizacionesSAP E ON A.IdReciboMovil = E.IdReciboMovil AND A.IdTienda = E.IdTienda 
            LEFT JOIN tblOrdenesCompra F ON A.IdReciboMovil = F.IdReciboMovil AND A.IdTienda = F.IdTienda
            WHERE A.FechaRecibo >= ? AND A.FechaRecibo <= ? ${storeFilter}
            GROUP BY A.IdReciboMovil, A.IdTienda, A.IdProveedor, A.FolioReciboMovil, A.FechaRecibo, A.IdReciboSAP, A.Numero, A.Total, A.UUID, A.DescuentosDevoluciones, B.Proveedor, B.RFC, C.Tienda 
            ORDER BY FechaRecibo DESC
        `;

        const results = await mysqlQuery(sql, params);
        return NextResponse.json(results);
    } catch (error: any) {
        console.error('[Receipts List API] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
