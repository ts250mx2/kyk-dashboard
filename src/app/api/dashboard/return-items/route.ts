import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const idTienda = searchParams.get('idTienda');
        const idDevolucionVenta = searchParams.get('idDevolucionVenta');

        if (!idTienda || !idDevolucionVenta) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        const sql = `
            SELECT CAST(A.IdTienda AS VARCHAR(2)) + '-' + CAST(A.IdComputadora AS VARCHAR(2)) + '-' + CAST(A.IdVenta AS VARCHAR(10)) AS FolioVenta, A.FechaVenta AS [Fecha Venta],
            D.CodigoBarras AS [Codigo Barras], D.Descripcion, B.CantidadAnterior, B.Cantidad AS Dev, B.PrecioVenta, B.Cantidad*B.PrecioVenta AS Total
            FROM tblVentas A 
            INNER JOIN tblDetalleDevolucionesVenta B ON A.IdTienda = B.IdTienda AND A.IdComputadora = B.IdComputadora AND A.IdVenta = B.IdVenta
            INNER JOIN tblDevolucionesVenta C ON B.IdDevolucionVenta = C.IdDevolucionVenta AND B.IdTienda = C.IdTienda
            INNER JOIN tblArticulos D ON B.CodigoInterno = D.CodigoInterno
            WHERE B.IdDevolucionVenta = ${idDevolucionVenta} AND A.IdTienda = ${idTienda}
        `;

        const results = await query(sql);
        return NextResponse.json(results);

    } catch (error: any) {
        console.error('Error fetching return items:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
