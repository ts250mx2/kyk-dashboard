import { spawn, ChildProcess } from 'child_process';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import ffmpegStatic from 'ffmpeg-static';

/**
 * Gestor de sesiones de transcodificación RTSP→HLS con ffmpeg.
 * Cada sesión arranca un ffmpeg que jala el stream RTSP del NVR (playback o vivo)
 * y escribe segmentos HLS en un directorio temporal que luego servimos al navegador.
 */

const FFMPEG = process.env.FFMPEG_PATH || ffmpegStatic || 'ffmpeg';
const ROOT = path.join(os.tmpdir(), 'kyk-nvr-hls');
const MAX_SESSION_MS = 15 * 60 * 1000; // vida máxima de una sesión

interface Session {
    id: string;
    dir: string;
    proc: ChildProcess;
    createdAt: number;
    timer: NodeJS.Timeout;
    error?: string;
    exited?: boolean;
}

// Persistimos el mapa entre recargas de módulo en dev (HMR) usando globalThis.
const g = globalThis as unknown as { __nvrHlsSessions?: Map<string, Session> };
const sessions: Map<string, Session> = g.__nvrHlsSessions ?? new Map();
g.__nvrHlsSessions = sessions;

function buildPlaybackUrl(ip: string, user: string, pass: string, channel: number, start: string, end: string): string {
    const auth = user ? `${encodeURIComponent(user)}:${encodeURIComponent(pass)}@` : '';
    const s = start.replace(/[-: ]/g, '_');
    const e = end.replace(/[-: ]/g, '_');
    return `rtsp://${auth}${ip}:554/cam/playback?channel=${channel}&starttime=${s}&endtime=${e}`;
}

// Fuentes candidatas para el sello de fecha/hora (drawtext).
const FONT_CANDIDATES = [
    'C:/Windows/Fonts/arial.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/dejavu/DejaVuSans.ttf',
    '/System/Library/Fonts/Supplemental/Arial.ttf',
];
const FONT = FONT_CANDIDATES.find((f) => existsSync(f));

/** Epoch (s) del reloj de pared "YYYY-MM-DD HH:MM:SS", tz-safe vía UTC + gmtime. */
function epochFromWallClock(s: string): number {
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
    if (!m) return 0;
    return Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) / 1000);
}

/** Cadena del filtro -vf: reescala y quema la fecha/hora corriente de la grabación. */
function buildVideoFilter(start: string): string {
    let vf = "scale='min(1280,iw)':-2";
    const epoch = epochFromWallClock(start);
    if (FONT && epoch) {
        const fontEsc = FONT.replace(/\\/g, '/').replace(/:/g, '\\:');
        vf += `,drawtext=fontfile='${fontEsc}':text='%{pts\\:gmtime\\:${epoch}}':x=12:y=12:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=8`;
    }
    return vf;
}

export function stopSession(id: string) {
    const s = sessions.get(id);
    if (!s) return;
    clearTimeout(s.timer);
    try { s.proc.kill('SIGKILL'); } catch { /* */ }
    sessions.delete(id);
    try { rmSync(s.dir, { recursive: true, force: true }); } catch { /* */ }
}

/** Limpia sesiones vencidas. */
function sweep() {
    const now = Date.now();
    for (const [id, s] of sessions) {
        if (now - s.createdAt > MAX_SESSION_MS) stopSession(id);
    }
}

export interface StartOpts {
    ip: string;
    user: string;
    pass: string;
    channel: number;
    start: string; // "YYYY-MM-DD HH:MM:SS" (hora local del NVR)
    end: string;
}

export function startSession(opts: StartOpts): { id: string } {
    sweep();
    if (!existsSync(ROOT)) mkdirSync(ROOT, { recursive: true });

    const id = crypto.randomUUID();
    const dir = path.join(ROOT, id);
    mkdirSync(dir, { recursive: true });

    const rtsp = buildPlaybackUrl(opts.ip, opts.user, opts.pass, opts.channel, opts.start, opts.end);

    // Las cámaras suelen entregar HEVC (H.265) en 4K, que el navegador no reproduce.
    // Transcodificamos a H.264 con preset ultrafast y reescalamos (cap 1280px de ancho)
    // para que sea tiempo-real incluso desde un stream 4K. Verificado contra el NVR real.
    const args = [
        '-loglevel', 'error',
        '-rtsp_transport', 'tcp',
        '-i', rtsp,
        '-an',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-tune', 'zerolatency',
        '-pix_fmt', 'yuv420p',
        '-vf', buildVideoFilter(opts.start),
        '-g', '30',
        '-sc_threshold', '0',
        '-f', 'hls',
        '-hls_time', '2',
        '-hls_list_size', '0',
        '-hls_flags', 'independent_segments',
        '-hls_segment_type', 'mpegts',
        '-hls_segment_filename', 'seg_%04d.ts',
        'index.m3u8',
    ];

    const proc = spawn(FFMPEG as string, args, { cwd: dir, windowsHide: true });

    let stderr = '';
    proc.stderr?.on('data', (d) => { stderr += d.toString(); if (stderr.length > 4000) stderr = stderr.slice(-4000); });

    const session: Session = {
        id,
        dir,
        proc,
        createdAt: Date.now(),
        timer: setTimeout(() => stopSession(id), MAX_SESSION_MS),
    };

    proc.on('exit', (code) => {
        session.exited = true;
        // Si no se generó el playlist, fue un fallo real (p.ej. no conecta al NVR).
        const produced = existsSync(join(dir, 'index.m3u8'));
        if (!produced && code !== 0) {
            session.error = stderr.split('\n').filter(Boolean).pop() || `ffmpeg salió con código ${code}`;
        }
    });
    proc.on('error', (err) => { session.exited = true; session.error = err.message; });

    sessions.set(id, session);
    return { id };
}

export function getSession(id: string): Session | undefined {
    return sessions.get(id);
}

export function sessionDir(id: string): string {
    return path.join(ROOT, id);
}
