import { NextResponse } from 'next/server';
import { mysqlQuery } from '@/lib/mysql';

// In-memory cache: key → { data, expiresAt }
const cache = new Map<string, { data: unknown; expiresAt: number }>();
const CACHE_TTL_MS = 60_000; // 60 seconds

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const storeIdsStr = searchParams.get('storeIds') ?? '';
    const status = searchParams.get('status') ?? 'TODOS';
    const force = searchParams.get('force') === '1';

    if (!startDate || !endDate) {
        return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
    }

    // Cache key includes all params that affect results
    const cacheKey = `${startDate}|${endDate}|${storeIdsStr}|${status}`;
    const cached = cache.get(cacheKey);
    if (!force && cached && cached.expiresAt > Date.now()) {
        return NextResponse.json(cached.data);
    }

    try {
        const storeIds = storeIdsStr ? storeIdsStr.split(',').map(Number).filter(n => !isNaN(n)) : [];
        const params: (string | number)[] = [startDate, endDate];

        let storeFilter = '';
        if (storeIds.length > 0) {
            storeFilter = ` AND A.IdTienda IN (${storeIds.map(() => '?').join(',')})`;
            params.push(...storeIds);
        }

        // Server-side status filter
        let outerStatusFilter = '';
        if (status === 'PENDIENTE_RECIBO') outerStatusFilter = "AND Recibo.FolioReciboMovil IS NULL";
        if (status === 'PENDIENTE_SALIDA') outerStatusFilter = "AND Recibo.FolioReciboMovil IS NOT NULL AND C.IdTransferenciaSalida IS NULL AND H.IdTransferenciaSalida IS NULL";
        if (status === 'PENDIENTE_ENTRADA') outerStatusFilter = "AND (C.IdTransferenciaSalida IS NOT NULL OR H.IdTransferenciaSalida IS NOT NULL) AND (F.FolioEntrada IS NULL OR F.FolioEntrada = '' OR F.FolioEntrada = 'ENTRO RECIBO')";

        // Architectural SQL Optimization:
        // Pre-aggregate DetalleDistribuciones BEFORE joining to prevent massive Cartesian products
        // with the outer joins (Salidas/Entradas/Recibos/Facturas).
        // By pushing the date filter down into subquery B, we avoid scanning the entire historical table.
        const sql = `
            SELECT
                A.IdOrdenCompra,
                A.FechaOrdenCompra,
                A.IdTiendaOrigen,
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
                B.CantidadArticulos,
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
            FROM (
                SELECT IdOrdenCompra, FechaOrdenCompra, IdTienda AS IdTiendaOrigen, IdProveedor,
                       IdStatusOrdenCompra, IdTipoOrdenCompra, TotalPedido,
                       CantPedido, IdReciboMovil
                FROM tblOrdenesCompra
                WHERE TieneDistribucion = 1
                  AND FechaOrdenCompra >= ?
                  AND FechaOrdenCompra <= CONCAT(?, ' 23:59:59')
                  ${storeFilter}
            ) A
            
            /* FILTERED PRE-AGGREGATION: Only aggregate DetalleDistribuciones for the matching orders */
            INNER JOIN (
                SELECT DD.IdOrdenCompra, DD.IdTiendaDestino, COUNT(DD.CodigoInterno) AS CantidadArticulos
                FROM tblDetalleDistribuciones DD
                INNER JOIN tblOrdenesCompra OC ON DD.IdOrdenCompra = OC.IdOrdenCompra
                WHERE OC.TieneDistribucion = 1
                  AND OC.FechaOrdenCompra >= ?
                  AND OC.FechaOrdenCompra <= CONCAT(?, ' 23:59:59')
                GROUP BY DD.IdOrdenCompra, DD.IdTiendaDestino
            ) B ON A.IdOrdenCompra = B.IdOrdenCompra
            
            INNER JOIN tblTiendas TiendaOrigen ON A.IdTiendaOrigen = TiendaOrigen.IdTienda
            INNER JOIN tblProveedores Prov ON A.IdProveedor = Prov.IdProveedor
            INNER JOIN tblStatusOrdenesCompra Status ON A.IdStatusOrdenCompra = Status.IdStatusOrdenCompra
            INNER JOIN tblTiposOrdenesCompra TipoOrden ON A.IdTipoOrdenCompra = TipoOrden.IdTipoOrdenCompra
            INNER JOIN tblTiendas TiendaDest ON B.IdTiendaDestino = TiendaDest.IdTienda
            LEFT JOIN tblReciboMovil Recibo ON A.IdReciboMovil = Recibo.IdReciboMovil AND A.IdTiendaOrigen = Recibo.IdTienda
            LEFT JOIN tblUsuarios UsuRecibo ON Recibo.IdUsuarioRecibo = UsuRecibo.IdUsuario
            LEFT JOIN tblTransferenciasSalidas C ON A.IdOrdenCompra = C.IdOrdenCompra AND B.IdTiendaDestino = C.IdTiendaDestino
            LEFT JOIN tblUsuarios UsuSalida ON C.IdUsuarioSalida = UsuSalida.IdUsuario
            LEFT JOIN tblTransferenciasEntradas F ON C.IdTransferenciaEntrada = F.IdTransferenciaEntrada AND C.IdTiendaDestino = F.IdTienda
            LEFT JOIN tblUsuarios UsuEntrada ON F.IdUsuarioEntrada = UsuEntrada.IdUsuario
            LEFT JOIN tblTransferenciasSalidasFacturas H ON A.IdOrdenCompra = H.IdOrdenCompra AND B.IdTiendaDestino = H.IdTiendaDestino
            ${outerStatusFilter ? `WHERE 1=1 ${outerStatusFilter}` : ''}
            ORDER BY A.FechaOrdenCompra DESC, TiendaOrigen ASC, TiendaDestino ASC
        `;

        // We use the date params twice now (once in A, once in B)
        // so we need to inject them again into the array exactly where B is evaluated.
        // The original params array had [startDate, endDate, ...storeIds]
        // B comes AFTER A but BEFORE outerStatusFilter.
        // Actually since storeFilter has positional params for storeIds, we must construct the params carefully.
        
        let finalParams: (string | number)[] = [];
        finalParams.push(startDate, endDate); // For A
        if (storeIds.length > 0) finalParams.push(...storeIds); // For A storeFilter
        finalParams.push(startDate, endDate); // For B

        const results = await mysqlQuery(sql, finalParams);

        // Store in cache for 60s
        cache.set(cacheKey, { data: results, expiresAt: Date.now() + CACHE_TTL_MS });

        return NextResponse.json(results);
    } catch (error) {
        console.error('Error fetching cedis distributions:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
