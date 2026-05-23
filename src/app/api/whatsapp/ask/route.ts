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
 * Arquitectura: tool calling forzado (paridad con /api/query). El modelo
 * SIEMPRE debe llamar una de dos tools:
 *   - query_database: para cualquier pregunta sobre el negocio (datos)
 *   - respond_directly: solo para saludos/charla sin intención de dato
 * No hay salida de texto libre — eso elimina el escape hatch en el que
 * el modelo respondía "no tengo acceso al detalle" para evadir preguntas.
 *
 * Body:
 *   { "question": "...", "from_phone": "...", "tenant_id": "...", "timestamp": "..." }
 *
 * Auth: header X-API-Key debe coincidir con WHATSAPP_API_KEY.
 */

interface WhatsAppRequest {
    question?: string;
    from_phone?: string;
    tenant_id?: string;
    timestamp?: string;
}

const ANTHROPIC_MODEL = 'claude-sonnet-4-6'; // paridad con calidad del agente
const OPENAI_FALLBACK_MODEL = 'gpt-4o-mini'; // fallback cuando Anthropic devuelve 5xx/overloaded

const ANTHROPIC_TOOLS: any[] = [
    {
        name: 'query_database',
        description: 'Genera y ejecuta una consulta T-SQL read-only sobre el negocio (ventas, cancelaciones, retiros, cortes, tickets, productos, cajeros, supervisores, sucursales). ÚSALA SIEMPRE que la pregunta involucre datos — incluso preguntas multi-parte sobre quién/dónde/cuándo/cuánto. Tienes acceso COMPLETO a transacciones individuales: nunca digas que no puedes ver el detalle.',
        input_schema: {
            type: 'object',
            properties: {
                sql: {
                    type: 'string',
                    description: 'Consulta T-SQL SELECT. Usa corchetes para columnas con espacios: [Fecha Cancelacion], [Fecha Venta], [Precio Venta], [Codigo Barras]. Solo nombres exactos del schema.'
                }
            },
            required: ['sql']
        }
    },
    {
        name: 'respond_directly',
        description: 'ÚSALA SOLO para saludos ("hola", "buenos días"), agradecimientos o charla sin intención de dato. PROHIBIDO usarla para evitar consultas de negocio: si la pregunta menciona ventas, cancelaciones, códigos, montos, cajeros, sucursales o fechas, debes usar query_database aunque la consideres sensible o granular.',
        input_schema: {
            type: 'object',
            properties: {
                text: { type: 'string', description: 'Respuesta corta y cordial para chat de WhatsApp (max 300 chars, sin markdown).' }
            },
            required: ['text']
        }
    }
];

const OPENAI_TOOLS: any[] = ANTHROPIC_TOOLS.map(t => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.input_schema }
}));

interface PlannedToolCall {
    name: string;
    args: any;
}

async function planWithTools(systemPrompt: string, question: string, requestId: string): Promise<PlannedToolCall> {
    try {
        const resp = await anthropic.messages.create({
            model: ANTHROPIC_MODEL,
            max_tokens: 1024,
            system: systemPrompt,
            messages: [{ role: 'user', content: question }],
            tools: ANTHROPIC_TOOLS,
            tool_choice: { type: 'any' } // FORZAR uso de alguna tool: sin escape hatch de texto libre
        });
        const block = resp.content.find((c: any) => c.type === 'tool_use') as any;
        if (block) return { name: block.name, args: block.input };
        throw new Error('Anthropic no devolvió tool_use');
    } catch (err: any) {
        const status = err?.status ?? err?.response?.status;
        const transient = !status || status >= 500;
        if (!transient) throw err;
        console.warn(`[${requestId}] Claude falló (status=${status}, type=${err?.error?.error?.type || err?.error?.type}), fallback a ${OPENAI_FALLBACK_MODEL}`);
        const completion = await openai.chat.completions.create({
            model: OPENAI_FALLBACK_MODEL,
            max_tokens: 1024,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: question }
            ],
            tools: OPENAI_TOOLS,
            tool_choice: 'required' // equivalente a tool_choice:any en Anthropic
        });
        const msg = completion.choices[0].message;
        const tc = msg.tool_calls?.[0] as any;
        if (!tc) throw new Error('OpenAI no devolvió tool_call');
        return { name: tc.function.name, args: JSON.parse(tc.function.arguments) };
    }
}

