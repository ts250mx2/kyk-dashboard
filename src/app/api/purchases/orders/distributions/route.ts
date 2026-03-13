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
                C.IdTransferenciaSalida, 
                C.FolioSalida, 
                C.FechaSalida, 
                E.Usuario AS UsuarioSalida,
                F.IdTransferenciaEntrada,
                F.FolioEntrada,
                F.FechaEntrada,
                G.Usuario AS UsuarioEntrada
            FROM tblOrdenesCompra A
            INNER JOIN tblDetalleDistribuciones B ON A.IdOrdenCompra = B.IdOrdenCompra
            LEFT JOIN tblTransferenciasSalidas C ON B.IdOrdenCompra = C.IdOrdenCompra AND B.IdTiendaDestino = C.IdTiendaDestino
            INNER JOIN tblTiendas D ON B.IdTiendaDestino = D.IdTienda
            LEFT JOIN tblUsuarios E ON C.IdUsuarioSalida = E.IdUsuario
            LEFT JOIN tblTransferenciasEntradas F ON C.IdTransferenciaEntrada = F.IdTransferenciaEntrada AND C.IdTiendaDestino = F.IdTienda
            LEFT JOIN tblUsuarios G ON F.IdUsuarioEntrada = G.IdUsuario
            WHERE A.IdOrdenCompra = ?
            GROUP BY 
                A.IdOrdenCompra, A.FechaOrdenCompra, B.IdTiendaDestino, D.Tienda, C.IdTransferenciaSalida, C.FechaSalida, F.FolioEntrada, F.FechaEntrada
            ORDER BY D.Tienda ASC
        `, [idOrdenCompra]);

        return NextResponse.json(distributions);
    } catch (error) {
        console.error('Error fetching distributions:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
