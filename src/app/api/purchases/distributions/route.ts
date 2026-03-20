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
        const params: (string | number)[] = [startDate, endDate, startDate, endDate, startDate, endDate];

        if (storeIds.length > 0) {
            storeFilter = ` AND A.IdTienda IN (${storeIds.map(() => '?').join(',')})`;
            params.push(...storeIds);
        }

        const sql = `
            SELECT 
                A.IdOrdenCompra,
                A.FechaOrdenCompra,
                TiendaOrigen.Tienda AS TiendaOrigen,
                Prov.Proveedor,
                Status.StatusOrdenCompra AS Status,
                TipoOrden.TipoOrdenCompra,
                Recibo.FolioReciboMovil,
                Recibo.FechaRecibo,
                Recibo.UUID AS UUIDRecibo,
                UsuRecibo.Usuario AS UsuarioRecibo,
                B.IdTiendaDestino,
                TiendaDest.Tienda AS TiendaDestino,
                COUNT(B.CodigoInterno) AS CantidadArticulos,
                CASE WHEN H.IdTransferenciaSalida IS NOT NULL THEN H.IdTransferenciaSalida ELSE C.IdTransferenciaSalida END AS IdTransferenciaSalida,
                CASE WHEN H.IdTransferenciaSalida IS NOT NULL THEN H.FolioSalida ELSE C.FolioSalida END AS FolioSalida,
                CASE WHEN H.IdTransferenciaSalida IS NOT NULL THEN H.FechaSalida ELSE C.FechaSalida END AS FechaSalida,
                UsuSalida.Usuario AS UsuarioSalida,
                CASE WHEN H.IdTransferenciaSalida IS NOT NULL THEN 0 ELSE F.IdTransferenciaEntrada END AS IdTransferenciaEntrada,
                CASE WHEN H.IdTransferenciaSalida IS NOT NULL THEN 'ENTRO RECIBO' ELSE F.FolioEntrada END AS FolioEntrada,
                CASE WHEN H.IdTransferenciaSalida IS NOT NULL THEN H.FechaSalida ELSE F.FechaEntrada END AS FechaEntrada,
                UsuEntrada.Usuario AS UsuarioEntrada,
                CASE WHEN H.IdTransferenciaSalida IS NOT NULL THEN H.UUID ELSE NULL END AS UUID,
                A.IdTienda AS IdTiendaOrigen,
                TotOC.TotalPedido,
                TotOC.Ordenados,
                TotRec.TotalRecibo,
                TotRec.Recibidos
            FROM tblOrdenesCompra A
            INNER JOIN (
                SELECT Det.IdOrdenCompra,
                       SUM(Det.Cantidad * Det.Costo * (1-Det.Desc0)*(1-Det.Desc1)*(1-Det.Desc2)*(1-Det.Desc3)*(1-Det.Desc4)*(CASE WHEN Det.FactorVolumen = 0 THEN 1 ELSE Det.FactorVolumen END)*(1+Art.IEPS)*(1+Det.IVA)) AS TotalPedido,
                       SUM(CASE WHEN Det.Cantidad > 0 THEN 1 ELSE 0 END) AS Ordenados
                FROM tblDetalleOrdenesCompra Det
                INNER JOIN tblArticulosSAP Art ON Det.CodigoInterno = Art.CodigoInterno
                WHERE Det.IdOrdenCompra IN (SELECT IdOrdenCompra FROM tblOrdenesCompra WHERE FechaOrdenCompra >= ? AND FechaOrdenCompra <= CONCAT(?, ' 23:59:59'))
                GROUP BY Det.IdOrdenCompra
            ) TotOC ON A.IdOrdenCompra = TotOC.IdOrdenCompra
            LEFT JOIN (
                SELECT Det.IdReciboMovil, Det.IdTienda,
                       SUM(CASE WHEN Det.Devolucion = 0 THEN Det.Rec * Det.Costo * (1-Det.Desc0)*(1-Det.Desc1)*(1-Det.Desc2)*(1-Det.Desc3)*(1-Det.Desc4)*(CASE WHEN Det.Factor = 0 THEN 1 ELSE Det.Factor END)* (1+Det.IEPS) * (1+Det.IVA) ELSE 0 END) AS TotalRecibo,
                       SUM(CASE WHEN Det.Devolucion = 0 THEN 1 ELSE 0 END) AS Recibidos
                FROM tblDetalleReciboMovil Det
                WHERE Det.IdReciboMovil IN (SELECT IdReciboMovil FROM tblReciboMovil WHERE FechaRecibo >= ? AND FechaRecibo <= CONCAT(?, ' 23:59:59'))
                GROUP BY Det.IdReciboMovil, Det.IdTienda
            ) TotRec ON A.IdReciboMovil = TotRec.IdReciboMovil AND A.IdTienda = TotRec.IdTienda
            INNER JOIN tblDetalleDistribuciones B ON A.IdOrdenCompra = B.IdOrdenCompra
            INNER JOIN tblTiendas TiendaOrigen ON A.IdTienda = TiendaOrigen.IdTienda
            INNER JOIN tblProveedores Prov ON A.IdProveedor = Prov.IdProveedor
            INNER JOIN tblStatusOrdenesCompra Status ON A.IdStatusOrdenCompra = Status.IdStatusOrdenCompra
            INNER JOIN tblTiposOrdenesCompra TipoOrden ON A.IdTipoOrdenCompra = TipoOrden.IdTipoOrdenCompra
            INNER JOIN tblTiendas TiendaDest ON B.IdTiendaDestino = TiendaDest.IdTienda
            LEFT JOIN tblReciboMovil Recibo ON A.IdReciboMovil = Recibo.IdReciboMovil AND A.IdTienda = Recibo.IdTienda
            LEFT JOIN tblUsuarios UsuRecibo ON Recibo.IdUsuarioRecibo = UsuRecibo.IdUsuario
            LEFT JOIN tblTransferenciasSalidas C ON B.IdOrdenCompra = C.IdOrdenCompra AND B.IdTiendaDestino = C.IdTiendaDestino
            LEFT JOIN tblUsuarios UsuSalida ON C.IdUsuarioSalida = UsuSalida.IdUsuario
            LEFT JOIN tblTransferenciasEntradas F ON C.IdTransferenciaEntrada = F.IdTransferenciaEntrada AND C.IdTiendaDestino = F.IdTienda
            LEFT JOIN tblUsuarios UsuEntrada ON F.IdUsuarioEntrada = UsuEntrada.IdUsuario
            LEFT JOIN tblTransferenciasSalidasFacturas H ON B.IdOrdenCompra = H.IdOrdenCompra AND B.IdTiendaDestino = H.IdTiendaDestino
            WHERE A.TieneDistribucion = 1
              AND A.FechaOrdenCompra >= ?
              AND A.FechaOrdenCompra <= CONCAT(?, ' 23:59:59')
              ${storeFilter}
            GROUP BY
                A.IdOrdenCompra, A.FechaOrdenCompra, TiendaOrigen.Tienda, Prov.Proveedor,
                Status.StatusOrdenCompra, TipoOrden.TipoOrdenCompra,
                Recibo.FolioReciboMovil, Recibo.FechaRecibo, Recibo.UUID, UsuRecibo.Usuario,
                B.IdTiendaDestino, TiendaDest.Tienda,
                C.IdTransferenciaSalida, C.FolioSalida, C.FechaSalida, UsuSalida.Usuario,
                F.IdTransferenciaEntrada, F.FolioEntrada, F.FechaEntrada, UsuEntrada.Usuario,
                H.IdTransferenciaSalida, H.FolioSalida, H.FechaSalida, H.UUID,
                A.IdTienda,
                TotOC.TotalPedido, TotOC.Ordenados, TotRec.TotalRecibo, TotRec.Recibidos
            ORDER BY A.FechaOrdenCompra DESC, TiendaOrigen.Tienda ASC, TiendaDest.Tienda ASC
        `;

        const results = await mysqlQuery(sql, params);
        return NextResponse.json(results);
    } catch (error) {
        console.error('Error fetching cedis distributions:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
