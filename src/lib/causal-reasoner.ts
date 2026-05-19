/**
 * Razonamiento causal — cadena de hipótesis para responder "¿por qué pasó X?".
 *
 * Diferencia con investigator.ts:
 *  - investigator.ts: detecta UNA anomalía en los resultados Y propone UNA query
 *    de follow-up. Reactivo.
 *  - causal-reasoner.ts: detecta intención causal en la PREGUNTA y genera 4-6
 *    hipótesis sistemáticas que ejecuta en paralelo. Proactivo y exhaustivo.
 *
 * Flujo:
 *  1. detectCausalIntent() — clasifica si la pregunta es de tipo causal
 *  2. generateHypotheses() — Claude diseña 4-6 queries SQL de hipótesis
 *  3. executeHypotheses() — ejecuta todas en paralelo con sandbox
 *  4. (luego el endpoint principal pasa los resultados al meta-prompt
 *     con instrucción de eliminar hipótesis y concluir causa raíz)
 */

import { anthropic } from '@/lib/anthropic';
import { query } from '@/lib/db';
import { assertReadOnly } from '@/lib/sql-sandbox';

export interface CausalHypothesis {
    /** Nombre corto del ángulo (ej: "Distribución por hora del día") */
    label: string;
    /** Qué se está probando (1 oración) */
    description: string;
    /** SQL T-SQL read-only que prueba la hipótesis */
    sql: string;
}

export interface CausalHypothesisResult extends CausalHypothesis {
    /** Resultado del SQL (limitado a 10 filas) */
    rows: any[];
    /** Se ejecutó OK? */
    success: boolean;
    /** Error si fall */
    error?: string;
}

/** Heurística rápida para detectar preguntas causales sin llamar al LLM */
export function detectCausalIntent(prompt: string): boolean {
    const lower = prompt.toLowerCase();
    const causalMarkers = [
        '¿por qué', 'por qué',
        'que causó', 'qué causó', 'que causa', 'qué causa',
        'razón de', 'razon de',
        'a qué se debe', 'a que se debe',
        'qué explica', 'que explica',
        'por que motivo', 'por qué motivo',
        'investiga la caída', 'investiga el aumento',
        'analiza la caída', 'analiza el aumento',
        'diagnostica', 'diagnostico de',
        'causa raíz', 'causa raiz', 'root cause'
    ];
    return causalMarkers.some(m => lower.includes(m));
}

/**
 * Pide a Claude que diseñe 4-6 hipótesis SQL para investigar la pregunta.
 * Usa Haiku para velocidad — la generación de hipótesis es estructural,
 * no requiere razonamiento profundo.
 */
export async function generateHypotheses(opts: {
    userPrompt: string;
    schemaContext: string;
    pageContext?: string;
}): Promise<CausalHypothesis[]> {
    const { userPrompt, schemaContext, pageContext } = opts;

    const designerPrompt = `Eres un analista senior diseñando una investigación de causa raíz para retail.

PREGUNTA DEL USUARIO:
${userPrompt}

${pageContext ? `CONTEXTO DE LA PÁGINA: ${pageContext}\n` : ''}
ESQUEMA DISPONIBLE (read-only):
${schemaContext.slice(0, 4000)}

TU TAREA:
Diseña ENTRE 4 Y 6 hipótesis SQL para investigar la causa raíz de lo que pregunta el usuario.
Cada hipótesis debe explorar una dimensión DIFERENTE. Cubre estas dimensiones cuando aplique:

  - TEMPORAL: ¿La caída/aumento es uniforme en el día/semana/mes o se concentra en un período?
  - ESPACIAL: ¿Afecta a todas las sucursales por igual o se concentra en una?
  - CATEGÓRICA: ¿Es transversal a todos los departamentos/productos o se concentra?
  - OPERACIONAL: ¿Cambió la mezcla de cajeros, métodos de pago, tipos de venta?
  - COMPARATIVA: vs mismo día/semana del periodo anterior, vs promedio histórico
  - CLIENTE: ¿Cambió la base de clientes o el ticket promedio?

REGLAS PARA LAS QUERIES:
- SOLO SELECT (read-only, sin INSERT/UPDATE/DELETE/DROP/etc)
- Usa exactamente los nombres de tabla/columna del schema (corchetes para [Fecha Venta], etc.)
- Cada query debe ser corta y específica
- Deben ser independientes entre sí (corren en paralelo)
- Devuelve ~5-15 filas cada una, no datasets gigantes
- Si la pregunta no especifica fechas, usa los últimos 7 días vs los 7 días anteriores

RESPONDE EN JSON ESTRICTO (sin markdown):
{
  "hypotheses": [
    {
      "label": "Distribución horaria",
      "description": "¿La caída se concentra en alguna franja horaria?",
      "sql": "SELECT DATEPART(HOUR, [Fecha Venta]) ..."
    },
    ...
  ]
}

Genera entre 4 y 6 hipótesis. Devuelve SOLO el JSON.`;

    try {
        const response = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 3000,
            messages: [{ role: 'user', content: designerPrompt }]
        });

        const text = (response.content[0] as any)?.text || '';
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start < 0 || end <= start) return [];

        const parsed = JSON.parse(text.substring(start, end + 1));
        if (!Array.isArray(parsed.hypotheses)) return [];

        return parsed.hypotheses
            .filter((h: any) => h?.label && h?.sql)
            .slice(0, 6)
            .map((h: any) => ({
                label: String(h.label).slice(0, 100),
                description: String(h.description || '').slice(0, 200),
                sql: String(h.sql).replace(/```sql|```/g, '').trim()
            }));
    } catch (e) {
        console.error('generateHypotheses failed:', e);
        return [];
    }
}

/**
 * Ejecuta todas las hipótesis en paralelo. Cada query pasa por el sandbox.
 * Si una falla, no rompe las demás — se marca con success=false.
 */
export async function executeHypotheses(
    hypotheses: CausalHypothesis[]
): Promise<CausalHypothesisResult[]> {
    return Promise.all(
        hypotheses.map(async (h): Promise<CausalHypothesisResult> => {
            try {
                const safeSql = assertReadOnly(h.sql);
                const rows = await query(safeSql);
                return {
                    ...h,
                    rows: (rows as any[]).slice(0, 10),
                    success: true
                };
            } catch (e: any) {
                return {
                    ...h,
                    rows: [],
                    success: false,
                    error: e?.message || 'Error ejecutando hipótesis'
                };
            }
        })
    );
}

/** Convierte los resultados a un bloque de texto compacto para el meta-prompt */
export function formatHypothesesForPrompt(results: CausalHypothesisResult[]): string {
    return results.map((r, i) => {
        if (!r.success) {
            return `[H${i + 1}] ${r.label} — ${r.description}\n  ERROR: ${r.error}`;
        }
        const sample = JSON.stringify(r.rows.slice(0, 5));
        return `[H${i + 1}] ${r.label}\n  Pregunta: ${r.description}\n  Resultados: ${sample}`;
    }).join('\n\n');
}
