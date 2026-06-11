import { NextResponse } from 'next/server';
import { getShareByUuid } from '@/lib/whatsapp-shares/shares-store';

export const runtime = 'nodejs';

/**
 * GET /api/share/[uuid]  — PÚBLICO (sin sesión).
 *
 * Devuelve el snapshot congelado para la página /r/[uuid]. No re-ejecuta SQL:
 * solo lee el JSON guardado. 404 si no existe, 410 si expiró.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ uuid: string }> }) {
    const { uuid } = await params;
    if (!/^[0-9a-fA-F-]{36}$/.test(uuid || '')) {
        return NextResponse.json({ error: 'Identificador inválido' }, { status: 400 });
    }

    let share;
    try {
        share = await getShareByUuid(uuid);
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'Error obteniendo el reporte' }, { status: 500 });
    }

    if (!share) {
        return NextResponse.json({ error: 'Este enlace no existe.' }, { status: 404 });
    }
    if (share.expired) {
        return NextResponse.json({ error: 'Este enlace ya expiró.' }, { status: 410 });
    }

    return NextResponse.json({
        question: share.question,
        answer: share.answer,
        viz: share.viz,
        rows: share.rows,
        insights: share.insights,
        tool: share.tool,
        fechaCreacion: share.fechaCreacion,
    });
}
