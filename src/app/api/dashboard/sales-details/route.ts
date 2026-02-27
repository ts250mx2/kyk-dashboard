import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const fechaInicio = searchParams.get('fechaInicio');
        const fechaFin = searchParams.get('fechaFin');
        const idTienda = searchParams.get('idTienda');
        const idApertura = searchParams.get('idApertura');

        if (!idTienda) {
            return NextResponse.json({ error: 'Missing idTienda' }, { status: 400 });
        }

        let sql = '';
        if (idApertura) {
            sql = `
                SELECT A.IdTienda, A.IdComputadora, A.IdVenta, CAST(A.IdComputadora AS VARCHAR(2)) + '-' + CAST(A.IdApertura AS VARCHAR(6)) AS [Z], 
                CAST(A.IdTienda AS VARCHAR(2)) + '-' + CAST(A.IdComputadora AS VARCHAR(2)) + '-' + CAST(A.IdVenta AS VARCHAR(10)) AS FolioVenta, A.IdComputadora AS Caja,
                FechaVenta as [Fecha Venta], COUNT(B.CodigoInterno) AS Articulos, A.Total, A.Pago, D.Usuario AS Cajero
                FROM tblVentas A
                INNER JOIN tblDetalleVentas B ON A.IdTienda = B.IdTienda AND A.IdComputadora = B.IdComputadora AND A.IdVenta = B.IdVenta
                INNER JOIN tblAperturasCierres C ON A.IdTienda = C.IdTienda AND A.IdComputadora = C.IdComputadora AND A.IdApertura = C.IdApertura
                INNER JOIN tblUsuarios D ON C.IdCajero = D.IdUsuario
                WHERE A.IdApertura = ${idApertura} AND A.IdTienda = ${idTienda}
                GROUP BY A.IdTienda, A.IdVenta, A.IdComputadora, A.IdApertura, A.FechaVenta, D.Usuario, A.Total, A.Pago
                ORDER BY A.FechaVenta 
            `;
        } else if (fechaInicio && fechaFin) {
            const startStr = `'${fechaInicio}'`;
            const endStr = `'${fechaFin}'`;
            sql = `
                SELECT A.IdTienda, A.IdComputadora, A.IdVenta, CAST(A.IdComputadora AS VARCHAR(2)) + '-' + CAST(A.IdApertura AS VARCHAR(6)) AS [Z], 
                CAST(A.IdTienda AS VARCHAR(2)) + '-' + CAST(A.IdComputadora AS VARCHAR(2)) + '-' + CAST(A.IdVenta AS VARCHAR(10)) AS FolioVenta, A.IdComputadora AS Caja,
                FechaVenta as [Fecha Venta], COUNT(B.CodigoInterno) AS Articulos, A.Total, A.Pago, D.Usuario AS Cajero
                FROM tblVentas A
                INNER JOIN tblDetalleVentas B ON A.IdTienda = B.IdTienda AND A.IdComputadora = B.IdComputadora AND A.IdVenta = B.IdVenta
                INNER JOIN tblAperturasCierres C ON A.IdTienda = C.IdTienda AND A.IdComputadora = C.IdComputadora AND A.IdApertura = C.IdApertura
                INNER JOIN tblUsuarios D ON C.IdCajero = D.IdUsuario
                WHERE CONVERT(DATE, FechaVenta) >= ${startStr} AND CONVERT(DATE, FechaVenta) <= ${endStr} AND A.IdTienda = ${idTienda}
                GROUP BY A.IdTienda, A.IdVenta, A.IdComputadora, A.IdApertura, A.FechaVenta, D.Usuario, A.Total, A.Pago
                ORDER BY A.FechaVenta 
            `;
        } else {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        const results = await query(sql);
        return NextResponse.json(results);

    } catch (error: any) {
        console.error('Error fetching sales details:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
