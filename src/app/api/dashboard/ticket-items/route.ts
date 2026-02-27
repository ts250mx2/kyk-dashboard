import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const idTienda = searchParams.get('idTienda');
        const idCaja = searchParams.get('idCaja');
        const idVenta = searchParams.get('idVenta');

        if (!idTienda || !idCaja || !idVenta) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        const sql = `
            SELECT Cantidad, CodigoBarras AS [Codigo Barras], Descripcion, PrecioNormal AS [Precio Normal], PrecioVenta AS [Precio Venta], PrecioVenta * Cantidad AS Total
            FROM tblDetalleVentas A
            INNER JOIN tblArticulos B ON A.CodigoInterno = B.CodigoInterno
            WHERE A.IdTienda = ${idTienda} AND A.IdComputadora = ${idCaja} AND A.IdVenta = ${idVenta}
        `;

        const results = await query(sql);
        return NextResponse.json(results);

    } catch (error: any) {
        console.error('Error fetching ticket items:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