async function narrate(prompt: string, maxTokens: number, requestId: string): Promise<string> {
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
        console.warn(`[${requestId}] Claude (narrate) falló (status=${status}), fallback a ${OPENAI_FALLBACK_MODEL}`);
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

        const schemaPath = path.join(process.cwd(), 'database-schema-ia.md');
        const schemaString = fs.readFileSync(schemaPath, 'utf-8');

        const currentDateTime = new Date().toLocaleString('es-MX', {
            timeZone: 'America/Monterrey',
            dateStyle: 'full',
            timeStyle: 'short'
        });

        const systemPrompt = `Eres Kesito en modo WhatsApp. Respondes preguntas sobre ventas, cancelaciones,
retiros y operación de retail con mensajes cortos, casuales, listos para chat
(sin markdown complejo, sin tablas).

FECHA Y HORA ACTUAL: ${currentDateTime}

──────────────────────────────────────────────────────────────
ACCESO A DATOS (no negociable)
──────────────────────────────────────────────────────────────
Tienes acceso COMPLETO de SOLO LECTURA a la base de datos del negocio vía SQL.
Esto incluye TODAS las transacciones individuales: ventas detalladas, cancelaciones
con cajero/supervisor/sucursal/hora, retiros, cortes, tickets, productos.

PROHIBIDO responder:
- "no tengo acceso al detalle"
- "no puedo ver transacciones individuales"
- "esos datos los maneja tu POS"
- "consulta con tu supervisor de sucursal"
- "ese nivel de detalle no está disponible"

Si la pregunta menciona ventas, cancelaciones, retiros, cortes, cajeros,
supervisores, tiendas, sucursales, artículos, códigos de barras, montos,
fechas, horas o tickets → llama query_database. Punto. No hay excepciones.

──────────────────────────────────────────────────────────────
CUÁNDO USAR CADA TOOL
──────────────────────────────────────────────────────────────
query_database (úsala casi siempre):
- Cualquier pregunta sobre cifras, transacciones, empleados, productos, sucursales.
- Preguntas multi-parte ("cuántas veces + dónde + quién") → un solo SELECT
  con todas las columnas/agrupaciones necesarias.

respond_directly (úsala SOLO para):
- Saludos puros: "hola", "buenos días", "buenas".
- Agradecimientos: "gracias", "ok".
- Preguntas sobre quién eres: "¿qué puedes hacer?", "¿cómo te llamas?".
- NUNCA para evitar una consulta de negocio.

──────────────────────────────────────────────────────────────
MAPEO LENGUAJE NATURAL → COLUMNAS
──────────────────────────────────────────────────────────────
- "quién" / "qué cajero" → [Cajero]. Si es cancelación o autorización, incluye [Supervisor].
- "dónde" / "qué sucursal" / "qué tienda" → [Tienda].
- "cuándo" / "a qué hora" / "qué día" → [Fecha Venta] (ventas), [Fecha Cancelacion]
  (cancelaciones), [Fecha Retiro] (retiros).
- "código de barras X" / "artículo X" (X numérico) → [Codigo Barras] = 'X' (string con comillas, columna con corchetes).
- "monto X" / "$X" / "por X pesos" → [Total] = X. Si la pregunta dice "similar" o
  hay decimales raros, usa BETWEEN X-1 AND X+1 para tolerancia.
- "última semana" → [FechaCorrespondiente] >= DATEADD(day, -7, GETDATE()).
- "cuántas veces" → COUNT(*) agrupado por las dimensiones que pida la pregunta.

──────────────────────────────────────────────────────────────
ESQUEMA DE LA BASE DE DATOS
──────────────────────────────────────────────────────────────
${schemaString.slice(0, 6000)}

──────────────────────────────────────────────────────────────
T-SQL PRECISO
──────────────────────────────────────────────────────────────
- SOLO SELECT (con WITH/CTE permitido). Nunca INSERT/UPDATE/DELETE/MERGE/DROP.
- Corchetes para columnas con espacios: [Fecha Venta], [Fecha Cancelacion],
  [Codigo Barras], [Precio Venta].
- Nombres exactos del schema. NO inventes columnas como Fecha_Cancelacion.
- Si la pregunta es ambigua sobre periodo, asume HOY o el más razonable.

EJEMPLO de pregunta real y SQL esperado:
Pregunta: "Código de barras 7472, monto 39.09, ¿cuántas veces se ha cancelado
la última semana, dónde y quién?"
SQL esperado:
  SELECT [Fecha Cancelacion], Tienda, Cajero, Supervisor, Cantidad, Total
  FROM Cancelaciones
  WHERE [Codigo Barras] = '7472'
    AND Total BETWEEN 38.09 AND 40.10
    AND [Fecha Cancelacion] >= DATEADD(day, -7, GETDATE())
  ORDER BY [Fecha Cancelacion] DESC;
`;

        // 1. Planning con tool calling forzado
        const toolCall = await planWithTools(systemPrompt, question, requestId);
        console.log(`[${requestId}] tool=${toolCall.name}`);

        // 2. respond_directly → respuesta corta sin SQL
        if (toolCall.name === 'respond_directly') {
            const answer = String(toolCall.args?.text || 'Aquí estoy. Pregúntame sobre ventas, cancelaciones, retiros o lo que necesites del negocio.').slice(0, 800);
            console.log(`[${requestId}] respond_directly (${Date.now() - startTime}ms)`);
            return NextResponse.json({
                answer,
                data: null,
                meta: {
                    rows_returned: 0,
                    elapsed_ms: Date.now() - startTime,
                    request_id: requestId,
                    from_phone: fromPhone,
                    tenant_id: tenantId,
                    tool: 'respond_directly'
                }
            });
        }

        if (toolCall.name !== 'query_database') {
            console.warn(`[${requestId}] tool desconocida: ${toolCall.name}`);
            return NextResponse.json({
                answer: 'No pude procesar tu pregunta. ¿Puedes reformularla?',
                data: null
            });
        }

        // 3. Ejecutar SQL con sandbox
        let safeSql: string;
        try {
            safeSql = assertReadOnly(String(toolCall.args?.sql || '').replace(/```sql|```/g, '').trim());
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

        // 4. Narrar resultados con formato WhatsApp
        const narratePrompt = `Eres Kesito respondiendo por WhatsApp. La consulta SQL ya se ejecutó.
Tu trabajo: redactar UNA respuesta corta y conversacional.

PREGUNTA: ${question}
SQL: ${safeSql}
RESULTADOS (primeras 10 filas): ${JSON.stringify(sampleRows)}
TOTAL DE FILAS: ${rows.length}

REGLAS DE FORMATO WHATSAPP:
- 1-4 oraciones máximo (target: 200 chars, max 700).
- Cifras con formato MXN ($14,820 con coma de miles).
- Sin markdown (** _ #) — texto plano puro o emojis ligeros.
- Conversacional, no robótico. Tutea ("vendiste").
- Si hay comparativa relevante (vs ayer, vs lunes pasado), inclúyela.
- Si los resultados están vacíos, dilo claramente: "No encontré cancelaciones con
  ese código y monto en la última semana" — y sugiere alternativa si aplica.
- Si hay varias filas, resume el conteo + lista 2-3 ejemplos clave con sucursal y cajero.

Devuelve SOLO el texto de la respuesta, nada más (sin JSON, sin comillas, sin prefijos).`;

        const narrateText = await narrate(narratePrompt, 400, requestId);
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
                tenant_id: tenantId,
                tool: 'query_database'
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
