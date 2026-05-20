/**
 * Auditor de respuestas del agente.
 *
 * Toma la respuesta generada por el LLM (texto narrativo + cifras) y la
 * valida contra los resultados reales de SQL. Detecta:
 *   - cifras del texto que NO coinciden con las del SQL
 *   - menciones a sucursales/productos que no están en los datos
 *   - contradicciones internas (ej: "creció 12%" cuando la suma da -3%)
 *
 * Se ejecuta con Haiku (~$0.0008/M tokens) para no penalizar latencia.
 * Si detecta error grave, devuelve nota correctiva que se muestra al usuario.
 */

import { anthropic } from '@/lib/anthropic';

export interface AuditResult {
    ok: boolean;
    severity: 'none' | 'minor' | 'major';
    notes: string[];
}

export async function auditResponse(opts: {
    userPrompt: string;
    responseText: string;
    sql: string | null;
    results: any[];
}): Promise<AuditResult> {
    const { userPrompt, responseText, sql, results } = opts;

    // Sin datos no hay nada que auditar
    if (!sql || !results || results.length === 0) {
        return { ok: true, severity: 'none', notes: [] };
    }

    // Si la respuesta es trivial (saludo/conversación), saltar
    if (responseText.length < 80) {
        return { ok: true, severity: 'none', notes: [] };
    }

    const auditPrompt = `Eres un auditor de calidad. Verifica si la respuesta del agente es CONSISTENTE con los datos.

PREGUNTA DEL USUARIO:
${userPrompt}

SQL EJECUTADO:
${sql.slice(0, 1500)}

DATOS REALES (primeras 10 filas):
${JSON.stringify(results.slice(0, 10))}

RESPUESTA GENERADA:
${responseText.slice(0, 2000)}

TAREAS:
1. Las cifras que menciona la respuesta (montos, porcentajes, totales), ¿coinciden con los datos reales? Tolerancia ±2% por redondeo.
2. Los nombres que menciona (sucursales, productos, clientes), ¿están en los datos?
3. Las afirmaciones de dirección (creció, cayó, subió), ¿son correctas según los datos?
4. ¿Hay contradicciones internas en el texto?

NO marques como error: estilo, longitud, tono, recomendaciones, omisiones.
SOLO marca lo que sea factualmente FALSO según los datos.

Responde en JSON estricto (sin markdown):
{
  "ok": true|false,
  "severity": "none|minor|major",
  "notes": ["máximo 2 errores específicos, breves, con el dato correcto al lado"]
}

- "ok": true si no hay errores factuales. false si hay errores.
- "severity": "none" sin errores. "minor" diferencias <5% o nombres ligeramente mal. "major" cifras muy mal, dirección invertida, datos inventados.
- "notes": frases cortas tipo "Texto dice $1.4M pero el dato real es $1.2M".

Devuelve SOLO el JSON.`;

    try {
        const response = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 600,
            messages: [{ role: 'user', content: auditPrompt }]
        });

        const text = (response.content[0] as any)?.text || '';
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start < 0 || end <= start) return { ok: true, severity: 'none', notes: [] };

        const parsed = JSON.parse(text.substring(start, end + 1));
        return {
            ok: Boolean(parsed.ok),
            severity: ['none', 'minor', 'major'].includes(parsed.severity) ? parsed.severity : 'none',
            notes: Array.isArray(parsed.notes) ? parsed.notes.slice(0, 2).map(String) : []
        };
    } catch (e) {
        console.error('auditResponse failed:', e);
        return { ok: true, severity: 'none', notes: [] };
    }
}

/** Formatea una nota de auditoría para anexar al final del mensaje */
export function formatAuditNote(audit: AuditResult): string {
    if (audit.ok || audit.severity === 'none' || audit.notes.length === 0) return '';
    const prefix = audit.severity === 'major' ? '⚠️ **Revisión interna:**' : 'ℹ️ *Nota:*';
    return `\n\n${prefix} ${audit.notes.join(' ')}`;
}
