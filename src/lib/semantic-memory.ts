/**
 * Memoria semántica del agente.
 *
 * Guarda preguntas + respuestas + SQL con embeddings vectoriales.
 * Permite buscar "preguntas similares anteriores" antes de re-ejecutar.
 *
 * Backend: OpenAI text-embedding-3-small (1536 dims, ~$0.02/M tokens).
 * Storage: SQL Server con embedding como NVARCHAR(MAX) JSON.
 *   - SQL Server <2025 no tiene VECTOR nativo. Hacemos cosine similarity
 *     en memoria cargando los embeddings del usuario. Para <10K registros
 *     es muy rápido (<50ms).
 *
 * Solo se guardan preguntas que ejecutaron SQL real (no chat trivial).
 */

import { query } from '@/lib/db';
import { openai } from '@/lib/ai';

let tableEnsured = false;

export async function ensureMemoryTable(): Promise<void> {
    if (tableEnsured) return;
    try {
        await query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tblAgentMemory' AND xtype='U')
            CREATE TABLE tblAgentMemory (
                IdMemoria VARCHAR(64) NOT NULL PRIMARY KEY,
                IdUsuario VARCHAR(64) NULL,
                Pregunta NVARCHAR(2000) NOT NULL,
                Respuesta NVARCHAR(MAX) NULL,
                ConsultaSQL NVARCHAR(MAX) NULL,
                EmbeddingJson NVARCHAR(MAX) NOT NULL,
                AiModel VARCHAR(64) NULL,
                FechaCreacion DATETIME NOT NULL DEFAULT GETDATE(),
                INDEX IX_AgentMemory_Usuario (IdUsuario, FechaCreacion DESC)
            )
        `);
        tableEnsured = true;
    } catch (e) {
        console.error('No se pudo asegurar tblAgentMemory:', e);
    }
}

/** Genera embedding de un texto. Lanza si OpenAI falla. */
export async function embedText(text: string): Promise<number[]> {
    const trimmed = (text || '').slice(0, 8000);
    if (!trimmed) throw new Error('Texto vacío');
    const res = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: trimmed
    });
    return res.data[0].embedding;
}

/** Cosine similarity entre dos vectores de igual longitud */
function cosineSim(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0;
    let magA = 0;
    let magB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        magA += a[i] * a[i];
        magB += b[i] * b[i];
    }
    if (magA === 0 || magB === 0) return 0;
    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export async function saveMemory(opts: {
    userId?: string | null;
    prompt: string;
    response: string;
    sql?: string | null;
    aiModel?: string | null;
}): Promise<void> {
    await ensureMemoryTable();
    try {
        const embedding = await embedText(opts.prompt);
        const id = 'mem_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
        await query(
            `INSERT INTO tblAgentMemory
             (IdMemoria, IdUsuario, Pregunta, Respuesta, ConsultaSQL, EmbeddingJson, AiModel)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                opts.userId || null,
                opts.prompt.slice(0, 2000),
                opts.response.slice(0, 10000),
                opts.sql?.slice(0, 10000) || null,
                JSON.stringify(embedding),
                opts.aiModel || null
            ]
        );
    } catch (e) {
        // Silencioso: la memoria es best-effort, no debe romper la respuesta
        console.error('saveMemory failed:', e);
    }
}

export interface MemorySearchHit {
    id: string;
    prompt: string;
    response: string;
    sql: string | null;
    createdAt: string;
    similarity: number;
}

/**
 * Busca preguntas similares en la memoria del usuario.
 * Carga embeddings y calcula cosine en memoria. Limita a las últimas
 * 500 entradas del usuario para mantener latencia <100ms.
 */
export async function searchSimilar(opts: {
    userId?: string | null;
    prompt: string;
    threshold?: number;
    topN?: number;
}): Promise<MemorySearchHit[]> {
    const threshold = opts.threshold ?? 0.82;
    const topN = opts.topN ?? 3;

    if (!opts.prompt || opts.prompt.length < 6) return [];

    await ensureMemoryTable();

    try {
        const queryEmbedding = await embedText(opts.prompt);

        // Cargar últimas 500 memorias del usuario (o globales si no hay userId)
        const userClause = opts.userId
            ? `WHERE IdUsuario = '${String(opts.userId).replace(/'/g, "''")}'`
            : '';
        const rows = await query(`
            SELECT TOP 500 IdMemoria, Pregunta, Respuesta, ConsultaSQL, EmbeddingJson, FechaCreacion
            FROM tblAgentMemory
            ${userClause}
            ORDER BY FechaCreacion DESC
        `) as any[];

        const hits: MemorySearchHit[] = [];
        for (const r of rows) {
            try {
                const emb = JSON.parse(r.EmbeddingJson) as number[];
                const sim = cosineSim(queryEmbedding, emb);
                if (sim >= threshold) {
                    hits.push({
                        id: r.IdMemoria,
                        prompt: r.Pregunta,
                        response: r.Respuesta,
                        sql: r.ConsultaSQL,
                        createdAt: r.FechaCreacion instanceof Date ? r.FechaCreacion.toISOString() : String(r.FechaCreacion),
                        similarity: sim
                    });
                }
            } catch {
                // ignorar embeddings corruptos
            }
        }

        hits.sort((a, b) => b.similarity - a.similarity);
        return hits.slice(0, topN);
    } catch (e) {
        console.error('searchSimilar failed:', e);
        return [];
    }
}
