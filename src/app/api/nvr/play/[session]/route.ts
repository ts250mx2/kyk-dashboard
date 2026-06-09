import { NextResponse } from 'next/server';
import { stopSession, getSession } from '@/lib/nvr/hls';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SESSION_RE = /^[0-9a-f-]{36}$/i;

/**
 * GET /api/nvr/play/[session]  -> estado de la sesión (para detectar errores de ffmpeg).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ session: string }> }) {
    const { session } = await params;
    if (!SESSION_RE.test(session)) return NextResponse.json({ error: 'inválido' }, { status: 400 });
    const s = getSession(session);
    if (!s) return NextResponse.json({ exists: false }, { status: 404 });
    return NextResponse.json({ exists: true, exited: !!s.exited, error: s.error ?? null });
}

/**
 * DELETE /api/nvr/play/[session]  -> detiene ffmpeg y limpia el directorio temporal.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ session: string }> }) {
    const { session } = await params;
    if (!SESSION_RE.test(session)) return NextResponse.json({ error: 'inválido' }, { status: 400 });
    stopSession(session);
    return NextResponse.json({ success: true });
}
