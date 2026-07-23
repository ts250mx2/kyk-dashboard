import crypto from 'crypto';

/**
 * Cliente JSON-RPC (RPC2) para NVR's Dahua con firmware 5.x.
 * La web UI de estos equipos usa este protocolo (no el CGI clásico) para la
 * librería de rostros: login con doble MD5, llamadas a /RPC2 con sesión, subida
 * de archivos multipart a /RPC3 y descarga de fotos por /RPC2_LoadFaceFile.
 */

const md5 = (s: string) => crypto.createHash('md5').update(s).digest('hex');

export interface DahuaRpcError {
    code?: number;
    message?: string;
}

export class DahuaRpcCallError extends Error {
    readonly rpcError: DahuaRpcError | null;
    constructor(method: string, rpcError: DahuaRpcError | null, raw?: string) {
        const detail = rpcError
            ? `code ${rpcError.code ?? '?'}: ${rpcError.message ?? 'sin mensaje'}`
            : raw || 'respuesta inválida';
        super(`RPC ${method} falló (${detail})`);
        this.name = 'DahuaRpcCallError';
        this.rpcError = rpcError;
    }
}

interface RpcResponse {
    id: number;
    result?: unknown;
    params?: any;
    error?: DahuaRpcError;
    session?: string;
}

export interface DahuaRpcOptions {
    ip: string;
    user: string;
    pass: string;
    port?: number;
    timeoutMs?: number;
}

export class DahuaRpcSession {
    private readonly base: string;
    private readonly user: string;
    private readonly pass: string;
    private readonly timeoutMs: number;
    private session: string | null = null;
    private id = 0;

    constructor(opts: DahuaRpcOptions) {
        this.base = `http://${opts.ip}:${opts.port ?? 80}`;
        this.user = opts.user;
        this.pass = opts.pass;
        this.timeoutMs = opts.timeoutMs ?? 15000;
    }

    private sessionHeaders(): Record<string, string> {
        if (!this.session) return {};
        return {
            'x-api-session': this.session,
            // Los endpoints de descarga (RPC2_LoadFaceFile) validan la sesión por cookie.
            Cookie: `WebClientSessionID=${this.session}; DWebClientSessionID=${this.session}; DhWebClientSessionID=${this.session}`,
        };
    }

    private async post(path: string, body: BodyInit, headers: Record<string, string> = {}): Promise<Response> {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
        try {
            return await fetch(`${this.base}${path}`, {
                method: 'POST',
                headers: { ...this.sessionHeaders(), ...headers },
                body,
                signal: ctrl.signal,
            });
        } finally {
            clearTimeout(timer);
        }
    }

    /** Llamada JSON-RPC. Lanza DahuaRpcCallError si el equipo responde con error. */
    async call(method: string, params: unknown, extra: { object?: number; allowError?: boolean } = {}): Promise<RpcResponse> {
        this.id++;
        const envelope: Record<string, unknown> = {
            method,
            params,
            id: this.id,
            ...(this.session ? { session: this.session } : {}),
            ...(extra.object !== undefined ? { object: extra.object } : {}),
        };
        const path = method === 'global.login' ? '/RPC2_Login' : '/RPC2';
        const res = await this.post(path, JSON.stringify(envelope), { 'Content-Type': 'application/json' });
        const text = await res.text();
        let data: RpcResponse | null = null;
        try {
            data = JSON.parse(text) as RpcResponse;
        } catch {
            throw new DahuaRpcCallError(method, null, `HTTP ${res.status}: ${text.slice(0, 200)}`);
        }
        if (data.session) this.session = data.session;
        if (!data.result && data.error && !extra.allowError) {
            throw new DahuaRpcCallError(method, data.error);
        }
        return data;
    }

    /**
     * Login en dos pasos: el primer intento devuelve el challenge (realm + random)
     * y el segundo manda MD5(user:random:MD5(user:realm:pass)) en mayúsculas.
     */
    async login(): Promise<void> {
        const first = await this.call('global.login', {
            userName: this.user,
            password: '',
            clientType: 'Web3.0',
        }, { allowError: true });

        const challenge = first.params ?? {};
        const realm: string = challenge.realm ?? '';
        const random: string = challenge.random ?? '';
        const h1 = md5(`${this.user}:${realm}:${this.pass}`).toUpperCase();
        const pwd = md5(`${this.user}:${random}:${h1}`).toUpperCase();

        const second = await this.call('global.login', {
            userName: this.user,
            password: pwd,
            clientType: 'Web3.0',
            authorityType: 'Default',
            passwordType: 'Default',
        }, { allowError: true });

        if (!second.result) {
            throw new DahuaRpcCallError('global.login', second.error ?? null, 'credenciales rechazadas');
        }
    }

    async logout(): Promise<void> {
        if (!this.session) return;
        await this.call('global.logout', null, { allowError: true }).catch(() => undefined);
        this.session = null;
    }

    /** Crea la instancia de un servicio factory (ej. faceRecognitionServer.factory.instance). */
    async instance(method: string): Promise<number> {
        const res = await this.call(method, null);
        if (typeof res.result !== 'number') {
            throw new DahuaRpcCallError(method, null, 'no devolvió el handle de instancia');
        }
        return res.result;
    }

    /**
     * Llamada RPC con archivo adjunto (multipart a /RPC3). El JSON del request va
     * en el campo `verify` y el binario en `file` — así sube fotos la web UI.
     */
    async callWithFile(
        method: string,
        params: unknown,
        file: Buffer,
        opts: { object?: number; filename?: string; contentType?: string; fieldName?: string } = {}
    ): Promise<RpcResponse> {
        this.id++;
        const envelope: Record<string, unknown> = {
            method,
            params,
            id: this.id,
            ...(this.session ? { session: this.session } : {}),
            ...(opts.object !== undefined ? { object: opts.object } : {}),
        };
        const fd = new FormData();
        fd.append('verify', JSON.stringify(envelope));
        fd.append(
            opts.fieldName ?? 'file',
            new Blob([new Uint8Array(file)], { type: opts.contentType ?? 'image/jpeg' }),
            opts.filename ?? 'face.jpg'
        );
        const res = await this.post('/RPC3', fd);
        const text = await res.text();
        let data: RpcResponse | null = null;
        try {
            data = JSON.parse(text) as RpcResponse;
        } catch {
            throw new DahuaRpcCallError(method, null, `HTTP ${res.status}: ${text.slice(0, 200)}`);
        }
        return data;
    }

    /** Descarga un archivo de la BD facial (ruta absoluta del equipo). */
    async loadFaceFile(devicePath: string): Promise<Buffer | null> {
        const path = devicePath.startsWith('/') ? devicePath : `/${devicePath}`;
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
        try {
            const res = await fetch(`${this.base}/RPC2_LoadFaceFile${path}`, {
                headers: this.sessionHeaders(),
                signal: ctrl.signal,
            });
            if (!res.ok) return null;
            const buf = Buffer.from(await res.arrayBuffer());
            // Validamos la firma JPEG para no regresar HTML de error como imagen.
            if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
            return buf;
        } catch {
            return null;
        } finally {
            clearTimeout(timer);
        }
    }
}

/** Ejecuta `fn` dentro de una sesión RPC con login/logout garantizados. */
export async function withDahuaRpc<T>(
    opts: DahuaRpcOptions,
    fn: (session: DahuaRpcSession) => Promise<T>
): Promise<T> {
    const session = new DahuaRpcSession(opts);
    await session.login();
    try {
        return await fn(session);
    } finally {
        await session.logout();
    }
}
