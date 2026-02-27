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
            SELECT CAST(A.IdComputadora AS VARCHAR(2)) + '-' + CAST(A.IdApertura AS VARCHAR(6)) AS [Z],
            CAST(A.IdComputadora AS VARCHAR(2)) + '-' + CAST(A.IdCancelacion AS VARCHAR(6)) AS [Folio Cancelacion], 
            A.FechaCancelacion, B.Cantidad, F.CodigoBarras AS [Codigo Barras], F.Descripcion, B.PrecioVenta AS [Precio Venta], B.Cantidad*B.PrecioVenta AS Total,
            D.Usuario AS Cajero, E.Usuario AS Supervisor
            FROM tblCancelaciones A
            INNER JOIN tblDetalleCancelaciones B ON A.IdCancelacion = B.IdCancelacion AND A.IdComputadora = B.IdComputadora AND A.IdTienda = B.IdTienda
            INNER JOIN tblAperturasCierres C ON A.IdTienda = C.IdTienda AND A.IdApertura = C.IdApertura AND A.IdComputadora = C.IdComputadora
            INNER JOIN tblUsuarios D ON C.IdCajero = D.IdUsuario
            INNER JOIN tblUsuarios E ON A.IdSupervisor = E.IdUsuario
            INNER JOIN tblArticulos F ON B.CodigoInterno = F.CodigoInterno
            WHERE CONVERT(DATE, FechaCancelacion) >= ${startStr} AND CONVERT(DATE, FechaCancelacion) <= ${endStr} AND A.IdTienda = ${idTienda}
            ORDER BY FechaCancelacion
        `;

        const results = await query(sql);
        return NextResponse.json(results);

    } catch (error: any) {
        console.error('Error fetching cancellation details:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
