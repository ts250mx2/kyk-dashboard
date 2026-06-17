import { createHash } from 'crypto';
import { query } from '@/lib/db';

/**
 * Envío de WhatsApp SALIENTE (push proactivo).
 *
 * El sistema recibe mensajes en /api/whatsapp/ask y responde síncrono; para
 * INICIAR un mensaje (digests programados, alertas) necesitamos un canal de
 * salida. Lo entrega el webservice de Axon Logic con un POST a:
 *
 *   POST https://api.axonlogic.com.mx/v1/outbound/alert
 *   { "to": "+528112345678", "message": "...", "source_app": "kyk-erp" }
 *
 * Auth: el saliente usa su PROPIA clave (distinta a la del inbound), que viaja
 * en el header X-API-Key.
 *
 * Config (.env):
 *   WHATSAPP_OUTBOUND_API_KEY   clave del endpoint saliente; header X-API-Key (requerida).
 *   WHATSAPP_OUTBOUND_URL       opcional; sobreescribe el endpoint (default Axon Logic).
 *   WHATSAPP_SOURCE_APP         opcional; identificador de la app (default 'kyk-erp').
 *
 * Nunca lanza: si falla, regresa { ok:false } y lo loguea, para no tumbar el
 * cron de envíos (alertas / reportes programados).
 */

const DEFAULT_OUTBOUND_URL = 'https://api.axonlogic.com.mx/v1/outbound/alert';
const DEFAULT_SOURCE_APP = 'kyk-erp';

export interface SendWhatsAppInput {
    phone: string;
    text: string;
    /** El link (si aplica) ya viene embebido en `text` por el llamador; se ignora en el payload. */
    link?: string;
    /**
     * Si es true, no reenvía un texto idéntico al mismo número dentro de la
     * ventana de dedup (WHATSAPP_DEDUP_WINDOW_MINUTES, default 120). Lo activan
     * los envíos AUTOMÁTICOS (cron) de alertas; el envío manual lo deja en false.
     */
    dedupe?: boolean;
}

export interface SendWhatsAppResult {
    ok: boolean;
    skipped?: boolean;
    error?: string;
    status?: number;
}

/**
 * Normaliza a E.164, que es lo que espera el endpoint (`to: "+528112345678"`).
 * El inbound de Axon ya llega así; los teléfonos capturados a mano en
 * alertas/reportes pueden venir como "8112345678" o "81 1234 5678".
 */
export function normalizePhone(raw: string): string {
    const trimmed = (raw || '').trim();
    const hadPlus = trimmed.startsWith('+');
    const digits = trimmed.replace(/\D/g, '');
    if (!digits) return '';
    if (hadPlus) return '+' + digits;                                   // ya venía en E.164
    if (digits.length === 10) return '+52' + digits;                    // MX sin lada de país
    if (digits.length === 12 && digits.startsWith('52')) return '+' + digits;
    return '+' + digits;                                                // mejor esfuerzo
}

/**
 * Axon mete nuestro texto como VARIABLE de una plantilla de WhatsApp Business,
 * y Meta rechaza (silenciosamente: queda "queued" y nunca llega) variables con
 * saltos de línea, tabs o 4+ espacios seguidos. Aplanamos a una sola línea.
 */
export function flattenForTemplate(text: string): string {
    return (text || '')
        .replace(/\s*\r?\n+\s*/g, ' · ')
        .replace(/\t/g, ' ')
        .replace(/ {2,}/g, ' ')
        .trim();
}

// ─── Dedup: no mandar el mismo mensaje dos veces al mismo dispositivo ──────
// Ventana en minutos; un texto idéntico al MISMO número dentro de la ventana
// no se reenvía. Cubre reintentos/dobles pasadas del cron y un número repetido
// en la lista. Configurable por env; default 120 min (2 h).
const DEDUP_WINDOW_MINUTES = Math.max(1, Number(process.env.WHATSAPP_DEDUP_WINDOW_MINUTES) || 120);

