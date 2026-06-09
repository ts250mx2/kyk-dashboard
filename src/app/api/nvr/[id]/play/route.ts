import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { startSession } from '@/lib/nvr/hls';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface NvrRow {
    IP: string | null;
    Usuario: string | null;
    Passwd: string | null;
}

const TIME_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

/**
 * POST /api/nvr/[id]/play
 * Body: { channel, start, end }  (start/end = "YYYY-MM-DD HH:MM:SS", hora local del NVR)
 * Arranca una sesión ffmpeg RTSP→HLS y devuelve la URL del playlist .m3u8.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const IdNVR = Number(id);
        if (!Number.isFinite(IdNVR) || IdNVR <= 0) {
            return NextResponse.json({ error: 'id inválido' }, { status: 400 });
        }

        const body = await req.json();
        const channel = Math.max(1, Number(body.channel) || 1);
        const start = String(body.start || '');
        const end = String(body.end || '');
        if (!TIME_RE.test(start) || !TIME_RE.test(end)) {
            return NextResponse.json({ error: 'start/end inválidos (formato YYYY-MM-DD HH:MM:SS)' }, { status: 400 });
        }

        const rows = (await query(
            'SELECT IP, Usuario, Passwd FROM dbo.tblNVR WHERE IdNVR = ?',
            [IdNVR]
        )) as NvrRow[];
        const nvr = rows[0];
        if (!nvr || !nvr.IP) {
            return NextResponse.json({ error: 'NVR no encontrado o sin IP' }, { status: 404 });
        }

        const { id: session } = startSession({
            ip: nvr.IP.trim(),
            user: nvr.Usuario ?? '',
            pass: nvr.Passwd ?? '',
            channel,
            start,
            end,
        });

        return NextResponse.json({ session, url: `/api/nvr/play/${session}/index.m3u8` });
    } catch (error: any) {
        console.error('Error starting playback:', error);
        return NextResponse.json({ error: error.message || 'Error' }, { status: 500 });
    }
}
