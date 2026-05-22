import { NextResponse } from 'next/server';
import { anthropic } from '@/lib/anthropic';
import { openai } from '@/lib/ai';
import { query } from '@/lib/db';
import { assertReadOnly } from '@/lib/sql-sandbox';
import fs from 'fs';
import path from 'path';

/**
 * POST /api/whatsapp/ask
 *
 * Endpoint pensado para un bridge de WhatsApp (Twilio, Meta Cloud API, n8n,
 * un Worker propio…). Recibe una pregunta de lenguaje natural y devuelve
 * una respuesta corta lista para enviar al chat.
 *
 * Body:
 *   {
 *     "question":   "¿cuánto vendimos hoy?",
 *     "from_phone": "+521555...",        // identifica al usuario
 *     "tenant_id":  "kesos-y-kosas",     // multi-tenant (por ahora informativo)
 *     "timestamp":  "2026-05-19T20:30:00Z"
 *   }
 *
 * Respuesta:
 *   {
 *     "answer": "Hoy vendiste $14,820 — 12% arriba del lunes pasado.",
 *     "data":   [...]   // raw rows del SQL, opcional
 *     "sql":    "SELECT ..."  // útil para auditoría
 *   }
 *
 * Auth: header `X-API-Key` que debe coincidir con `WHATSAPP_API_KEY` en env.
 * Si la env no está definida el endpoint responde 503 (no configurado).
 */

interface WhatsAppRequest {
    question?: string;
    from_phone?: string;
    tenant_id?: string;
    timestamp?: string;
}

const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001'; // rápido + económico para WhatsApp
const OPENAI_FALLBACK_MODEL = 'gpt-4o-mini'; // fallback cuando Anthropic devuelve 5xx/overloaded

async function askLLM(prompt: string, maxTokens: number, requestId: string): Promise<string> {
    try {
        const resp = await anthropic.messages.create({
            model: ANTHROPIC_MODEL,
            max_tokens: maxTokens,
            messages: [{ role: 'user', content: prompt }],
        });
        return (resp.content[0] as any)?.text || '';
    } catch (err: any) {
        const status = err?.status ?? err?.response?.status;
        const transient = !status || status >= 500;
        if (!transient) throw err;
        console.warn(`[${requestId}] Claude falló (status=${status}, type=${err?.error?.error?.type || err?.error?.type}), fallback a ${OPENAI_FALLBACK_MODEL}`);
        const completion = await openai.chat.completions.create({
            model: OPENAI_FALLBACK_MODEL,
            max_tokens: maxTokens,
            messages: [{ role: 'user', content: prompt }],
        });
        return completion.choices[0]?.message?.content || '';
    }
}