let dedupTableEnsured = false;
async function ensureDedupTable(): Promise<void> {
    if (dedupTableEnsured) return;
    await query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tblWhatsAppDedup' AND xtype='U')
        CREATE TABLE tblWhatsAppDedup (
            Phone NVARCHAR(40) NOT NULL,
            MsgHash CHAR(40) NOT NULL,
            FechaEnvio DATETIME NOT NULL DEFAULT GETDATE(),
            PRIMARY KEY (Phone, MsgHash)
        )
    `);
    dedupTableEnsured = true;
}

/**
 * Reclama atómicamente el envío (phone, hash). Devuelve true si NO hubo un
 * envío idéntico dentro de la ventana (procede a enviar) y false si es un
 * duplicado (se debe suprimir). El MERGE con HOLDLOCK serializa la decisión
 * para que dos pasadas del cron casi simultáneas no reclamen ambas.
 */
async function claimSend(phone: string, hash: string, windowMinutes: number): Promise<boolean> {
    await ensureDedupTable();
    const rows = await query(
        `MERGE tblWhatsAppDedup WITH (HOLDLOCK) AS t
         USING (SELECT ? AS Phone, ? AS MsgHash) AS s
            ON t.Phone = s.Phone AND t.MsgHash = s.MsgHash
         WHEN MATCHED AND t.FechaEnvio < DATEADD(MINUTE, -?, GETDATE()) THEN
            UPDATE SET FechaEnvio = GETDATE()
         WHEN NOT MATCHED THEN
            INSERT (Phone, MsgHash, FechaEnvio) VALUES (s.Phone, s.MsgHash, GETDATE())
         OUTPUT $action AS Act;`,
        [phone, hash, windowMinutes]
    );
    // Hubo INSERT o UPDATE → reclamamos el envío. Sin filas → ya había uno reciente.
    return Array.isArray(rows) && rows.length > 0;
}

/** Libera el claim cuando el envío falló, para no bloquear un reintento. */
async function releaseSend(phone: string, hash: string): Promise<void> {
    await query(`DELETE FROM tblWhatsAppDedup WHERE Phone = ? AND MsgHash = ?`, [phone, hash])
        .catch(() => { /* la guarda de dedup nunca debe tumbar el envío */ });
}

export async function sendWhatsApp(input: SendWhatsAppInput): Promise<SendWhatsAppResult> {
    const url = process.env.WHATSAPP_OUTBOUND_URL || process.env.WHATSAPP_OUTBOUND_WEBHOOK || DEFAULT_OUTBOUND_URL;
    const sourceApp = process.env.WHATSAPP_SOURCE_APP || DEFAULT_SOURCE_APP;
    const phone = normalizePhone(input.phone);
    // Axon valida `message` a máx. 800 caracteres; truncamos como red de seguridad.
    let text = flattenForTemplate(input.text);
    if (text.length > 800) text = text.slice(0, 799) + '…';

    if (!phone || !text) {
        return { ok: false, error: 'Falta phone o text' };
    }

    // Dedup (solo envíos automáticos): hash sobre el texto FINAL que recibe el
    // dispositivo, así dos entradas que se aplanan igual cuentan como el mismo.
    const hash = input.dedupe ? createHash('sha1').update(text).digest('hex') : '';
    if (input.dedupe) {
        const claimed = await claimSend(phone, hash, DEDUP_WINDOW_MINUTES).catch((e) => {
            console.error('[sendWhatsApp] dedup falló, se envía igual:', e?.message || e);
            return true; // si la guarda revienta, mejor enviar que perder la alerta
        });
        if (!claimed) {
            console.log(`[sendWhatsApp] duplicado suprimido a ${phone} (mismo texto < ${DEDUP_WINDOW_MINUTES} min)`);
            return { ok: true, skipped: true };
        }
    }

    try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (process.env.WHATSAPP_OUTBOUND_API_KEY) headers['X-API-Key'] = process.env.WHATSAPP_OUTBOUND_API_KEY;

        const resp = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({ to: phone, message: text, source_app: sourceApp }),
        });
        if (!resp.ok) {
            const body = await resp.text().catch(() => '');
            console.error(`[sendWhatsApp] ${url} respondió ${resp.status}: ${body.slice(0, 200)}`);
            if (input.dedupe) await releaseSend(phone, hash); // no llegó: libera para reintentar
            return { ok: false, status: resp.status, error: `Outbound ${resp.status}` };
        }
        return { ok: true, status: resp.status };
    } catch (e: any) {
        console.error('[sendWhatsApp] error:', e?.message || e);
        if (input.dedupe) await releaseSend(phone, hash); // no llegó: libera para reintentar
        return { ok: false, error: e?.message || 'Error enviando WhatsApp' };
    }
}
