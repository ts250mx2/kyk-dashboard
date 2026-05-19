import { NextResponse } from 'next/server';
import {
    getPlaybook,
    updatePlaybook,
    deletePlaybook,
    recordPlaybookRun
} from '@/lib/playbooks';
import { getUserId } from '@/lib/conversations';

/** GET /api/agent/playbooks/[id] → playbook completo (incluye steps) */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const userId = await getUserId();
        const playbook = await getPlaybook(userId, id);
        if (!playbook) {
            return NextResponse.json({ error: 'Playbook no encontrado' }, { status: 404 });
        }
        return NextResponse.json({ playbook });
    } catch (error: any) {
        console.error('getPlaybook error:', error);
        return NextResponse.json(
            { error: error.message || 'Error recuperando playbook' },
            { status: 500 }
        );
    }
}

/** PATCH /api/agent/playbooks/[id] → editar nombre/descripcion/steps o registrar run */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const userId = await getUserId();
        const body = await req.json();

        // Acción especial: registrar que se ejecutó (sin modificar el playbook)
        if (body.action === 'record-run') {
            await recordPlaybookRun(userId, id);
            return NextResponse.json({ success: true });
        }

        await updatePlaybook({
            id,
            userId,
            name: body.name,
            description: body.description,
            steps: body.steps
        });
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('updatePlaybook error:', error);
        return NextResponse.json(
            { error: error.message || 'Error actualizando playbook' },
            { status: 500 }
        );
    }
}

/** DELETE /api/agent/playbooks/[id] → soft delete */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const userId = await getUserId();
        await deletePlaybook(userId, id);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('deletePlaybook error:', error);
        return NextResponse.json(
            { error: error.message || 'Error eliminando playbook' },
            { status: 500 }
        );
    }
}
