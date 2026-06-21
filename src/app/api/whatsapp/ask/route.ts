import { NextResponse } from 'next/server';
import { anthropic, ANTHROPIC_MODEL_FAST } from '@/lib/anthropic';
import { openai } from '@/lib/ai';
import { query, localizeDatesForModel } from '@/lib/db';
import { assertReadOnly } from '@/lib/sql-sandbox';
import {
    runForecastForAgent,
    getProductRecommendationsForAgent,
    renderForecastSummaryForAgent,
    renderProductRecommendationsForAgent,
} from '@/lib/forecast/agent-tools';
import { maybeBuildShare } from '@/lib/whatsapp-shares/build-share';
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

const ANTHROPIC_MODEL = ANTHROPIC_MODEL_FAST; // configurable vía .env (ANTHROPIC_MODEL_FAST)
const OPENAI_FALLBACK_MODEL = 'gpt-4o-mini'; // fallback cuando Anthropic devuelve 5xx/overloaded

// WhatsApp debe responder rápido: timeout corto POR LLAMADA para no heredar el
// timeout global del SDK (30 min). Configurable vía WHATSAPP_AI_TIMEOUT_MS.
const WA_AI_TIMEOUT_MS = Number(process.env.WHATSAPP_AI_TIMEOUT_MS) || 20000;

