import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * PUT /api/nvr/[id]
 * Actualiza un NVR. Si Descripcion viene vacía, usa el nombre de la tienda.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const IdNVR = Number(id);
        if (!Number.isFinite(IdNVR) || IdNVR <= 0) {
            return NextResponse.json({ error: 'id inválido' }, { status: 400 });
        }

        const body = await request.json();
        const { IdTienda, Descripcion, IP, Usuario, Passwd } = body;
        const Status = Number.isFinite(Number(body.Status)) ? Number(body.Status) : 0;

        if (!IdTienda) {
            return NextResponse.json({ error: 'IdTienda es requerido' }, { status: 400 });
        }

        let descripcion = (Descripcion ?? '').toString().trim();
        if (!descripcion) {
            const store = await query('SELECT Tienda FROM dbo.tblTiendas WHERE IdTienda = ?', [IdTienda]);
            descripcion = (store as any[])[0]?.Tienda ?? '';
        }

        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

        await query(
            `UPDATE dbo.tblNVR
             SET IdTienda = ?, Descripcion = ?, IP = ?, Usuario = ?, Passwd = ?, FechaAct = ?, Status = ?
             WHERE IdNVR = ?`,
            [IdTienda, descripcion, IP ?? null, Usuario ?? null, Passwd ?? null, now, Status, IdNVR]
        );

        return NextResponse.json({ success: true, IdNVR });
    } catch (error: any) {
        console.error('Error updating NVR:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * DELETE /api/nvr/[id]
 * Elimina un NVR.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const IdNVR = Number(id);
        if (!Number.isFinite(IdNVR) || IdNVR <= 0) {
            return NextResponse.json({ error: 'id inválido' }, { status: 400 });
        }

        await query('DELETE FROM dbo.tblNVR WHERE IdNVR = ?', [IdNVR]);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting NVR:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
