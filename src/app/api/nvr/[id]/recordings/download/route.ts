import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { digestFetch, dahuaLoadfileUrl } from '@/lib/nvr/dahua';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface NvrRow {
    IP: string | null;
    Usuario: string | null;
    Passwd: string | null;
}

/**
 * GET /api/nvr/[id]/recordings/download?path=<FilePath>&port=80
 * Proxia la descarga del clip (.dav) desde el NVR Dahua, ya que el equipo exige
 * Digest auth y no es accesible directamente desde el navegador del usuario.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const IdNVR = Number(id);
        if (!Number.isFinite(IdNVR) || IdNVR <= 0) {
            return NextResponse.json({ error: 'id inválido' }, { status: 400 });
        }

        const { searchParams } = new URL(req.url);
        const filePath = searchParams.get('path') || '';
        const port = Number(searchParams.get('port') || '80');
        if (!filePath) return NextResponse.json({ error: 'Falta path' }, { status: 400 });

        const rows = (await query(
            'SELECT IP, Usuario, Passwd FROM dbo.tblNVR WHERE IdNVR = ?',
            [IdNVR]
        )) as NvrRow[];
        const nvr = rows[0];
        if (!nvr || !nvr.IP) return NextResponse.json({ error: 'NVR no encontrado o sin IP' }, { status: 404 });

        const url = dahuaLoadfileUrl(nvr.IP.trim(), filePath, port);
        const upstream = await digestFetch(url, nvr.Usuario ?? '', nvr.Passwd ?? '', 'GET', 30000);
        if (!upstream.ok || !upstream.body) {
            return NextResponse.json({ error: `El NVR respondió ${upstream.status}` }, { status: 502 });
        }

        const filename = (filePath.split('/').pop() || 'grabacion.dav').replace(/[^\w.\-]/g, '_');
        return new NextResponse(upstream.body, {
            headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        });
    } catch (error: any) {
        console.error('Error downloading recording:', error);
        return NextResponse.json(
            { error: error?.name === 'AbortError' ? 'El NVR no respondió (timeout)' : (error.message || 'Error') },
            { status: 502 }
        );
    }
}