// Decide si conviene caer al fallback de OpenAI. Cubre: timeouts/red (sin status),
// sobrecarga (429/5xx) y SALDO AGOTADO de Anthropic (400 "credit balance too low").
function shouldFallbackToOpenAI(err: any): boolean {
    const status = err?.status ?? err?.response?.status;
    if (!status) return true;                       // timeout/conexión
    if (status === 429 || status >= 500) return true; // rate limit / overloaded / 5xx
    const msg = String(err?.error?.error?.message || err?.error?.message || err?.message || '').toLowerCase();
    return msg.includes('credit balance') || msg.includes('billing') || msg.includes('quota') || msg.includes('insufficient');
}

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
    },
    {
        name: 'get_sales_forecast',
        description: 'Devuelve la PROYECCIÓN DE VENTAS oficial del dashboard (promedio móvil estacional + ajuste por feriados + proyección vs meta + tendencia + MAPE). ÚSALA cuando la pregunta sea sobre el futuro: "¿cuánto vamos a vender la próxima semana?", "¿voy a llegar a la meta?", "¿proyección de Bodega 238 este mes?". No la uses para datos históricos (eso es query_database).',
        input_schema: {
            type: 'object',
            properties: {
                horizonDays: { type: 'number', description: 'Días a proyectar hacia adelante (1-180). Default 30. Si el usuario dice "semana" usa 7, "mes" usa 30, "quincena" usa 15.' },
                storeNames: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Nombres parciales de sucursales para filtrar (LIKE %nombre%). Ej: ["Bodega 238", "Aramberri"]. Si no especificas ninguna, considera todas las sucursales.'
                }
            },
            required: []
        }
    },
    {
        name: 'get_product_recommendations',
        description: 'Devuelve los productos sugeridos a empujar/cargar/monitorear/reducir para los próximos N días, cruzando histórico reciente con mismo período del año pasado. ÚSALA cuando la pregunta sea: "¿qué productos cargar la próxima semana?", "¿qué empujar para Día de las Madres?", "¿en qué enfocarme la siguiente quincena?".',
        input_schema: {
            type: 'object',
            properties: {
                horizonDays: { type: 'number', description: 'Días futuros a considerar (1-180). Default 30.' },
                topN: { type: 'number', description: 'Cuántos productos devolver (5-30). Default 15.' },
                storeNames: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Nombres parciales de sucursales para filtrar. Ej: ["Bodega 238"]. Si no especificas, considera todas.'
                }
            },
            required: []
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
        }, { timeout: WA_AI_TIMEOUT_MS, maxRetries: 0 }); // fail-fast: si falla, caemos a OpenAI
        const block = resp.content.find((c: any) => c.type === 'tool_use') as any;
        if (block) return { name: block.name, args: block.input };
        throw new Error('Anthropic no devolvió tool_use');
    } catch (err: any) {
        if (!shouldFallbackToOpenAI(err)) throw err;
        const status = err?.status ?? err?.response?.status;
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
        }, { timeout: WA_AI_TIMEOUT_MS, maxRetries: 1 });
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
        }, { timeout: WA_AI_TIMEOUT_MS, maxRetries: 0 });
        return (resp.content[0] as any)?.text || '';
    } catch (err: any) {
        if (!shouldFallbackToOpenAI(err)) throw err;
        const status = err?.status ?? err?.response?.status;
        console.warn(`[${requestId}] Claude (narrate) falló (status=${status}), fallback a ${OPENAI_FALLBACK_MODEL}`);
        const completion = await openai.chat.completions.create({
            model: OPENAI_FALLBACK_MODEL,
            max_tokens: maxTokens,
            messages: [{ role: 'user', content: prompt }],
        }, { timeout: WA_AI_TIMEOUT_MS, maxRetries: 1 });
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
        // Base absoluta para el link compartible (config recomendada vía PUBLIC_BASE_URL;
        // fallback al origin del request). El link apunta a la página pública /r/<uuid>.
        const baseUrl = (process.env.PUBLIC_BASE_URL || new URL(req.url).origin).replace(/\/$/, '');

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
Tienes acceso COMPLETO de SOLO LECTURA a la base de datos del negocio vía SQL,
MÁS herramientas analíticas del dashboard: modelo de proyección de ventas
(SMA estacional + ajuste por feriados + comparativo vs meta) y motor de
sugerencias de productos (cruza venta reciente con mismo período LY para
clasificar qué cargar/empujar/monitorear/reducir).

PROHIBIDO responder:
- "no tengo acceso al detalle"
- "no puedo ver transacciones individuales"
- "esos datos los maneja tu POS"
- "consulta con tu supervisor de sucursal"
- "ese nivel de detalle no está disponible"
- "no tengo acceso a planificación de inventario futuro"
- "necesitas hablar con el operador de logística"
- "no puedo proyectar ventas" (SÍ PUEDES con get_sales_forecast)
- "no puedo sugerir qué productos cargar" (SÍ PUEDES con get_product_recommendations)

Si la pregunta menciona ventas, cancelaciones, retiros, cortes, cajeros,
supervisores, tiendas, sucursales, artículos, códigos de barras, montos,
fechas, horas o tickets → llama query_database. Punto. No hay excepciones.

Si la pregunta es sobre el FUTURO ("próxima semana", "este mes", "voy a llegar
a la meta", "cuánto vamos a vender", "proyección") → llama get_sales_forecast.

Si la pregunta es sobre QUÉ PRODUCTOS empujar/cargar/recomendar para días
futuros ("qué cargar la próxima semana", "qué empujar para Día de las Madres",
"productos a recomendar para X sucursal") → llama get_product_recommendations.

──────────────────────────────────────────────────────────────
CUÁNDO USAR CADA TOOL
──────────────────────────────────────────────────────────────
query_database — para HISTÓRICO y datos crudos:
- Cualquier pregunta sobre cifras, transacciones, empleados, productos, sucursales.
- Preguntas multi-parte ("cuántas veces + dónde + quién") → un solo SELECT.
- Top productos del PASADO, ventas de un período YA cerrado.

get_sales_forecast — para PROYECCIÓN A FUTURO:
- "¿cuánto vamos a vender la próxima semana?"
- "¿voy a llegar a la meta de mayo?"
- "proyección de Bodega 238 este mes"
- "¿cómo viene el cierre?"
- Parámetro storeNames acepta nombre parcial (ej. ["Bodega 238"]).
- Parámetro horizonDays: "semana"=7, "quincena"=15, "mes"=30, "trimestre"=90.

get_product_recommendations — para PLANEACIÓN DE PRODUCTOS:
- "¿qué productos cargar la próxima semana en Bodega 238?"
- "¿qué empujar para Día de las Madres?"
- "¿en qué productos enfocarme la siguiente quincena?"
- "productos a recomendar para promoción del 15 de septiembre"
- Cruza venta reciente + LY estacional, devuelve productos con acción sugerida.

respond_directly (úsala SOLO para):
- Saludos puros: "hola", "buenos días", "buenas".
- Agradecimientos: "gracias", "ok".
- Preguntas sobre quién eres: "¿qué puedes hacer?", "¿cómo te llamas?".
- NUNCA para evitar una consulta de negocio o de planeación.
- NUNCA para decir "no tengo acceso" — si menciona ventas/productos/proyección,
  ELIGE el tool correcto en su lugar.

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
- "horario" / "a qué hora abre/cierra" / "horarios de venta" de una tienda → NO existe
  un campo de horario oficial en la base. Deriva la VENTANA DE ACTIVIDAD DE VENTAS con
  MIN([Fecha Venta]) y MAX([Fecha Venta]), GROUP BY [Tienda] (por defecto AYER, o el
  período que pidan). REDACCIÓN OBLIGATORIA: di "primera venta a las HH:MM, última venta
  a las HH:MM" — NUNCA "abrió/cerró a las...", porque eso NO es el horario oficial de la
  tienda, solo cuándo hubo movimiento de caja. Si piden el horario oficial explícitamente,
  aclara que solo tienes la actividad de ventas, no el horario de operación.

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

        // 2b. get_sales_forecast → corre el modelo de proyección y narra
        if (toolCall.name === 'get_sales_forecast') {
            try {
                const summary = await runForecastForAgent({
                    horizonDays: toolCall.args?.horizonDays,
                    storeNames: toolCall.args?.storeNames,
                });
                const block = renderForecastSummaryForAgent(summary);
                const narratePrompt = `Eres Kesito respondiendo por WhatsApp. Acabas de correr el modelo oficial de PROYECCIÓN DE VENTAS del dashboard.

PREGUNTA DEL USUARIO: ${question}

RESULTADO DE LA PROYECCIÓN:
${block}

REGLAS DE FORMATO WHATSAPP:
- 1-5 oraciones (target 350 chars, max 800).
- Cifras con formato MXN ($14,820 con coma de miles).
- Sin markdown, texto plano puro o emojis ligeros.
- Conversacional, tutea ("vas a", "estás").
- Si la pregunta es sobre meta, prioriza esa información (% esperado, faltante).
- Si hay un feriado relevante con multiplier, menciónalo.
- Si la confianza del modelo es baja (MAPE > 20%), advierte sutilmente.

Devuelve SOLO el texto. Sin prefijos.`;
                const answer = (await narrate(narratePrompt, 500, requestId)).trim().slice(0, 1500);
                console.log(`[${requestId}] get_sales_forecast done (${Date.now() - startTime}ms)`);
                const fcRows = summary.forecastSample.map((p) => ({
                    Fecha: p.fecha,
                    'Venta proyectada': Math.round(p.predicted),
                    'Venta mínima': Math.round(p.lower),
                    'Venta máxima': Math.round(p.upper),
                }));
                const fcShare = await maybeBuildShare({ question, answer, tool: 'get_sales_forecast', rows: fcRows, viz: 'area', fromPhone, tenantId, baseUrl });
                const fcAnswer = fcShare ? `${answer}\n\n📊 Ver gráfica: ${fcShare.url}` : answer;
                return NextResponse.json({
                    answer: fcAnswer,
                    link: fcShare?.url ?? null,
                    data: summary,
                    meta: {
                        rows_returned: summary.forecastSample.length,
                        elapsed_ms: Date.now() - startTime,
                        request_id: requestId,
                        from_phone: fromPhone,
                        tenant_id: tenantId,
                        tool: 'get_sales_forecast',
                        share_url: fcShare?.url ?? null
                    }
                });
            } catch (e: any) {
                console.error(`[${requestId}] get_sales_forecast error:`, e);
                return NextResponse.json({
                    answer: 'No pude generar la proyección en este momento. ¿Puedes intentar de nuevo?',
                    error: e?.message
                });
            }
        }

        // 2c. get_product_recommendations → sugerencias de productos para el horizonte
        if (toolCall.name === 'get_product_recommendations') {
            try {
                const rec = await getProductRecommendationsForAgent({
                    horizonDays: toolCall.args?.horizonDays,
                    storeNames: toolCall.args?.storeNames,
                    topN: toolCall.args?.topN,
                });
                const block = renderProductRecommendationsForAgent(rec, Number(toolCall.args?.horizonDays) || 30);
                const narratePrompt = `Eres Kesito respondiendo por WhatsApp. Acabas de generar SUGERENCIAS DE PRODUCTOS con datos cruzados de venta reciente y mismo período del año pasado.

PREGUNTA DEL USUARIO: ${question}

LISTA DE PRODUCTOS:
${block}

REGLAS DE FORMATO WHATSAPP:
- Máximo 6 oraciones / 900 chars.
- Menciona 3-5 productos concretos por nombre.
- Agrupa por acción (cargar/empujar/etc.) cuando ayude.
- Cifras MXN con coma de miles.
- Texto plano puro, sin markdown.

Devuelve SOLO el texto. Sin prefijos.`;
                const answer = (await narrate(narratePrompt, 600, requestId)).trim().slice(0, 1800);
                console.log(`[${requestId}] get_product_recommendations done (${Date.now() - startTime}ms, ${rec.products.length} productos)`);
                const recRows = rec.products.map((p) => ({
                    Producto: p.descripcion,
                    Depto: p.depto,
                    'Venta reciente': Math.round(p.recentTotal),
                    Acción: p.actionHint,
                }));
                const recShare = await maybeBuildShare({ question, answer, tool: 'get_product_recommendations', rows: recRows, viz: 'bar', fromPhone, tenantId, baseUrl });
                const recAnswer = recShare ? `${answer}\n\n📊 Ver tabla: ${recShare.url}` : answer;
                return NextResponse.json({
                    answer: recAnswer,
                    link: recShare?.url ?? null,
                    data: rec,
                    meta: {
                        rows_returned: rec.products.length,
                        elapsed_ms: Date.now() - startTime,
                        request_id: requestId,
                        from_phone: fromPhone,
                        tenant_id: tenantId,
                        tool: 'get_product_recommendations',
                        share_url: recShare?.url ?? null
                    }
                });
            } catch (e: any) {
                console.error(`[${requestId}] get_product_recommendations error:`, e);
                return NextResponse.json({
                    answer: 'No pude generar las sugerencias de productos ahorita. ¿Lo intentamos de nuevo?',
                    error: e?.message
                });
            }
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
RESULTADOS (primeras 10 filas): ${JSON.stringify(localizeDatesForModel(sampleRows))}
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
- Si el SQL usa MIN/MAX de [Fecha Venta] (ventana de actividad de una tienda), di
  "primera venta a las HH:MM, última venta a las HH:MM" — NUNCA "abrió/cerró a las...",
  porque eso NO es el horario oficial de la tienda, solo cuándo hubo movimiento.

Devuelve SOLO el texto de la respuesta, nada más (sin JSON, sin comillas, sin prefijos).`;

        const narrateText = await narrate(narratePrompt, 400, requestId);
        const answer = narrateText.trim().slice(0, 1500);

        const totalMs = Date.now() - startTime;
        console.log(`[${requestId}] done (${totalMs}ms, ${rows.length} rows)`);

        // Si la respuesta amerita gráfica/tabla, congela un snapshot y devuelve el link.
        const share = await maybeBuildShare({ question, answer, tool: 'query_database', rows, viz: null, sql: safeSql, fromPhone, tenantId, baseUrl });
        const answerWithLink = share ? `${answer}\n\n📊 Ver gráfica y tabla: ${share.url}` : answer;

        return NextResponse.json({
            answer: answerWithLink,
            link: share?.url ?? null,
            data: sampleRows.length > 0 ? sampleRows : null,
            sql: safeSql,
            meta: {
                rows_returned: rows.length,
                elapsed_ms: totalMs,
                request_id: requestId,
                from_phone: fromPhone,
                tenant_id: tenantId,
                tool: 'query_database',
                share_url: share?.url ?? null
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
