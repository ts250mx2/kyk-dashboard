/**
 * Feedback loop del agente.
 *
 * Cada mensaje del agente puede recibir 👍 o 👎 + razón opcional.
 * Se guarda junto con el prompt original, la respuesta y el SQL para
 * que sirva como insumo cuando iteres el prompt o detectes patrones
 * de queries que fallan.
 */

import { query } from '@/lib/db';

let tableEnsured = false;

export async function ensureFeedbackTable(): Promise<void> {
    if (tableEnsured) return;
    try {
        await query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tblAgentFeedback' AND xtype='U')
            CREATE TABLE tblAgentFeedback (
                IdFeedback VARCHAR(64) NOT NULL PRIMARY KEY,
                IdConversacion VARCHAR(64) NULL,
                IdMensaje VARCHAR(64) NOT NULL,
                IdUsuario VARCHAR(64) NULL,
                Rating VARCHAR(8) NOT NULL,
                Razon NVARCHAR(1000) NULL,
                Pregunta NVARCHAR(MAX) NULL,
                Respuesta NVARCHAR(MAX) NULL,
                ConsultaSQL NVARCHAR(MAX) NULL,
                AiModel VARCHAR(64) NULL,
                FechaCreacion DATETIME NOT NULL DEFAULT GETDATE(),
                INDEX IX_AgentFeedback_Rating (Rating, FechaCreacion DESC),
                INDEX IX_AgentFeedback_Mensaje (IdMensaje)
            )
        `);
        tableEnsured = true;
    } catch (e) {
        console.error('No se pudo asegurar tblAgentFeedback:', e);
    }
}

export interface FeedbackInput {
    messageId: string;
    conversationId?: string | null;
    userId?: string | null;
    rating: 'up' | 'down';
    reason?: string | null;
    prompt?: string | null;
    response?: string | null;
    sql?: string | null;
    aiModel?: string | null;
}

export async function recordFeedback(input: FeedbackInput): Promise<void> {
    await ensureFeedbackTable();
    const id = 'fb_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    await query(
        `INSERT INTO tblAgentFeedback
         (IdFeedback, IdConversacion, IdMensaje, IdUsuario, Rating, Razon, Pregunta, Respuesta, ConsultaSQL, AiModel)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            id,
            input.conversationId || null,
            input.messageId,
            input.userId || null,
            input.rating,
            input.reason?.slice(0, 1000) || null,
            input.prompt?.slice(0, 8000) || null,
            input.response?.slice(0, 8000) || null,
            input.sql?.slice(0, 8000) || null,
            input.aiModel || null
        ]
    );
}

export interface FeedbackStats {
    totals: { up: number; down: number; total: number };
    ratingPct: number;
    last7Days: { date: string; up: number; down: number }[];
    recentDown: Array<{
        id: string;
        createdAt: string;
        reason: string | null;
        prompt: string | null;
        response: string | null;
        sql: string | null;
        aiModel: string | null;
    }>;
}

export async function getFeedbackStats(daysBack = 30): Promise<FeedbackStats> {
    await ensureFeedbackTable();

    const totalsRows = await query(`
        SELECT Rating, COUNT(*) AS Cnt
        FROM tblAgentFeedback
        WHERE FechaCreacion >= DATEADD(DAY, -${daysBack}, GETDATE())
        GROUP BY Rating
    `) as any[];

    let up = 0;
    let down = 0;
    for (const r of totalsRows) {
        if (r.Rating === 'up') up = Number(r.Cnt) || 0;
        if (r.Rating === 'down') down = Number(r.Cnt) || 0;
    }
    const total = up + down;
    const ratingPct = total > 0 ? (up / total) * 100 : 0;

    const trendRows = await query(`
        SELECT CAST(FechaCreacion AS DATE) AS Fecha,
               SUM(CASE WHEN Rating = 'up' THEN 1 ELSE 0 END) AS Up,
               SUM(CASE WHEN Rating = 'down' THEN 1 ELSE 0 END) AS Down
        FROM tblAgentFeedback
        WHERE FechaCreacion >= DATEADD(DAY, -7, GETDATE())
        GROUP BY CAST(FechaCreacion AS DATE)
        ORDER BY Fecha
    `) as any[];

    const last7Days = trendRows.map(r => ({
        date: r.Fecha instanceof Date ? r.Fecha.toISOString().slice(0, 10) : String(r.Fecha).slice(0, 10),
        up: Number(r.Up) || 0,
        down: Number(r.Down) || 0
    }));

    const downRows = await query(`
        SELECT TOP 25 IdFeedback, FechaCreacion, Razon, Pregunta, Respuesta, ConsultaSQL, AiModel
        FROM tblAgentFeedback
        WHERE Rating = 'down'
        ORDER BY FechaCreacion DESC
    `) as any[];

    const recentDown = downRows.map(r => ({
        id: r.IdFeedback,
        createdAt: r.FechaCreacion instanceof Date ? r.FechaCreacion.toISOString() : String(r.FechaCreacion),
        reason: r.Razon,
        prompt: r.Pregunta,
        response: r.Respuesta,
        sql: r.ConsultaSQL,
        aiModel: r.AiModel
    }));

    return {
        totals: { up, down, total },
        ratingPct,
        last7Days,
        recentDown
    };
}
