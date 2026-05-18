import { NextResponse } from 'next/server';
import { updateAlertActive, deleteAlert } from '@/lib/alerts';
import { getUserId } from '@/lib/conversations';

/** PATCH /api/agent/alerts/[id] → activa/desactiva la alerta */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const userId = await getUserId();
        const body = await req.json();

        if (typeof body.active === 'boolean') {
            await updateAlertActive(userId, id, body.active);
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Campo "active" requerido' }, { status: 400 });
    } catch (error: any) {
        console.error('updateAlert error:', error);
        return NextResponse.json(
            { error: error.message || 'Error actualizando alerta' },
            { status: 500 }
        );
    }
}

/** DELETE /api/agent/alerts/[id] → elimina la alerta */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const userId = await getUserId();
        await deleteAlert(userId, id);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('deleteAlert error:', error);
        return NextResponse.json(
            { error: error.message || 'Error eliminando alerta' },
            { status: 500 }
        );
    }
}
