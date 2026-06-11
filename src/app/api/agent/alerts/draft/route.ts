import { NextResponse } from 'next/server';
import { anthropic, ANTHROPIC_MODEL_FAST } from '@/lib/anthropic';
import { openai } from '@/lib/ai';
import { query } from '@/lib/db';
import { assertReadOnly } from '@/lib/sql-sandbox';
import { evaluateCondition, CondicionTipo, Frecuencia } from '@/lib/alerts';
import fs from 'fs';
import path from 'path';

/**
 * POST /api/agent/alerts/draft
 *
 * Convierte una descripción en lenguaje natural ("avísame si las cancelaciones
 * de hoy pasan de $5,000") en un borrador de alerta estructurado: nombre, SQL,
 * condición, valor, columna, frecuencia y un resumen en español claro.
 *
 * No guarda nada — solo propone. El cliente revisa el resumen, ajusta lo que
 * quiera (número/frecuencia/WhatsApp) y luego confirma contra POST /api/agent/alerts.
 *
 * Arquitectura: tool calling forzado (mismo patrón que /api/whatsapp/ask).
 * El SQL generado pasa por el sandbox read-only y se hace un dry-run para
 * mostrarle al usuario el valor actual ("ahorita está en X").
 */

const ANTHROPIC_MODEL = ANTHROPIC_MODEL_FAST;
const OPENAI_FALLBACK_MODEL = 'gpt-4o-mini';

const PROPOSE_TOOL = {
    name: 'propose_alert',
    description: 'Propone una alerta a partir de la descripción del usuario. Devuelve la consulta SQL, la condición a vigilar y un resumen en español claro.',
    input_schema: {
        type: 'object',
        properties: {
            name: { type: 'string', description: 'Título corto y claro de la alerta (max 60 chars). Ej: "Cancelaciones altas del día".' },
            description: { type: 'string', description: 'Una frase explicando qué vigila la alerta.' },
            sql: {
                type: 'string',
                description: 'Consulta T-SQL SELECT read-only. Para condiciones numéricas devuelve UN solo valor agregado con alias claro (ej. SELECT SUM(Total) AS Total FROM Cancelaciones WHERE ...). Para condición "has_rows" devuelve las filas que importan. Usa corchetes para columnas con espacios: [Fecha Venta], [Fecha Cancelacion], [Precio Venta], [Codigo Barras].'
            },
            conditionType: {
                type: 'string',
                enum: ['gt', 'gte', 'lt', 'lte', 'eq', 'neq', 'has_rows'],
                description: 'gt=mayor, gte=mayor/igual, lt=menor, lte=menor/igual, eq=igual, neq=distinto, has_rows=cuando la consulta devuelve al menos una fila.'
            },
            conditionValue: { type: 'number', description: 'Umbral numérico a comparar. Omítelo cuando conditionType sea has_rows.' },
            targetColumn: { type: 'string', description: 'Alias de la columna del SELECT que se evalúa (ej. "Total"). Debe coincidir con el alias del SQL. Omítelo para has_rows.' },
            frequency: {
                type: 'string',
                enum: ['5min', 'hourly', 'daily', 'weekly'],
                description: 'Cada cuánto revisar. "5min" para vigilancia en tiempo casi real, "hourly" para revisiones por hora, "daily" para acumulados del día, "weekly" para resúmenes semanales. Elige según el fraseo.'
            },
            summary: { type: 'string', description: 'Resumen en español natural de qué hará la alerta. Ej: "Te avisaré cada día si las cancelaciones de hoy suman más de $5,000." Sin tecnicismos, sin SQL.' }
        },
        required: ['name', 'sql', 'conditionType', 'frequency', 'summary']
    }
};

const OPENAI_TOOL = {
    type: 'function' as const,
    function: { name: PROPOSE_TOOL.name, description: PROPOSE_TOOL.description, parameters: PROPOSE_TOOL.input_schema }
};

