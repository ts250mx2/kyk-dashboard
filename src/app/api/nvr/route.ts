import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * GET /api/nvr
 * Lista los NVR's con el nombre de la tienda relacionada.
 * Status: 0 = activo, 2 = inactivo.
 */
export async function GET() {
    try {
        const rows = await query(`
            SELECT n.IdNVR, n.IdTienda, t.Tienda, n.Descripcion, n.IP,
                   n.Usuario, n.Passwd, n.FechaAct, n.Status
            FROM dbo.tblNVR n
            LEFT JOIN dbo.tblTiendas t ON t.IdTienda = n.IdTienda
            ORDER BY t.Tienda, n.Descripcion
        `);
        return NextResponse.json(rows);
    } catch (error: any) {
        console.error('Error fetching NVRs:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * POST /api/nvr
 * Crea un NVR. Si Descripcion viene vacía, usa el nombre de la tienda por default.
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { IdTienda, Descripcion, IP, Usuario, Passwd } = body;
        const Status = Number.isFinite(Number(body.Status)) ? Number(body.Status) : 0;

        if (!IdTienda) {
            return NextResponse.json({ error: 'IdTienda es requerido' }, { status: 400 });
        }

        // Descripcion por default = nombre de la tienda
        let descripcion = (Descripcion ?? '').toString().trim();
        if (!descripcion) {
            const store = await query('SELECT Tienda FROM dbo.tblTiendas WHERE IdTienda = ?', [IdTienda]);
            descripcion = (store as any[])[0]?.Tienda ?? '';
        }

        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

        const result = await query(
            `INSERT INTO dbo.tblNVR (IdTienda, Descripcion, IP, Usuario, Passwd, FechaAct, Status)
             VALUES (?, ?, ?, ?, ?, ?, ?);
             SELECT SCOPE_IDENTITY() AS IdNVR;`,
            [IdTienda, descripcion, IP ?? null, Usuario ?? null, Passwd ?? null, now, Status]
        );
        const IdNVR = (result as any[])[0]?.IdNVR;

        return NextResponse.json({ success: true, IdNVR });
    } catch (error: any) {
        console.error('Error creating NVR:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
