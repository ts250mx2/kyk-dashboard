import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const fechaInicio = searchParams.get('fechaInicio');
        const fechaFin = searchParams.get('fechaFin');
        const idTienda = searchParams.get('idTienda');

        if (!fechaInicio || !fechaFin) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        const startStr = `'${fechaInicio}'`;
        const endStr = `'${fechaFin} 23:59:59'`;

        const sql = `
            SELECT T.Tienda, IdDevolucionVenta AS [Folio Devolucion], FechaDevolucionVenta AS [Fecha Devolucion], ClaveDevolucion AS Clave, Valor, Cliente, Concepto, DirTel AS Telefono, Empleado, Usuario AS Supervisor
            FROM tblDevolucionesVenta A
            INNER JOIN tblUsuarios B ON A.IdUsuario = B.IdUsuario
            LEFT JOIN tblTiendas T ON A.IdTienda = T.IdTienda
            WHERE FechaDevolucionVenta >= ${startStr} AND FechaDevolucionVenta <= ${endStr} ${idTienda ? `AND A.IdTienda = ${idTienda}` : ''}
            ORDER BY FechaDevolucionVenta
        `;

        const results = await query(sql);
        return NextResponse.json(results);

    } catch (error: any) {
        console.error('Error fetching return details:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
