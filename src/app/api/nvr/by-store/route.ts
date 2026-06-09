import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/nvr/by-store?idTienda=8
 * Devuelve el NVR activo configurado para una sucursal (el más reciente si hay varios),
 * o null si no hay ninguno. Usado por "Ver grabación" en cancelaciones.
 */
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const idTienda = Number(searchParams.get('idTienda') || '');
        if (!Number.isFinite(idTienda) || idTienda <= 0) {
            return NextResponse.json({ error: 'idTienda inválido' }, { status: 400 });
        }

        const rows = (await query(
            `SELECT TOP 1 n.IdNVR, n.IdTienda, t.Tienda, n.Descripcion, n.IP, n.Usuario, n.Passwd, n.Status
             FROM dbo.tblNVR n
             LEFT JOIN dbo.tblTiendas t ON t.IdTienda = n.IdTienda
             WHERE n.IdTienda = ? AND n.Status = 0
             ORDER BY n.FechaAct DESC`,
            [idTienda]
        )) as any[];

        return NextResponse.json({ nvr: rows[0] ?? null });
    } catch (error: any) {
        console.error('Error fetching NVR by store:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