export async function POST(req: Request) {
    const startTime = Date.now();
    const requestId = `wa_${startTime.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    try {
        // 1. Validar API key
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

        // 2. Parsear y validar body
        const body: WhatsAppRequest = await req.json();
        const question = (body.question || '').trim();
        const fromPhone = (body.from_phone || '').trim();
        const tenantId = (body.tenant_id || '').trim();

        if (!question) {
            return NextResponse.json({ error: 'Falta question' }, { status: 400 });
        }
        if (question.length > 500) {
            return NextResponse.json({ error: 'question demasiado larga (max 500 chars)' }, { status: 400 });
        }

        console.log(`[${requestId}] whatsapp ask from=${fromPhone} tenant=${tenantId} q="${question.slice(0, 80)}"`);

        // 3. Cargar schema
        const schemaPath = path.join(process.cwd(), 'database-schema-ia.md');
        const schemaString = fs.readFileSync(schemaPath, 'utf-8');

        const currentDateTime = new Date().toLocaleString('es-MX', {
            timeZone: 'America/Monterrey',
            dateStyle: 'full',
            timeStyle: 'short'
        });

        // 4. Planning + SQL generation con una sola llamada
        const planPrompt = `Eres Kesito en modo WhatsApp. Respondes preguntas sobre ventas de retail con
mensajes cortos, casuales, listos para chat (sin markdown complejo, sin tablas).

FECHA Y HORA ACTUAL: ${currentDateTime}

ESQUEMA DE LA BASE DE DATOS:
${schemaString.slice(0, 6000)}

PREGUNTA DEL USUARIO:
${question}

INSTRUCCIONES:
- Genera UN solo SQL T-SQL read-only (SOLO SELECT) que responda la pregunta.
- Usa los nombres exactos del schema (corchetes para [Fecha Venta] etc.).
- Si la pregunta es ambigua sobre periodo, asume HOY o el más razonable.
- Si la pregunta NO necesita datos (saludo, charla), pon needs_query=false.

RESPONDE EN JSON ESTRICTO (sin markdown):
{
  "needs_query": true | false,
  "sql": "SELECT ..." | null,
  "direct_answer": "respuesta corta si no necesita query" | null
}`;

        const planText = await askLLM(planPrompt, 800, requestId);
        const ps = planText.indexOf('{');
        const pe = planText.lastIndexOf('}');
        if (ps < 0 || pe <= ps) {
            return NextResponse.json({
                answer: 'No pude entender la pregunta. ¿Puedes reformularla?',
                data: null
            });
        }
        const plan = JSON.parse(planText.substring(ps, pe + 1));

        // 5. Si no requiere query, respuesta directa
        if (!plan.needs_query || !plan.sql) {
            const answer = (plan.direct_answer || 'No tengo datos para responder eso.').slice(0, 800);
            console.log(`[${requestId}] no-query response (${Date.now() - startTime}ms)`);
            return NextResponse.json({ answer, data: null });
        }

        // 6. Ejecutar SQL con sandbox
        let safeSql: string;
        try {
            safeSql = assertReadOnly(String(plan.sql).replace(/```sql|```/g, '').trim());
        } catch (sandboxError: any) {
            console.error(`[${requestId}] sandbox blocked:`, sandboxError.message);
            return NextResponse.json({
                answer: 'No puedo ejecutar esa consulta por seguridad. Solo puedo leer datos.',
                data: null
            });
        }

        console.log(`[${requestId}] SQL: ${safeSql.slice(0, 200)}`);
        const rows = await query(safeSql) as any[];
        const sampleRows = rows.slice(0, 10);

        // 7. Generar respuesta narrativa corta (formato WhatsApp)
        const narratePrompt = `Eres Kesito respondiendo por WhatsApp. La consulta SQL ya se ejecutó.
Tu trabajo: redactar UNA respuesta corta y conversacional.

PREGUNTA: ${question}
SQL: ${safeSql}
RESULTADOS (primeras 10 filas): ${JSON.stringify(sampleRows)}

REGLAS DE FORMATO WHATSAPP:
- 1-3 oraciones máximo (target: 200 chars, max 600).
- Cifras con formato MXN ($14,820 con coma de miles).
- Sin markdown (** _ #) — texto plano puro o emojis ligeros.
- Conversacional, no robótico. Tutea ("vendiste").
- Si hay comparativa relevante (vs ayer, vs lunes pasado), inclúyela.
- Si los resultados están vacíos, dilo claramente y sugiere alternativa.

Devuelve SOLO el texto de la respuesta, nada más (sin JSON, sin comillas, sin prefijos).`;

        const narrateText = await askLLM(narratePrompt, 400, requestId);
        const answer = narrateText.trim().slice(0, 1500);

        const totalMs = Date.now() - startTime;
        console.log(`[${requestId}] done (${totalMs}ms, ${rows.length} rows)`);

        return NextResponse.json({
            answer,
            data: sampleRows.length > 0 ? sampleRows : null,
            sql: safeSql,
            meta: {
                rows_returned: rows.length,
                elapsed_ms: totalMs,
                request_id: requestId,
                from_phone: fromPhone,
                tenant_id: tenantId
            }
        });
    } catch (e: any) {
        console.error(`[${requestId}] error:`, e);
        return NextResponse.json({
            answer: 'Tuve un problema técnico. ¿Puedes intentar de nuevo en un momento?',
            data: null,
            error: e?.message || 'Error desconocido'
        }, { status: 500 });
    }
}
