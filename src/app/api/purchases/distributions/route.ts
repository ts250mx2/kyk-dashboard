import { NextResponse } from 'next/server';
import { mysqlQuery } from '@/lib/mysql';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const storeIdsStr = searchParams.get('storeIds');
    const status = searchParams.get('status');

    if (!startDate || !endDate) {
        return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
    }

    try {
        const storeIds = storeIdsStr ? storeIdsStr.split(',').map(Number).filter(n => !isNaN(n)) : [];
        let storeFilter = '';
        const params: (string | number)[] = [startDate, endDate];

        if (storeIds.length > 0) {
            storeFilter = ` AND A.IdTienda IN (${storeIds.map(() => '?').join(',')})`;
            params.push(...storeIds);
        }

        // Build status filter for the outer query
        let outerStatusFilter = '';
        if (status === 'PENDIENTE_RECIBO') outerStatusFilter = "AND Recibo.FolioReciboMovil IS NULL";
        if (status === 'PENDIENTE_SALIDA') outerStatusFilter = "AND Recibo.FolioReciboMovil IS NOT NULL AND C.IdTransferenciaSalida IS NULL AND H.IdTransferenciaSalida IS NULL";
        if (status === 'PENDIENTE_ENTRADA') outerStatusFilter = "AND (C.IdTransferenciaSalida IS NOT NULL OR H.IdTransferenciaSalida IS NOT NULL) AND (F.FolioEntrada IS NULL OR F.FolioEntrada = '' OR F.FolioEntrada = 'ENTRO RECIBO')";

        const sql = `
            SELECT STRAIGHT_JOIN
                A.IdOrdenCompra,
                A.FechaOrdenCompra,
                A.IdTienda AS IdTiendaOrigen,
                TiendaOrigen.Tienda AS TiendaOrigen,
                Prov.Proveedor,
                Status.StatusOrdenCompra AS Status,
                TipoOrden.TipoOrdenCompra,
                A.TotalPedido,
                A.CantPedido AS Ordenados,
                Recibo.FolioReciboMovil,
                Recibo.FechaRecibo,
                Recibo.UUID AS UUIDRecibo,
                UsuRecibo.Usuario AS UsuarioRecibo,
                B.IdTiendaDestino,
                TiendaDest.Tienda AS TiendaDestino,
                COUNT(B.CodigoInterno) AS CantidadArticulos,
                COALESCE(H.IdTransferenciaSalida, C.IdTransferenciaSalida) AS IdTransferenciaSalida,
                COALESCE(H.FolioSalida, C.FolioSalida) AS FolioSalida,
                COALESCE(H.FechaSalida, C.FechaSalida) AS FechaSalida,
                UsuSalida.Usuario AS UsuarioSalida,
                CASE WHEN H.IdTransferenciaSalida IS NOT NULL THEN 0 ELSE F.IdTransferenciaEntrada END AS IdTransferenciaEntrada,
                CASE WHEN H.IdTransferenciaSalida IS NOT NULL THEN 'ENTRO RECIBO' ELSE F.FolioEntrada END AS FolioEntrada,
                CASE WHEN H.IdTransferenciaSalida IS NOT NULL THEN H.FechaSalida ELSE F.FechaEntrada END AS FechaEntrada,
                UsuEntrada.Usuario AS UsuarioEntrada,
                COALESCE(H.UUID, C.UUID) AS UUID,
                CASE WHEN H.IdTransferenciaSalida IS NOT NULL THEN 1 ELSE 0 END AS EsTransferenciaFactura
            FROM tblOrdenesCompra A
            INNER JOIN tblTiendas TiendaOrigen ON A.IdTienda = TiendaOrigen.IdTienda
            INNER JOIN tblProveedores Prov ON A.IdProveedor = Prov.IdProveedor
            INNER JOIN tblStatusOrdenesCompra Status ON A.IdStatusOrdenCompra = Status.IdStatusOrdenCompra
            INNER JOIN tblTiposOrdenesCompra TipoOrden ON A.IdTipoOrdenCompra = TipoOrden.IdTipoOrdenCompra
            INNER JOIN tblDetalleDistribuciones B ON A.IdOrdenCompra = B.IdOrdenCompra
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
              ${outerStatusFilter}
            GROUP BY A.IdOrdenCompra, B.IdTiendaDestino
            ORDER BY A.FechaOrdenCompra DESC, TiendaOrigen ASC, TiendaDestino ASC
        `;

        const fullParams = [startDate, endDate, ...storeIds];
        const results = await mysqlQuery(sql, fullParams);
        return NextResponse.json(results);
    } catch (error) {
        console.error('Error fetching cedis distributions:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
