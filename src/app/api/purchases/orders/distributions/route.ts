import { NextResponse } from 'next/server';
import { mysqlQuery } from '@/lib/mysql';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const idOrdenCompra = searchParams.get('idOrdenCompra');

    if (!idOrdenCompra) {
        return NextResponse.json({ error: 'Missing idOrdenCompra' }, { status: 400 });
    }

    try {
        const distributions = await mysqlQuery(`
            SELECT 
                A.IdOrdenCompra, 
                A.FechaOrdenCompra, 
                B.IdTiendaDestino, 
                D.Tienda AS TiendaDestino, 
                COUNT(B.CodigoInterno) AS CantidadArticulos, 
                CASE WHEN H.IdTransferenciaSalida IS NOT NULL THEN H.IdTransferenciaSalida ELSE C.IdTransferenciaSalida END AS IdTransferenciaSalida,
                CASE WHEN H.IdTransferenciaSalida IS NOT NULL THEN H.FolioSalida ELSE C.FolioSalida END AS FolioSalida,
                CASE WHEN H.IdTransferenciaSalida IS NOT NULL THEN H.FechaSalida ELSE C.FechaSalida END AS FechaSalida,
                E.Usuario AS UsuarioSalida,
                CASE WHEN H.IdTransferenciaSalida IS NOT NULL THEN 0 ELSE F.IdTransferenciaEntrada END AS IdTransferenciaEntrada,
                CASE WHEN H.IdTransferenciaSalida IS NOT NULL THEN 'ENTRO RECIBO' ELSE F.FolioEntrada END AS FolioEntrada,
                CASE WHEN H.IdTransferenciaSalida IS NOT NULL THEN H.FechaSalida ELSE F.FechaEntrada END AS FechaEntrada,
                G.Usuario AS UsuarioEntrada,
                CASE WHEN H.IdTransferenciaSalida IS NOT NULL THEN H.UUID ELSE NULL END AS UUID
            FROM tblOrdenesCompra A
            INNER JOIN tblDetalleDistribuciones B ON A.IdOrdenCompra = B.IdOrdenCompra
            LEFT JOIN tblTransferenciasSalidas C ON B.IdOrdenCompra = C.IdOrdenCompra AND B.IdTiendaDestino = C.IdTiendaDestino
            INNER JOIN tblTiendas D ON B.IdTiendaDestino = D.IdTienda
            LEFT JOIN tblUsuarios E ON C.IdUsuarioSalida = E.IdUsuario
            LEFT JOIN tblTransferenciasEntradas F ON C.IdTransferenciaEntrada = F.IdTransferenciaEntrada AND C.IdTiendaDestino = F.IdTienda
            LEFT JOIN tblUsuarios G ON F.IdUsuarioEntrada = G.IdUsuario
            LEFT JOIN tblTransferenciasSalidasFacturas H ON B.IdOrdenCompra = H.IdOrdenCompra AND B.IdTiendaDestino = H.IdTiendaDestino
            WHERE A.IdOrdenCompra = ?
            GROUP BY 
                A.IdOrdenCompra, A.FechaOrdenCompra, B.IdTiendaDestino, D.Tienda, C.IdTransferenciaSalida, C.FechaSalida, F.IdTransferenciaEntrada, F.FechaEntrada
            ORDER BY D.Tienda ASC
        `, [idOrdenCompra]);

        return NextResponse.json(distributions);
    } catch (error) {
        console.error('Error fetching distributions:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
