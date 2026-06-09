import { NextResponse } from 'next/server';
import net from 'net';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Puertos típicos de NVR/cámaras: 80 (web), 8000 (Hikvision SDK), 554 (RTSP), 37777 (Dahua).
const DEFAULT_PORTS = [80, 8000, 554, 37777];
const TIMEOUT_MS = 1500;

/** Intenta una conexión TCP; resuelve true si el puerto acepta la conexión. */
function tcpProbe(host: string, port: number, timeout: number): Promise<boolean> {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        let settled = false;
        const done = (ok: boolean) => {
            if (settled) return;
            settled = true;
            socket.destroy();
            resolve(ok);
        };
        socket.setTimeout(timeout);
        socket.once('connect', () => done(true));
        socket.once('timeout', () => done(false));
        socket.once('error', () => done(false));
        socket.connect(port, host);
    });
}

/** Online si alguno de los puertos comunes responde. Devuelve el primero que conecta. */
async function probeHost(host: string): Promise<{ online: boolean; ms: number; port: number | null }> {
    const start = Date.now();
    const results = await Promise.all(DEFAULT_PORTS.map((p) => tcpProbe(host, p, TIMEOUT_MS).then((ok) => ({ p, ok }))));
    const hit = results.find((r) => r.ok);
    return { online: !!hit, ms: Date.now() - start, port: hit ? hit.p : null };
}

/**
 * GET /api/nvr/status
 * Verifica la alcanzabilidad de todos los NVR's con IP registrada.
 */
export async function GET() {
    try {
        const rows = (await query(
            "SELECT IdNVR, IP FROM dbo.tblNVR WHERE IP IS NOT NULL AND LTRIM(RTRIM(IP)) <> ''"
        )) as { IdNVR: number; IP: string }[];

        const statuses = await Promise.all(
            rows.map(async (r) => {
                const probe = await probeHost(r.IP.trim());
                return { IdNVR: r.IdNVR, ...probe };
            })
        );

        return NextResponse.json(statuses);
    } catch (error: any) {
        console.error('Error checking NVR status:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
