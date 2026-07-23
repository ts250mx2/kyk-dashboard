import { NextResponse } from 'next/server';
import { syncFaceList } from '@/lib/faces/face-sync';
import type { FaceList } from '@/lib/faces/faces-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/faces/sync
 * Body JSON: { type: 'black'|'white', idNvr?: number }
 * Reconcilia la lista contra los NVR's activos (o uno). En la primera pasada
 * adopta hacia SQL las personas que el NVR tenga dadas de alta manualmente.
 */
export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => ({}));
        const lista: FaceList = body?.type === 'white' ? 'blanca' : 'negra';
        const idNvr = Number(body?.idNvr) || undefined;

        const reports = await syncFaceList(lista, idNvr);
        if (reports.length === 0) {
            return NextResponse.json({ error: 'No hay NVR’s activos con IP para sincronizar' }, { status: 400 });
        }
        return NextResponse.json({ ok: reports.every((r) => r.ok), reports });
    } catch (error: any) {
        console.error('Error syncing faces:', error);
        return NextResponse.json({ error: error.message || 'Error' }, { status: 500 });
    }
}
