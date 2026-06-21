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

import { anthropic, ANTHROPIC_MODEL_CHEAP } from '@/lib/anthropic';
import { query, localizeDatesForModel } from '@/lib/db';
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
    /** Veredicto heurístico calculado sin LLM */
    evidence?: HypothesisEvidence;
}

export interface HypothesisEvidence {
    /** Fuerza de la señal: strong (>=70% concentración o varianza alta) | partial | weak (uniforme/ruido) */
    verdict: 'strong' | 'partial' | 'weak';
    /** Frase corta lista para mostrar al LLM final (ej: "Top sucursal concentra 78% del total") */
    summary: string;
    /** Dimensión donde se detectó concentración, si aplica */
    topDimension?: { column: string; value: string; share: number };
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
 *
 * Si se pasan `firstResults` y `firstSql`, el diseñador ve la evidencia real
 * de la consulta principal y enfoca hipótesis hacia las dimensiones que
 * muestran varianza, ignorando las que ya se ven uniformes.
 */
export async function generateHypotheses(opts: {
    userPrompt: string;
    schemaContext: string;
    pageContext?: string;
    firstSql?: string | null;
    firstResults?: any[];
    playbookHints?: string[];
}): Promise<CausalHypothesis[]> {
    const { userPrompt, schemaContext, pageContext, firstSql, firstResults, playbookHints } = opts;

    const playbookBlock = playbookHints && playbookHints.length > 0 ? `

ÁNGULOS SUGERIDOS POR PLAYBOOK DEL USUARIO:
El usuario tiene un playbook guardado que ya investigó preguntas similares con estos pasos:
${playbookHints.map((h, i) => `  ${i + 1}. ${h}`).join('\n')}

USA estos pasos como inspiración: si alguno encaja como hipótesis para la pregunta actual,
inclúyelo (traducido a SQL). No estás obligado a incluirlos todos — solo los relevantes.
` : '';

    const evidenceBlock = firstResults && firstResults.length > 0 ? `

EVIDENCIA YA OBSERVADA (consulta principal del usuario):
SQL ejecutado: ${firstSql || '(no disponible)'}
Resultados (primeros 10 filas): ${JSON.stringify(localizeDatesForModel(firstResults.slice(0, 10)))}

USA esta evidencia para DIRIGIR tus hipótesis:
- Si los datos ya muestran concentración en una dimensión (ej: una sucursal, una hora, un departamento), tus hipótesis deben PROFUNDIZAR en esa dimensión, no replicarla.
- Si una dimensión ya luce uniforme en los datos, NO la pruebes — sería ruido.
- Si los datos sugieren un patrón temporal (caída concentrada en un día), tus hipótesis deben buscar QUÉ pasó en ese día (cajeros, métodos de pago, productos faltantes).
- Prioriza hipótesis que respondan "¿POR QUÉ se ve este patrón?" antes que "¿EXISTE el patrón?".
` : '';

    const designerPrompt = `Eres un analista senior diseñando una investigación de causa raíz para retail.

PREGUNTA DEL USUARIO:
${userPrompt}

${pageContext ? `CONTEXTO DE LA PÁGINA: ${pageContext}\n` : ''}
ESQUEMA DISPONIBLE (read-only):
${schemaContext.slice(0, 4000)}${playbookBlock}${evidenceBlock}

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
            model: ANTHROPIC_MODEL_CHEAP,
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
 * Cada resultado exitoso lleva un veredicto heurístico calculado sin LLM.
 */
export async function executeHypotheses(
    hypotheses: CausalHypothesis[]
): Promise<CausalHypothesisResult[]> {
    return Promise.all(
        hypotheses.map(async (h): Promise<CausalHypothesisResult> => {
            try {
                const safeSql = assertReadOnly(h.sql);
                console.log(`\n\x1b[35m[AGENT SQL - HIPÓTESIS: ${h.label.toUpperCase()}]\x1b[0m\n${safeSql}\n`);
                const rawRows = await query(safeSql);
                const rows = (rawRows as any[]).slice(0, 10);
                const evidence = evaluateEvidence(rows);
                return {
                    ...h,
                    rows,
                    success: true,
                    evidence
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

/**
 * Evaluador heurístico sin LLM. Mira las filas y decide si la hipótesis
 * encontró una señal fuerte (concentración, varianza), parcial o débil.
 *
 * Asunciones razonables para nuestro flujo:
 *  - La primera columna no-numérica suele ser la dimensión (sucursal/día/categoría)
 *  - La columna numérica con mayor magnitud suele ser la métrica (ventas/cantidad)
 *  - Concentración top1/total >= 0.5 → señal fuerte; >= 0.3 → parcial; resto débil
 *  - Si todo es uniforme (CV < 0.2) → débil aunque haya muchas filas
 */
export function evaluateEvidence(rows: any[]): HypothesisEvidence {
    if (!rows || rows.length === 0) {
        return { verdict: 'weak', summary: 'Sin filas devueltas — hipótesis no aplica.' };
    }
    if (rows.length === 1) {
        return { verdict: 'weak', summary: 'Solo 1 fila — no hay distribución que comparar.' };
    }

    const cols = Object.keys(rows[0]);
    if (cols.length === 0) {
        return { verdict: 'weak', summary: 'Sin columnas legibles.' };
    }

    // Detectar columna dimensión: primera string/fecha. Columna métrica: numérica de mayor magnitud absoluta.
    const dimCol = cols.find(c => {
        const v = rows[0][c];
        return typeof v === 'string' || v instanceof Date;
    }) || cols[0];

    const numericCols = cols.filter(c => {
        const v = rows[0][c];
        return typeof v === 'number' && c !== dimCol;
    });

    if (numericCols.length === 0) {
        return { verdict: 'weak', summary: `${rows.length} filas sin columna numérica para evaluar.` };
    }

    // Métrica = la numérica cuyo valor absoluto promedio es mayor
    const metricCol = numericCols.reduce((best, c) => {
        const avgC = rows.reduce((s, r) => s + Math.abs(Number(r[c]) || 0), 0) / rows.length;
        const avgBest = rows.reduce((s, r) => s + Math.abs(Number(r[best]) || 0), 0) / rows.length;
        return avgC > avgBest ? c : best;
    }, numericCols[0]);

    const values = rows.map(r => Math.abs(Number(r[metricCol]) || 0));
    const total = values.reduce((a, b) => a + b, 0);

    if (total === 0) {
        return { verdict: 'weak', summary: `Métrica "${metricCol}" suma 0 — sin señal.` };
    }

    // Concentración del top
    const sorted = rows
        .map((r, i) => ({ label: String(r[dimCol]), value: values[i] }))
        .sort((a, b) => b.value - a.value);
    const top = sorted[0];
    const share = top.value / total;

    // Coeficiente de variación (desviación estándar / media) para detectar uniformidad
    const mean = total / values.length;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;

    const sharePct = Math.round(share * 100);
    const topDimension = { column: dimCol, value: top.label, share };

    if (share >= 0.5) {
        return {
            verdict: 'strong',
            summary: `"${top.label}" concentra ${sharePct}% de ${metricCol} (${rows.length} grupos). Señal fuerte de causa localizada.`,
            topDimension
        };
    }
    if (share >= 0.3 || cv >= 0.8) {
        return {
            verdict: 'partial',
            summary: `"${top.label}" representa ${sharePct}% de ${metricCol}; varianza moderada (CV=${cv.toFixed(2)}).`,
            topDimension
        };
    }
    return {
        verdict: 'weak',
        summary: `Distribución uniforme entre ${rows.length} grupos (top "${top.label}" solo ${sharePct}%, CV=${cv.toFixed(2)}). No hay concentración explicativa.`,
        topDimension
    };
}

/**
 * Genera 1-2 sub-hipótesis profundas enfocadas en la concentración detectada
 * por una hipótesis fuerte. Ej: si la hipótesis padre encontró que la sucursal
 * "Centro" concentra el 78% de la caída, las sub-hipótesis preguntan QUÉ pasó
 * específicamente en Centro (cajeros, productos, horas) para explicar la causa.
 *
 * Solo se llama para hipótesis con verdict === 'strong'.
 */
export async function generateDeepDive(opts: {
    userPrompt: string;
    parent: CausalHypothesisResult;
    schemaContext: string;
}): Promise<CausalHypothesis[]> {
    const { userPrompt, parent, schemaContext } = opts;
    if (!parent.evidence || parent.evidence.verdict !== 'strong' || !parent.evidence.topDimension) {
        return [];
    }

    const focus = parent.evidence.topDimension;
    const designerPrompt = `Eres un analista senior haciendo una investigación de causa raíz en SEGUNDA RONDA.

PREGUNTA ORIGINAL DEL USUARIO:
${userPrompt}

HIPÓTESIS PADRE QUE CONFIRMÓ UNA CONCENTRACIÓN:
- Ángulo: ${parent.label}
- Pregunta original: ${parent.description}
- Hallazgo: ${parent.evidence.summary}
- Dimensión concentrada: ${focus.column} = "${focus.value}" (${Math.round(focus.share * 100)}% del total)
- Datos crudos: ${JSON.stringify(localizeDatesForModel(parent.rows.slice(0, 5)))}

ESQUEMA DISPONIBLE (read-only):
${schemaContext.slice(0, 3000)}

TU TAREA:
Diseña EXACTAMENTE 1 o 2 sub-hipótesis SQL que profundicen en "${focus.value}".
NO repitas la dimensión que ya está concentrada — busca QUÉ pasó dentro de "${focus.value}":
  - Si la concentración es por sucursal → mira cajeros, productos, horarios, métodos de pago DENTRO de esa sucursal
  - Si la concentración es por día/hora → mira qué cambió ese día (productos, cajeros, eventos)
  - Si la concentración es por departamento/producto → mira sucursales, proveedores, márgenes de ese departamento

REGLAS:
- SOLO SELECT
- Filtra explícitamente por ${focus.column} = "${focus.value}" (o el equivalente SQL correcto)
- Máximo 2 hipótesis, cada una con 5-15 filas

RESPONDE EN JSON ESTRICTO (sin markdown):
{
  "hypotheses": [
    {
      "label": "Cajero responsable en ${focus.value}",
      "description": "¿Qué cajero concentra la caída dentro de ${focus.value}?",
      "sql": "SELECT ... WHERE ${focus.column} = '${focus.value}' ..."
    }
  ]
}

Devuelve SOLO el JSON.`;

    try {
        const response = await anthropic.messages.create({
            model: ANTHROPIC_MODEL_CHEAP,
            max_tokens: 1500,
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
            .slice(0, 2)
            .map((h: any) => ({
                label: `↳ ${String(h.label).slice(0, 100)}`,
                description: String(h.description || '').slice(0, 200),
                sql: String(h.sql).replace(/```sql|```/g, '').trim()
            }));
    } catch (e) {
        console.error('generateDeepDive failed:', e);
        return [];
    }
}

/** Convierte los resultados a un bloque de texto compacto para el meta-prompt.
 *  Ordena de mayor a menor fuerza de evidencia para que el LLM lea primero
 *  las hipótesis confirmadas y enfoque su análisis ahí.
 */
export function formatHypothesesForPrompt(results: CausalHypothesisResult[]): string {
    const verdictRank: Record<string, number> = { strong: 0, partial: 1, weak: 2 };
    const sorted = [...results].sort((a, b) => {
        if (!a.success) return 1;
        if (!b.success) return -1;
        const av = verdictRank[a.evidence?.verdict || 'weak'] ?? 3;
        const bv = verdictRank[b.evidence?.verdict || 'weak'] ?? 3;
        return av - bv;
    });

    return sorted.map((r, i) => {
        if (!r.success) {
            return `[H${i + 1}] ${r.label} — ${r.description}\n  ERROR: ${r.error}`;
        }
        const verdictLabel = r.evidence?.verdict === 'strong' ? 'EVIDENCIA FUERTE'
            : r.evidence?.verdict === 'partial' ? 'EVIDENCIA PARCIAL'
                : 'SIN EVIDENCIA';
        const evidenceLine = r.evidence ? `\n  Veredicto preliminar: ${verdictLabel} — ${r.evidence.summary}` : '';
        const sample = JSON.stringify(localizeDatesForModel(r.rows.slice(0, 5)));
        return `[H${i + 1}] ${r.label}\n  Pregunta: ${r.description}${evidenceLine}\n  Resultados: ${sample}`;
    }).join('\n\n');
}
