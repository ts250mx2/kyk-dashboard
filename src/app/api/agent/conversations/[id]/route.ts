import { NextResponse } from 'next/server';
import { getConversation, deleteConversation, getUserId } from '@/lib/conversations';

/** GET /api/agent/conversations/[id] → recupera la conversación completa */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const userId = await getUserId();
        const conv = await getConversation(userId, id);
        if (!conv) {
            return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 });
        }
        return NextResponse.json({ conversation: conv });
    } catch (error: any) {
        console.error('getConversation error:', error);
        return NextResponse.json(
            { error: error.message || 'Error recuperando conversación' },
            { status: 500 }
        );
    }
}

/** DELETE /api/agent/conversations/[id] → soft delete */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const userId = await getUserId();
        await deleteConversation(userId, id);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('deleteConversation error:', error);
        return NextResponse.json(
            { error: error.message || 'Error eliminando conversación' },
            { status: 500 }
        );
    }
}
