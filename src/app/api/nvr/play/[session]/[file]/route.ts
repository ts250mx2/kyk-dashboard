import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { sessionDir, getSession } from '@/lib/nvr/hls';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SESSION_RE = /^[0-9a-f-]{36}$/i;
const FILE_RE = /^[\w-]+\.(m3u8|ts)$/;

/**
 * GET /api/nvr/play/[session]/[file]
 * Sirve el playlist .m3u8 y los segmentos .ts generados por ffmpeg.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ session: string; file: string }> }) {
    const { session, file } = await params;
    if (!SESSION_RE.test(session) || !FILE_RE.test(file)) {
        return NextResponse.json({ error: 'ruta inválida' }, { status: 400 });
    }

    const dir = sessionDir(session);
    const full = path.join(dir, file);
    // Anti path-traversal: el archivo resuelto debe quedar dentro del dir de la sesión.
    if (!full.startsWith(dir + path.sep)) {
        return NextResponse.json({ error: 'ruta inválida' }, { status: 400 });
    }

    try {
        const data = await readFile(full);
        const isPlaylist = file.endsWith('.m3u8');
        return new NextResponse(data, {
            headers: {
                'Content-Type': isPlaylist ? 'application/vnd.apple.mpegurl' : 'video/mp2t',
                'Cache-Control': 'no-store, no-cache, must-revalidate',
            },
        });
    } catch {
        // El .m3u8 puede tardar ~1-2s en aparecer mientras ffmpeg calienta.
        const s = getSession(session);
        if (s?.error) return NextResponse.json({ error: s.error }, { status: 502 });
        return NextResponse.json({ error: 'aún no disponible' }, { status: 404 });
    }
}
