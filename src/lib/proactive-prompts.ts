/**
 * Prompts proactivos del agente — el agente inicia la conversación.
 *
 * Diferencia con alertas:
 *  - Alertas: notificación pasiva ("se disparó la regla X")
 *  - Prompts proactivos: pregunta conversacional ("Detecté Y, ¿lo investigamos?")
 *
 * El generador analiza el estado actual del negocio (usando los daily insights
 * que ya tenemos) y emite hasta 3 prompts al día por usuario, con la pregunta
 * formulada por el agente. El usuario puede aceptar (lanza conversación con
 * el prompt) o descartar.
 */

import { query } from '@/lib/db';
import { anthropic, ANTHROPIC_MODEL_CHEAP } from '@/lib/anthropic';

let tableEnsured = false;

export async function ensureProactiveTable(): Promise<void> {
    if (tableEnsured) return;
    try {
        await query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tblAgentProactivePrompts' AND xtype='U')
            CREATE TABLE tblAgentProactivePrompts (
                IdPrompt VARCHAR(64) NOT NULL PRIMARY KEY,
                IdUsuario VARCHAR(64) NOT NULL,
                Mensaje NVARCHAR(500) NOT NULL,
                Contexto NVARCHAR(500) NULL,
                AccionSugerida NVARCHAR(300) NOT NULL,
                Severidad VARCHAR(20) NOT NULL DEFAULT 'info',
                FechaCreacion DATETIME NOT NULL DEFAULT GETDATE(),
                Status VARCHAR(20) NOT NULL DEFAULT 'pending',
                FechaResuelto DATETIME NULL,
                INDEX IX_AgentProactive_Usuario (IdUsuario, Status, FechaCreacion DESC)
            )
        `);
        tableEnsured = true;
    } catch (e) {
        console.error('No se pudo asegurar tblAgentProactivePrompts:', e);
    }
}

export type ProactiveSeverity = 'critical' | 'opportunity' | 'info';
export type ProactiveStatus = 'pending' | 'accepted' | 'dismissed';

export interface ProactivePrompt {
    id: string;
    userId: string;
    message: string;              // "Detecté que Norte cayó 18% ayer..."
    context: string | null;       // "Caída concentrada en horario 14-17h en ABARROTES"
    suggestedAction: string;      // "¿Lo investigamos?" o el prompt completo de investigación
    severity: ProactiveSeverity;
    createdAt: string;
    status: ProactiveStatus;
    resolvedAt: string | null;
}

function mapRow(r: any): ProactivePrompt {
    return {
        id: r.IdPrompt,
        userId: r.IdUsuario,
        message: r.Mensaje,
        context: r.Contexto,
        suggestedAction: r.AccionSugerida,
        severity: r.Severidad as ProactiveSeverity,
        createdAt: r.FechaCreacion?.toISOString?.() || String(r.FechaCreacion),
        status: r.Status as ProactiveStatus,
        resolvedAt: r.FechaResuelto
            ? (r.FechaResuelto?.toISOString?.() || String(r.FechaResuelto))
            : null
    };
}

/** Lista prompts pendientes del usuario */
export async function listPendingPrompts(userId: string, limit = 5): Promise<ProactivePrompt[]> {
    await ensureProactiveTable();
    const rows = await query(
        `SELECT TOP ${limit} * FROM tblAgentProactivePrompts
         WHERE IdUsuario = ? AND Status = 'pending'
         ORDER BY FechaCreacion DESC`,
        [userId]
    );
    return (rows as any[]).map(mapRow);
}

/** Marca un prompt como aceptado o descartado */
export async function resolvePrompt(userId: string, id: string, status: 'accepted' | 'dismissed'): Promise<void> {
    await ensureProactiveTable();
    await query(
        `UPDATE tblAgentProactivePrompts
         SET Status = ?, FechaResuelto = GETDATE()
         WHERE IdPrompt = ? AND IdUsuario = ? AND Status = 'pending'`,
        [status, id, userId]
    );
}

/** Inserta un prompt proactivo (lo usa el generador) */
export async function insertPrompt(opts: Omit<ProactivePrompt, 'createdAt' | 'status' | 'resolvedAt'>): Promise<void> {
    await ensureProactiveTable();
    await query(
        `INSERT INTO tblAgentProactivePrompts (IdPrompt, IdUsuario, Mensaje, Contexto, AccionSugerida, Severidad)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [opts.id, opts.userId, opts.message.slice(0, 500),
         opts.context?.slice(0, 500) || null, opts.suggestedAction.slice(0, 300), opts.severity]
    );
}

