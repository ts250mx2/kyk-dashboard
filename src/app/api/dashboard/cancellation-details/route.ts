import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const fechaInicio = searchParams.get('fechaInicio');
        const fechaFin = searchParams.get('fechaFin');
        const idUsuario = searchParams.get('idUsuario');
        const idTienda = searchParams.get('idTienda');
        const role = searchParams.get('role');

        let dateFilter = '';
        // If it's an audit/trends query (idUsuario + role present), use rolling 7 days
        if (idUsuario && role) {
            dateFilter = `CONVERT(DATE, FechaCancelacion) >= DATEADD(day, -7, GETDATE())`;
        } else if (fechaInicio && fechaFin) {
            // If specific dates are provided (Dashboard Store Detail case)
            dateFilter = `CONVERT(DATE, FechaCancelacion) >= '${fechaInicio}' AND CONVERT(DATE, FechaCancelacion) <= '${fechaFin}'`;
        } else {
            // Default Fallback
            dateFilter = `CONVERT(DATE, FechaCancelacion) >= DATEADD(day, -7, GETDATE())`;
        }

        let filters = [dateFilter];
        if (idTienda) filters.push(`A.IdTienda = ${idTienda}`);

        if (idUsuario) {
            if (role === 'supervisores') {
                filters.push(`A.IdSupervisor = ${idUsuario}`);
            } else {
                // Default to cajeros if role is 'cajeros' or not specified but idUsuario is present
                filters.push(`C.IdCajero = ${idUsuario}`);
            }
        }

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
            WHERE ${filters.join(' AND ')}
            ORDER BY FechaCancelacion
        `;

        const results = await query(sql);
        return NextResponse.json(results);

    } catch (error: any) {
        console.error('Error fetching cancellation details:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