async function planAlert(systemPrompt: string, userPrompt: string): Promise<any> {
    try {
        const resp = await anthropic.messages.create({
            model: ANTHROPIC_MODEL,
            max_tokens: 1500,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
            tools: [PROPOSE_TOOL as any],
            tool_choice: { type: 'tool', name: 'propose_alert' }
        });
        const block = resp.content.find((c: any) => c.type === 'tool_use') as any;
        if (block) return block.input;
        throw new Error('Anthropic no devolvió propose_alert');
    } catch (err: any) {
        const status = err?.status ?? err?.response?.status;
        const transient = !status || status >= 500;
        if (!transient) throw err;
        const completion = await openai.chat.completions.create({
            model: OPENAI_FALLBACK_MODEL,
            max_tokens: 1500,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            tools: [OPENAI_TOOL],
            tool_choice: { type: 'function', function: { name: 'propose_alert' } }
        });
        const tc = completion.choices[0].message.tool_calls?.[0] as any;
        if (!tc) throw new Error('OpenAI no devolvió propose_alert');
        return JSON.parse(tc.function.arguments);
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const userPrompt = String(body?.prompt || '').trim();
        if (!userPrompt) {
            return NextResponse.json({ error: 'Describe qué quieres vigilar.' }, { status: 400 });
        }
        if (userPrompt.length > 500) {
            return NextResponse.json({ error: 'La descripción es demasiado larga (max 500 caracteres).' }, { status: 400 });
        }

        const schemaPath = path.join(process.cwd(), 'database-schema-ia.md');
        const schemaString = fs.readFileSync(schemaPath, 'utf-8');
        const currentDateTime = new Date().toLocaleString('es-MX', {
            timeZone: 'America/Monterrey',
            dateStyle: 'full',
            timeStyle: 'short'
        });

        const systemPrompt = `Eres el asistente que arma ALERTAS para un dashboard de retail. El usuario describe en
lenguaje natural qué quiere que el sistema vigile, y tú lo conviertes en una alerta concreta
llamando a la tool propose_alert.

FECHA Y HORA ACTUAL: ${currentDateTime} (zona America/Monterrey)

QUÉ ES UNA ALERTA
Una alerta corre una consulta SQL cada cierto tiempo y se "dispara" cuando una condición se cumple
(ej. un total supera un umbral, o la consulta devuelve filas). Tu trabajo es traducir la intención
del usuario a: SQL + condición + frecuencia, más un resumen en español claro.

REGLAS PARA EL SQL
- SOLO SELECT read-only (WITH/CTE permitido). Nunca INSERT/UPDATE/DELETE/MERGE/DROP.
- Para condiciones numéricas (gt/gte/lt/lte/eq/neq): el SELECT debe devolver UN SOLO valor agregado
  con un alias claro, y ese alias va en targetColumn. Ej:
    SELECT SUM(Total) AS Total FROM Cancelaciones WHERE CAST([Fecha Cancelacion] AS DATE) = CAST(GETDATE() AS DATE)
    → conditionType gt, conditionValue 5000, targetColumn "Total"
- Para "avísame cuando exista/haya/aparezca algo" (sin umbral numérico) usa conditionType has_rows:
  el SELECT devuelve las filas que importan (con un WHERE que las filtre) y NO mandas conditionValue ni targetColumn. Ej:
    SELECT [Fecha Cancelacion], Tienda, Cajero, Total FROM Cancelaciones
    WHERE Total > 1000 AND CAST([Fecha Cancelacion] AS DATE) = CAST(GETDATE() AS DATE)
- Corchetes para columnas con espacios: [Fecha Venta], [Fecha Cancelacion], [Precio Venta], [Codigo Barras].
- Usa nombres EXACTOS del esquema. No inventes columnas.
- Vista Ventas: usa [Fecha Venta], [Precio Venta] con corchetes (no tblVentas).

ELECCIÓN DE FRECUENCIA (campo frequency)
- "hoy" / "del día" / acumulados diarios → daily (a menos que pidan vigilancia inmediata).
- "ahora mismo" / "en cuanto pase" / "en tiempo real" → 5min.
- "cada hora" → hourly.
- "esta semana" / "semanal" / resúmenes → weekly.
- Si no es claro, elige daily.

RESUMEN (campo summary)
Escribe una frase natural, sin SQL ni jerga, que el dueño de la tienda entienda de inmediato.
Ej: "Te avisaré cada día si las cancelaciones de hoy suman más de $5,000."

──────────────────────────────────────────────────────────────
ESQUEMA DE LA BASE DE DATOS
──────────────────────────────────────────────────────────────
${schemaString.slice(0, 7000)}
`;

        const draft = await planAlert(systemPrompt, userPrompt);

        // Normaliza y valida
        const validConditions: CondicionTipo[] = ['gt', 'gte', 'lt', 'lte', 'eq', 'neq', 'has_rows'];
        const validFrequencies: Frecuencia[] = ['5min', 'hourly', 'daily', 'weekly'];
        const conditionType: CondicionTipo = validConditions.includes(draft?.conditionType) ? draft.conditionType : 'gt';
        const frequency: Frecuencia = validFrequencies.includes(draft?.frequency) ? draft.frequency : 'daily';

        let safeSql: string;
        try {
            safeSql = assertReadOnly(String(draft?.sql || '').replace(/```sql|```/g, '').trim());
        } catch {
            return NextResponse.json({ error: 'La alerta generada no es de solo lectura. Reformula tu descripción.' }, { status: 400 });
        }

        const normalized = {
            name: String(draft?.name || 'Alerta sin título').slice(0, 200),
            description: draft?.description ? String(draft.description).slice(0, 500) : null,
            sql: safeSql,
            conditionType,
            conditionValue: conditionType === 'has_rows'
                ? undefined
                : (typeof draft?.conditionValue === 'number' ? draft.conditionValue : Number(draft?.conditionValue) || 0),
            targetColumn: conditionType === 'has_rows' ? undefined : (draft?.targetColumn ? String(draft.targetColumn).slice(0, 100) : undefined),
            frequency,
            summary: String(draft?.summary || '').slice(0, 400)
        };

        // Dry-run: validamos que el SQL corra y mostramos el valor/estado actual.
        // No es bloqueante — si falla, devolvemos el borrador igual con una nota.
        let preview: { ok: boolean; observedValue: number | null; wouldTriggerNow: boolean; error?: string } = {
            ok: false, observedValue: null, wouldTriggerNow: false
        };
        try {
            const rows = await query(safeSql) as any[];
            const { triggered, observedValue } = evaluateCondition(
                rows,
                normalized.conditionType,
                normalized.conditionValue ?? null,
                normalized.targetColumn ?? null
            );
            preview = { ok: true, observedValue, wouldTriggerNow: triggered };
        } catch (e: any) {
            preview = { ok: false, observedValue: null, wouldTriggerNow: false, error: e?.message || 'No se pudo probar la consulta.' };
        }

        return NextResponse.json({ draft: normalized, preview });
    } catch (error: any) {
        console.error('alerts/draft error:', error);
        return NextResponse.json(
            { error: error?.message || 'No pude generar la alerta. Intenta describirlo de otra forma.' },
            { status: 500 }
        );
    }
}
