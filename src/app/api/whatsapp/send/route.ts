import { NextResponse } from 'next/server';
import { sendWhatsApp } from '@/lib/whatsapp/send';

export const runtime = 'nodejs';

/**
 * POST /api/whatsapp/send
 *
 * Envío SALIENTE de WhatsApp para sistemas externos (ERP/POS vía kyk-proxi-ia).
 * A diferencia de /ask (pregunta a Kesito), aquí el texto va tal cual.
 *
 * Body: { "to": "+528112345678", "message": "..." }  (alias: phone / text)
 * Auth: header X-API-Key debe coincidir con WHATSAPP_API_KEY (misma del /ask).
 *
 * sendWhatsApp ya aplica las reglas del canal: aplanar multilínea (las
 * plantillas de Meta lo rechazan en silencio) y truncar a 800 (límite Axon).
 */
export async function POST(req: Request) {
    try {
        const expectedKey = process.env.WHATSAPP_API_KEY;
        if (!expectedKey) {
            return NextResponse.json(
                { error: 'WhatsApp endpoint no configurado (falta WHATSAPP_API_KEY en env)' },
                { status: 503 }
            );
        }
        const providedKey = req.headers.get('x-api-key') || req.headers.get('X-API-Key');
        if (!providedKey || providedKey !== expectedKey) {
            return NextResponse.json({ error: 'API key inválida o ausente' }, { status: 401 });
        }

        const body = await req.json().catch(() => ({}));
        const phone = String(body.to || body.phone || '').trim();
        const text = String(body.message || body.text || '').trim();
        if (!phone || !text) {
            return NextResponse.json(
                { error: 'Faltan campos: "to" (o "phone") y "message" (o "text")' },
                { status: 400 }
            );
        }

        const r = await sendWhatsApp({ phone, text });
        return NextResponse.json(
            { ok: r.ok, status: r.status ?? null, ...(r.error ? { error: r.error } : {}) },
            { status: r.ok ? 202 : 502 }
        );
    } catch (error: any) {
        console.error('whatsapp send error:', error);
        return NextResponse.json({ error: error.message || 'Error enviando WhatsApp' }, { status: 500 });
    }
}
