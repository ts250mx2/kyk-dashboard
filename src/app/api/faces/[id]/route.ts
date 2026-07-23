import { NextResponse } from 'next/server';
import { getFaceById, deleteFace } from '@/lib/faces/faces-store';
import { syncFaceList } from '@/lib/faces/face-sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * DELETE /api/faces/[id]
 * Baja en SQL + sincronización (elimina a la persona de los NVR's).
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const faceId = Number(id);
        if (!Number.isFinite(faceId) || faceId <= 0) {
            return NextResponse.json({ error: 'id inválido' }, { status: 400 });
        }
        const face = await getFaceById(faceId);
        if (!face) return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });

        await deleteFace(faceId);
        const sync = await syncFaceList(face.lista);
        return NextResponse.json({ ok: true, sync });
    } catch (error: any) {
        console.error('Error deleting face:', error);
        return NextResponse.json({ error: error.message || 'Error' }, { status: 500 });
    }
}