export function generatePromptId(): string {
    return 'pp_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

/** Cuántos prompts ya generamos hoy para este usuario (para limitar a 3/día) */
export async function countTodayPrompts(userId: string): Promise<number> {
    await ensureProactiveTable();
    const rows = await query(
        `SELECT COUNT(*) AS c FROM tblAgentProactivePrompts
         WHERE IdUsuario = ?
           AND FechaCreacion >= CAST(GETDATE() AS DATE)`,
        [userId]
    );
    return Number((rows as any[])[0]?.c) || 0;
}

/**
 * Genera prompts proactivos a partir de los insights del día.
 * Se llama desde el cron (o desde un endpoint manual) y guarda
 * los prompts generados en la tabla para que el chat los muestre.
 */
export async function generateProactivePromptsFromInsights(opts: {
    userId: string;
    insights: Array<{
        question: string;
        severity: 'critical' | 'opportunity' | 'info';
        area: string;
        summary: string;
    }>;
    maxPerDay?: number;
}): Promise<ProactivePrompt[]> {
    const { userId, insights, maxPerDay = 3 } = opts;

    if (insights.length === 0) return [];

    const todayCount = await countTodayPrompts(userId);
    const slotsLeft = maxPerDay - todayCount;
    if (slotsLeft <= 0) return [];

    // Priorizar críticos primero, oportunidades, info
    const sevWeight: Record<string, number> = { critical: 3, opportunity: 2, info: 1 };
    const sorted = [...insights].sort((a, b) =>
        (sevWeight[b.severity] || 0) - (sevWeight[a.severity] || 0)
    );

    const candidates = sorted.slice(0, slotsLeft);

    // Pedir a Claude que reformule cada insight como una pregunta conversacional
    const reformulationPrompt = `Eres Kesito, consultor senior. Vas a reformular ${candidates.length} hallazgos
detectados en el negocio como conversaciones cortas que el agente le inicia al usuario.

Cada prompt debe:
- Empezar con "Detecté…" o "Vi que…" o similar (tono casual de colega senior)
- Mencionar el dato concreto que llamó la atención
- Terminar con una invitación específica a investigar/decidir
- Máximo 2 oraciones, conversacional

EJEMPLO:
Input: { question: "¿Por qué Sur cayó 25%?", summary: "Sur tuvo $92K, -25% vs ayer", severity: "critical" }
Output: {
  "message": "Detecté que Sur cerró ayer en $92K, 25% bajo el promedio reciente y no parece estacional.",
  "context": "Caída concentrada en últimas 2 horas, vale revisar si hubo incidente operativo.",
  "suggestedAction": "¿Por qué Sur cayó 25% ayer?"
}

INPUT (${candidates.length} hallazgos):
${candidates.map((c, i) => `[${i}] severity=${c.severity} area=${c.area}
  question: ${c.question}
  summary: ${c.summary}`).join('\n\n')}

RESPONDE EN JSON ESTRICTO (sin markdown):
{
  "prompts": [
    {
      "message": "Texto conversacional 1-2 oraciones",
      "context": "Detalle adicional opcional, 1 oración",
      "suggestedAction": "Pregunta concreta para arrancar la conversación"
    },
    ...
  ]
}

Genera EXACTAMENTE ${candidates.length} prompts en el mismo orden del input. Devuelve SOLO el JSON.`;

    let reformulated: any[] = [];
    try {
        const resp = await anthropic.messages.create({
            model: ANTHROPIC_MODEL_CHEAP,
            max_tokens: 2000,
            messages: [{ role: 'user', content: reformulationPrompt }]
        });
        const text = (resp.content[0] as any)?.text || '';
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start >= 0 && end > start) {
            const parsed = JSON.parse(text.substring(start, end + 1));
            if (Array.isArray(parsed.prompts)) reformulated = parsed.prompts;
        }
    } catch (e) {
        console.error('Reformulation failed:', e);
    }

    // Fallback: si la reformulación falla, usamos los datos crudos
    const generated: ProactivePrompt[] = [];
    for (let i = 0; i < candidates.length; i++) {
        const ins = candidates[i];
        const ref = reformulated[i] || {};
        const id = generatePromptId();
        const prompt: ProactivePrompt = {
            id,
            userId,
            message: String(ref.message || `Detecté algo en ${ins.area}: ${ins.summary}`).slice(0, 500),
            context: ref.context ? String(ref.context).slice(0, 500) : null,
            suggestedAction: String(ref.suggestedAction || ins.question).slice(0, 300),
            severity: ins.severity,
            createdAt: new Date().toISOString(),
            status: 'pending',
            resolvedAt: null
        };
        try {
            await insertPrompt({
                id: prompt.id,
                userId: prompt.userId,
                message: prompt.message,
                context: prompt.context,
                suggestedAction: prompt.suggestedAction,
                severity: prompt.severity
            });
            generated.push(prompt);
        } catch (e) {
            console.error('insertPrompt failed:', e);
        }
    }

    return generated;
}
