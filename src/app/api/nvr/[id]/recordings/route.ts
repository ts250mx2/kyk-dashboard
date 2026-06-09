import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { listDahuaRecordings } from '@/lib/nvr/dahua';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface NvrRow {
    IdNVR: number;
    IP: string | null;
    Usuario: string | null;
    Passwd: string | null;
}

/**
 * GET /api/nvr/[id]/recordings?channel=1&date=2026-06-09&from=00:00&to=23:59
 * Lista las grabaciones de un NVR Dahua para el canal y rango indicados.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const IdNVR = Number(id);
        if (!Number.isFinite(IdNVR) || IdNVR <= 0) {
            return NextResponse.json({ error: 'id inválido' }, { status: 400 });
        }

        const { searchParams } = new URL(req.url);
        const channel = Number(searchParams.get('channel') || '1');
        const date = searchParams.get('date') || '';
        const from = searchParams.get('from') || '00:00';
        const to = searchParams.get('to') || '23:59';
        const port = Number(searchParams.get('port') || '80');

        if (!date) {
            return NextResponse.json({ error: 'Falta la fecha' }, { status: 400 });
        }

        const rows = (await query(
            'SELECT IdNVR, IP, Usuario, Passwd FROM dbo.tblNVR WHERE IdNVR = ?',
            [IdNVR]
        )) as NvrRow[];
        const nvr = rows[0];
        if (!nvr) return NextResponse.json({ error: 'NVR no encontrado' }, { status: 404 });
        if (!nvr.IP) return NextResponse.json({ error: 'El NVR no tiene IP registrada' }, { status: 400 });

        const clips = await listDahuaRecordings({
            ip: nvr.IP.trim(),
            user: nvr.Usuario ?? '',
            pass: nvr.Passwd ?? '',
            channel,
            date,
            from,
            to,
            port,
        });

        return NextResponse.json({ count: clips.length, clips });
    } catch (error: any) {
        console.error('Error listing recordings:', error);
        return NextResponse.json(
            { error: error?.name === 'AbortError' ? 'El NVR no respondió (timeout)' : (error.message || 'Error') },
            { status: 502 }
        );
    }
}
