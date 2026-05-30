/**
 * Persistencia de las conversaciones del Agente Avanzado (pestañas), por usuario.
 * Permite abrir las mismas conversaciones desde otra computadora (clave: IdUsuario).
 */

import { query } from '@/lib/db';

let ensured = false;

export async function ensureSessionsTable(): Promise<void> {
    if (ensured) return;
    try {
        await query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tblAgentConsoleSessions' AND xtype='U')
            CREATE TABLE tblAgentConsoleSessions (
                IdSesion VARCHAR(64) NOT NULL PRIMARY KEY,
                IdUsuario VARCHAR(64) NOT NULL,
                Titulo NVARCHAR(120) NOT NULL,
                LinesJson NVARCHAR(MAX) NULL,
                HistoryJson NVARCHAR(MAX) NULL,
                EditingReportId INT NULL,
                FechaActualizacion DATETIME NOT NULL DEFAULT GETDATE(),
                Eliminado BIT NOT NULL DEFAULT 0,
                INDEX IX_ConsoleSessions_Usuario (IdUsuario, Eliminado, FechaActualizacion ASC)
            )
        `);
        // Migración para tablas existentes
        await query(`IF COL_LENGTH('tblAgentConsoleSessions', 'EditingReportId') IS NULL ALTER TABLE tblAgentConsoleSessions ADD EditingReportId INT NULL`);
        ensured = true;
    } catch (e) {
        console.error('No se pudo asegurar tblAgentConsoleSessions:', e);
    }
}

function parseJsonSafe<T>(s: string | null | undefined, fallback: T): T {
    if (!s) return fallback;
    try { return JSON.parse(s) as T; } catch { return fallback; }
}

export interface ConsoleSession {
    id: string;
    title: string;
    lines: any[];
    history: any[];
    editingReportId?: number | null;
}

export async function listSessions(userId: string): Promise<ConsoleSession[]> {
    await ensureSessionsTable();
    const rows = (await query(
        `SELECT IdSesion, Titulo, LinesJson, HistoryJson, EditingReportId
         FROM tblAgentConsoleSessions
         WHERE IdUsuario = ? AND Eliminado = 0
         ORDER BY FechaActualizacion ASC`,
        [userId]
    )) as any[];
    return rows.map((r) => ({
        id: r.IdSesion,
        title: r.Titulo,
        lines: parseJsonSafe<any[]>(r.LinesJson, []),
        history: parseJsonSafe<any[]>(r.HistoryJson, []),
        editingReportId: r.EditingReportId != null ? Number(r.EditingReportId) : null,
    }));
}

export async function upsertSession(userId: string, s: ConsoleSession): Promise<void> {
    await ensureSessionsTable();
    const linesJson = JSON.stringify(s.lines || []).slice(0, 400000);
    const histJson = JSON.stringify(s.history || []).slice(0, 200000);
    const title = (s.title || 'Agente').slice(0, 120);
    const editId = s.editingReportId ?? null;
    await query(
        `IF EXISTS (SELECT 1 FROM tblAgentConsoleSessions WHERE IdSesion = ? AND IdUsuario = ?)
            UPDATE tblAgentConsoleSessions
               SET Titulo = ?, LinesJson = ?, HistoryJson = ?, EditingReportId = ?, FechaActualizacion = GETDATE(), Eliminado = 0
             WHERE IdSesion = ? AND IdUsuario = ?
         ELSE
            INSERT INTO tblAgentConsoleSessions (IdSesion, IdUsuario, Titulo, LinesJson, HistoryJson, EditingReportId, FechaActualizacion, Eliminado)
            VALUES (?, ?, ?, ?, ?, ?, GETDATE(), 0)`,
        [
            s.id, userId,
            title, linesJson, histJson, editId, s.id, userId,
            s.id, userId, title, linesJson, histJson, editId,
        ]
    );
}

export async function deleteSession(userId: string, id: string): Promise<void> {
    await ensureSessionsTable();
    await query(
        `UPDATE tblAgentConsoleSessions SET Eliminado = 1, FechaActualizacion = GETDATE() WHERE IdSesion = ? AND IdUsuario = ?`,
        [id, userId]
    );
}
