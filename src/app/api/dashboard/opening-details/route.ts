import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const fechaInicio = searchParams.get('fechaInicio');
        const fechaFin = searchParams.get('fechaFin');
        const idTienda = searchParams.get('idTienda');

        if (!fechaInicio || !fechaFin || !idTienda) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        const startStr = `'${fechaInicio}'`;
        const endStr = `'${fechaFin}'`;

        const sql = `
            SELECT C.IdTienda, C.IdApertura, C.IdComputadora, CAST(C.IdComputadora AS VARCHAR(2)) + '-' + CAST(C.IdApertura AS VARCHAR(6)) AS [Z], C.IdComputadora AS Caja, C.FechaApertura AS [Fecha Apertura], D.Usuario AS Cajero,
            COUNT(A.IdVenta) AS Tickets, SUM(A.Total) AS [Total Venta], C.FechaCierre
            FROM tblVentas A
            INNER JOIN tblAperturasCierres C ON A.IdTienda = C.IdTienda AND A.IdComputadora = C.IdComputadora AND A.IdApertura = C.IdApertura
            INNER JOIN tblUsuarios D ON C.IdCajero = D.IdUsuario
            WHERE CONVERT(DATE, FechaVenta) >= ${startStr} AND CONVERT(DATE, FechaVenta) <= ${endStr} AND C.IdTienda = ${idTienda}
            GROUP BY C.IdTienda, C.IdComputadora, C.IdApertura, C.FechaApertura, D.Usuario, C.FechaCierre
            ORDER BY C.FechaApertura 
        `;

        const results = await query(sql);
        return NextResponse.json(results);

    } catch (error: any) {
        console.error('Error fetching opening details:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
