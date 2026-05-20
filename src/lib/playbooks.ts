/**
 * Playbooks — secuencias de preguntas guardadas para ejecución repetida.
 *
 * Caso de uso: el usuario hace su "revisión matutina" con 5 preguntas
 * relacionadas. Las guarda como playbook. Al día siguiente, un click
 * ejecuta las 5 y obtiene los análisis consolidados.
 *
 * Tabla:
 *  - tblAgentPlaybooks: definición (id, userId, nombre, steps array)
 *  - tblAgentPlaybookRuns: log de ejecuciones (opcional, para auditoría)
 */

import { query } from '@/lib/db';

let tableEnsured = false;

export async function ensurePlaybookTables(): Promise<void> {
    if (tableEnsured) return;
    try {
        await query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tblAgentPlaybooks' AND xtype='U')
            CREATE TABLE tblAgentPlaybooks (
                IdPlaybook VARCHAR(64) NOT NULL PRIMARY KEY,
                IdUsuario VARCHAR(64) NOT NULL,
                Nombre NVARCHAR(200) NOT NULL,
                Descripcion NVARCHAR(500) NULL,
                StepsJson NVARCHAR(MAX) NOT NULL,
                FechaCreacion DATETIME NOT NULL DEFAULT GETDATE(),
                FechaUltimoUso DATETIME NULL,
                NumEjecuciones INT NOT NULL DEFAULT 0,
                Eliminado BIT NOT NULL DEFAULT 0,
                INDEX IX_AgentPlaybooks_Usuario (IdUsuario, Eliminado, FechaUltimoUso DESC)
            )
        `);
        tableEnsured = true;
    } catch (e) {
        console.error('No se pudo asegurar tblAgentPlaybooks:', e);
    }
}

export interface PlaybookStep {
    /** Pregunta en lenguaje natural que el agente ejecutará */
    prompt: string;
    /** Etiqueta corta opcional para mostrar en la UI */
    label?: string;
}

export interface Playbook {
    id: string;
    userId: string;
    name: string;
    description: string | null;
    steps: PlaybookStep[];
    createdAt: string;
    lastUsedAt: string | null;
    runCount: number;
}

function mapRow(r: any): Playbook {
    let steps: PlaybookStep[] = [];
    try {
        steps = JSON.parse(r.StepsJson || '[]');
    } catch { }
    return {
        id: r.IdPlaybook,
        userId: r.IdUsuario,
        name: r.Nombre,
        description: r.Descripcion,
        steps,
        createdAt: r.FechaCreacion?.toISOString?.() || String(r.FechaCreacion),
        lastUsedAt: r.FechaUltimoUso
            ? (r.FechaUltimoUso?.toISOString?.() || String(r.FechaUltimoUso))
            : null,
        runCount: Number(r.NumEjecuciones) || 0
    };
}

export async function listPlaybooks(userId: string): Promise<Playbook[]> {
    await ensurePlaybookTables();
    const rows = await query(
        `SELECT * FROM tblAgentPlaybooks
         WHERE IdUsuario = ? AND Eliminado = 0
         ORDER BY FechaUltimoUso DESC, FechaCreacion DESC`,
        [userId]
    );
    return (rows as any[]).map(mapRow);
}

export async function getPlaybook(userId: string, id: string): Promise<Playbook | null> {
    await ensurePlaybookTables();
    const rows = await query(
        `SELECT TOP 1 * FROM tblAgentPlaybooks
         WHERE IdPlaybook = ? AND IdUsuario = ? AND Eliminado = 0`,
        [id, userId]
    );
    const r = (rows as any[])[0];
    return r ? mapRow(r) : null;
}

export async function createPlaybook(opts: {
    id: string;
    userId: string;
    name: string;
    description?: string | null;
    steps: PlaybookStep[];
}): Promise<void> {
    await ensurePlaybookTables();
    if (!opts.steps.length) throw new Error('Un playbook debe tener al menos un paso');
    if (opts.steps.length > 20) throw new Error('Máximo 20 pasos por playbook');

    const stepsJson = JSON.stringify(opts.steps).slice(0, 100000);
    await query(
        `INSERT INTO tblAgentPlaybooks (IdPlaybook, IdUsuario, Nombre, Descripcion, StepsJson)
         VALUES (?, ?, ?, ?, ?)`,
        [opts.id, opts.userId, opts.name.slice(0, 200), opts.description?.slice(0, 500) || null, stepsJson]
    );
}

export async function updatePlaybook(opts: {
    id: string;
    userId: string;
    name?: string;
    description?: string | null;
    steps?: PlaybookStep[];
}): Promise<void> {
    await ensurePlaybookTables();
    const sets: string[] = [];
    const params: any[] = [];
    if (opts.name !== undefined) {
        sets.push('Nombre = ?');
        params.push(opts.name.slice(0, 200));
    }
    if (opts.description !== undefined) {
        sets.push('Descripcion = ?');
        params.push(opts.description?.slice(0, 500) || null);
    }
    if (opts.steps !== undefined) {
        if (opts.steps.length > 20) throw new Error('Máximo 20 pasos por playbook');
        sets.push('StepsJson = ?');
        params.push(JSON.stringify(opts.steps).slice(0, 100000));
    }
    if (sets.length === 0) return;

    params.push(opts.id, opts.userId);
    await query(
        `UPDATE tblAgentPlaybooks SET ${sets.join(', ')}
         WHERE IdPlaybook = ? AND IdUsuario = ?`,
        params
    );
}

export async function deletePlaybook(userId: string, id: string): Promise<void> {
    await ensurePlaybookTables();
    await query(
        `UPDATE tblAgentPlaybooks SET Eliminado = 1
         WHERE IdPlaybook = ? AND IdUsuario = ?`,
        [id, userId]
    );
}

/** Registra que un playbook se ejecutó (incrementa contador, actualiza fecha) */
export async function recordPlaybookRun(userId: string, id: string): Promise<void> {
    await ensurePlaybookTables();
    await query(
        `UPDATE tblAgentPlaybooks
         SET FechaUltimoUso = GETDATE(), NumEjecuciones = NumEjecuciones + 1
         WHERE IdPlaybook = ? AND IdUsuario = ?`,
        [id, userId]
    );
}

export function generatePlaybookId(): string {
    return 'pb_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

const STOPWORDS = new Set([
    'que', 'qué', 'por', 'para', 'con', 'una', 'uno', 'los', 'las', 'del',
    'las', 'mas', 'más', 'esta', 'este', 'son', 'fue', 'sin', 'sus', 'sobre',
    'cual', 'cuál', 'cuando', 'cuándo', 'donde', 'dónde', 'como', 'cómo',
    'pero', 'porque', 'hay', 'fue', 'ser', 'esta', 'están', 'pasa', 'pasó',
    'caída', 'aumento', 'baja', 'sube', 'subió', 'bajó', 'mucho', 'poco',
    'todo', 'todos', 'todas', 'también'
]);

function tokenize(text: string): Set<string> {
    return new Set(
        text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .split(/[^a-z0-9ñ]+/)
            .filter(t => t.length >= 4 && !STOPWORDS.has(t))
    );
}

/**
 * Busca el playbook del usuario más relevante para una pregunta dada.
 * Matcheo léxico simple (overlap de palabras significativas) — sin LLM, sin embeddings.
 * Solo devuelve los prompts del playbook si el overlap supera el umbral mínimo.
 *
 * Diseñado para enriquecer el razonamiento causal: si el usuario ya guardó
 * un playbook sobre "caída de ventas por sucursal", al preguntar
 * "¿por qué bajaron las ventas?" usamos sus pasos como ángulos sugeridos.
 */
export async function findRelevantPlaybookSteps(
    userId: string,
    prompt: string,
    minOverlap = 2
): Promise<string[]> {
    if (!userId || userId === 'anonymous' || userId === 'unknown') return [];

    try {
        const playbooks = await listPlaybooks(userId);
        if (playbooks.length === 0) return [];

        const promptTokens = tokenize(prompt);
        if (promptTokens.size === 0) return [];

        let bestMatch: { playbook: Playbook; score: number } | null = null;
        for (const pb of playbooks) {
            const haystack = `${pb.name} ${pb.description || ''} ${pb.steps.map(s => s.prompt).join(' ')}`;
            const pbTokens = tokenize(haystack);
            let overlap = 0;
            for (const t of promptTokens) {
                if (pbTokens.has(t)) overlap++;
            }
            if (overlap >= minOverlap && (!bestMatch || overlap > bestMatch.score)) {
                bestMatch = { playbook: pb, score: overlap };
            }
        }

        if (!bestMatch) return [];
        return bestMatch.playbook.steps
            .map(s => s.prompt)
            .filter(p => typeof p === 'string' && p.length > 0)
            .slice(0, 6);
    } catch (e) {
        console.error('findRelevantPlaybookSteps failed:', e);
        return [];
    }
}
