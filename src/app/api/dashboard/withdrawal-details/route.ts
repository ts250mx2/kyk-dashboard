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
            CAST(A.IdComputadora AS VARCHAR(2)) + '-' + CAST(A.IdRetiro AS VARCHAR(6)) AS [Folio Retiro],
            A.Fecha AS [Fecha Retiro], A.Concepto,
            A.Tarjeta, A.Efectivo, A.Devoluciones, A.Dolares, A.Cheques, A.Transferencia, A.TarjetaDebito AS [Debito], ISNULL(SUM(B.Importe), 0) AS Vales,
            D.Usuario AS Cajero, E.Usuario AS Supervisor
            FROM tblRetiros A
            LEFT JOIN tblValesRetiros B ON A.IdTienda = B.IdTienda AND A.IdComputadora = B.IdComputadora AND A.IdRetiro = B.IdRetiro
            INNER JOIN tblAperturasCierres C ON A.IdTienda = C.IdTienda AND A.IdComputadora = C.IdComputadora AND A.IdApertura = C.IdApertura
            INNER JOIN tblUsuarios D ON C.IdCajero = D.IdUsuario
            INNER JOIN tblUsuarios E ON A.IdSupervisor = E.IdUsuario
            WHERE CONVERT(DATE, A.Fecha) >= ${startStr} AND CONVERT(DATE, A.Fecha) <= ${endStr} AND A.IdTienda = ${idTienda}
            GROUP BY A.IdComputadora, A.IdApertura, A.IdRetiro, A.Fecha, A.Concepto, A.Tarjeta, A.Efectivo, A.Devoluciones, A.Dolares, A.Cheques, A.Transferencia, A.TarjetaDebito, D.Usuario, E.Usuario
            ORDER BY A.Fecha
        `;

        const results = await query(sql);
        return NextResponse.json(results);

    } catch (error: any) {
        console.error('Error fetching withdrawal details:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
