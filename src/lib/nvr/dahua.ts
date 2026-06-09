import crypto from 'crypto';

/**
 * Cliente mínimo para la API CGI de NVR's Dahua.
 * Usa autenticación HTTP Digest (la que exigen los equipos Dahua) e implementa
 * el flujo `mediaFileFind` para listar grabaciones por canal y rango de tiempo.
 */

const md5 = (s: string) => crypto.createHash('md5').update(s).digest('hex');

function parseChallenge(header: string): Record<string, string> {
    const out: Record<string, string> = {};
    const body = header.replace(/^Digest\s+/i, '');
    const re = /(\w+)=(?:"([^"]*)"|([^,]*))/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body))) {
        out[m[1]] = m[2] !== undefined ? m[2] : (m[3] ?? '').trim();
    }
    return out;
}

function buildAuthHeader(
    user: string,
    pass: string,
    method: string,
    uri: string,
    challenge: Record<string, string>,
    nc: string,
    cnonce: string
): string {
    const { realm = '', nonce = '', qop, opaque, algorithm } = challenge;
    const ha1 = md5(`${user}:${realm}:${pass}`);
    const ha2 = md5(`${method}:${uri}`);
    let response: string;
    let header = `Digest username="${user}", realm="${realm}", nonce="${nonce}", uri="${uri}"`;
    if (qop) {
        const q = qop.split(',')[0].trim();
        response = md5(`${ha1}:${nonce}:${nc}:${cnonce}:${q}:${ha2}`);
        header += `, qop=${q}, nc=${nc}, cnonce="${cnonce}", response="${response}"`;
    } else {
        response = md5(`${ha1}:${nonce}:${ha2}`);
        header += `, response="${response}"`;
    }
    if (algorithm) header += `, algorithm=${algorithm}`;
    if (opaque) header += `, opaque="${opaque}"`;
    return header;
}

/** GET con Digest auth: primer request obtiene el challenge 401, el segundo va firmado. */
export async function digestFetch(
    url: string,
    user: string,
    pass: string,
    method = 'GET',
    timeoutMs = 8000
): Promise<Response> {
    const u = new URL(url);
    const uri = u.pathname + u.search;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const first = await fetch(url, { method, signal: ctrl.signal });
        if (first.status !== 401) return first;
        const wa = first.headers.get('www-authenticate') || '';
        if (!/digest/i.test(wa)) return first;
        // Consumimos el cuerpo del 401 para liberar la conexión.
        await first.arrayBuffer().catch(() => undefined);

        const challenge = parseChallenge(wa);
        const nc = '00000001';
        const cnonce = crypto.randomBytes(8).toString('hex');
        const auth = buildAuthHeader(user, pass, method, uri, challenge, nc, cnonce);
        return await fetch(url, { method, headers: { Authorization: auth }, signal: ctrl.signal });
    } finally {
        clearTimeout(timer);
    }
}

export interface DahuaClip {
    channel: number;
    startTime: string;
    endTime: string;
    type: string;
    filePath: string;
    length: number;
}

function parseFindItems(text: string): DahuaClip[] {
    const map = new Map<number, Partial<DahuaClip>>();
    const re = /items\[(\d+)\]\.(\w+)=(.*)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
        const idx = Number(m[1]);
        const key = m[2];
        const val = m[3].trim();
        const item = map.get(idx) ?? {};
        if (key === 'Channel') item.channel = Number(val);
        else if (key === 'StartTime') item.startTime = val;
        else if (key === 'EndTime') item.endTime = val;
        else if (key === 'Type') item.type = val;
        else if (key === 'FilePath') item.filePath = val;
        else if (key === 'Length') item.length = Number(val);
        map.set(idx, item);
    }
    return [...map.values()]
        .filter((i) => i.filePath)
        .map((i) => ({
            channel: i.channel ?? 0,
            startTime: i.startTime ?? '',
            endTime: i.endTime ?? '',
            type: i.type ?? 'dav',
            filePath: i.filePath ?? '',
            length: i.length ?? 0,
        }));
}

/** "2026-06-09 08:30:00" en hora local del rango solicitado. */
function fmt(date: string, time: string): string {
    return `${date} ${time.length === 5 ? time + ':00' : time}`;
}

/**
 * Lista grabaciones de un canal en un rango. Devuelve los clips encontrados.
 * Flujo Dahua: factory.create → findFile → findNextFile (paginado) → close → destroy.
 */
export async function listDahuaRecordings(opts: {
    ip: string;
    user: string;
    pass: string;
    channel: number;
    date: string;
    from: string;
    to: string;
    port?: number;
}): Promise<DahuaClip[]> {
    const { ip, user, pass, channel, date, from, to, port = 80 } = opts;
    const base = `http://${ip}:${port}/cgi-bin/mediaFileFind.cgi`;
    const startTime = encodeURIComponent(fmt(date, from));
    const endTime = encodeURIComponent(fmt(date, to));

    // 1) crear finder
    const createRes = await digestFetch(`${base}?action=factory.create`, user, pass);
    const createTxt = await createRes.text();
    if (!createRes.ok) throw new Error(`Dahua factory.create falló (${createRes.status}): ${createTxt.slice(0, 120)}`);
    const objMatch = createTxt.match(/result=(\S+)/i);
    if (!objMatch) throw new Error(`No se obtuvo el objeto del finder: ${createTxt.slice(0, 120)}`);
    const object = objMatch[1];

    try {
        // 2) iniciar búsqueda
        const cond =
            `?action=findFile&object=${object}` +
            `&condition.Channel=${channel}` +
            `&condition.StartTime=${startTime}` +
            `&condition.EndTime=${endTime}` +
            `&condition.Types[0]=dav`;
        const findRes = await digestFetch(base + cond, user, pass);
        const findTxt = await findRes.text();
        if (!findRes.ok || !/ok/i.test(findTxt)) {
            // Algunos firmwares responden vacío en éxito; sólo abortamos si hay error explícito.
            if (/error/i.test(findTxt)) throw new Error(`findFile: ${findTxt.slice(0, 120)}`);
        }

        // 3) paginar resultados
        const clips: DahuaClip[] = [];
        for (let guard = 0; guard < 50; guard++) {
            const nextRes = await digestFetch(`${base}?action=findNextFile&object=${object}&count=100`, user, pass);
            const nextTxt = await nextRes.text();
            const foundMatch = nextTxt.match(/found=(\d+)/i);
            const found = foundMatch ? Number(foundMatch[1]) : 0;
            if (found > 0) clips.push(...parseFindItems(nextTxt));
            if (found < 100) break;
        }
        return clips;
    } finally {
        // 4) cerrar y destruir el finder (best-effort)
        await digestFetch(`${base}?action=close&object=${object}`, user, pass).catch(() => undefined);
        await digestFetch(`${base}?action=destroy&object=${object}`, user, pass).catch(() => undefined);
    }
}

/** URL del CGI de descarga del clip (.dav) para proxiarlo desde el servidor. */
export function dahuaLoadfileUrl(ip: string, filePath: string, port = 80): string {
    const path = filePath.startsWith('/') ? filePath : `/${filePath}`;
    return `http://${ip}:${port}/cgi-bin/RPC_Loadfile${path}`;
}
