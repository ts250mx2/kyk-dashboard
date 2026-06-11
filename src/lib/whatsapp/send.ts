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
            return { ok: false, status: resp.status, error: `Outbound ${resp.status}` };
        }
        return { ok: true, status: resp.status };
    } catch (e: any) {
        console.error('[sendWhatsApp] error:', e?.message || e);
        return { ok: false, error: e?.message || 'Error enviando WhatsApp' };
    }
}
