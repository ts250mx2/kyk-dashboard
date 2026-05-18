/**
 * Helper para persistencia de conversaciones del agente Kesito.
 *
 * Tabla: tblAgentConversaciones
 *
 * Diseño:
 *  - Una fila por conversación
 *  - Los mensajes se guardan como JSON serializado en una sola columna
 *    (suficiente para nuestro caso, evita join N+1 y mantiene atomicidad)
 *  - Soft delete con bit Eliminada
 *  - Auto-creación lazy con IF NOT EXISTS al primer uso
 */

import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

const SECRET_KEY = new TextEncoder().encode(
    process.env.JWT_SECRET || 'your-secret-key-change-this-in-prod'
);

let tableEnsured = false;

export async function ensureConversationsTable(): Promise<void> {
    if (tableEnsured) return;
    try {
        await query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tblAgentConversaciones' AND xtype='U')
            CREATE TABLE tblAgentConversaciones (
                IdConversacion VARCHAR(64) NOT NULL PRIMARY KEY,
                IdUsuario VARCHAR(64) NOT NULL,
                Titulo NVARCHAR(300) NULL,
                MensajesJson NVARCHAR(MAX) NULL,
                FechaCreacion DATETIME NOT NULL DEFAULT GETDATE(),
                FechaActualizacion DATETIME NOT NULL DEFAULT GETDATE(),
                Eliminada BIT NOT NULL DEFAULT 0,
                INDEX IX_AgentConv_Usuario (IdUsuario, Eliminada, FechaActualizacion DESC)
            )
        `);
        tableEnsured = true;
    } catch (e) {
        console.error('No se pudo asegurar tblAgentConversaciones:', e);
        throw e;
    }
}

export async function getUserId(): Promise<string> {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('session');
        if (!token) return 'anonymous';
        const { payload } = await jwtVerify(token.value, SECRET_KEY);
        return String((payload as any).id || (payload as any).user || 'anonymous');
    } catch {
        return 'anonymous';
    }
}

export interface ConversationSummary {
    id: string;
    title: string;
    updated_at: string;
    created_at: string;
}

export interface ConversationFull extends ConversationSummary {
    messages: any[];
}

export async function listConversations(userId: string, limit = 50): Promise<ConversationSummary[]> {
    await ensureConversationsTable();
    const rows = await query(
        `SELECT TOP ${limit} IdConversacion, Titulo, FechaCreacion, FechaActualizacion
         FROM tblAgentConversaciones
         WHERE IdUsuario = ? AND Eliminada = 0
         ORDER BY FechaActualizacion DESC`,
        [userId]
    );
    return (rows as any[]).map(r => ({
        id: r.IdConversacion,
        title: r.Titulo || 'Conversación sin título',
        created_at: r.FechaCreacion?.toISOString?.() || String(r.FechaCreacion),
        updated_at: r.FechaActualizacion?.toISOString?.() || String(r.FechaActualizacion)
    }));
}

export async function getConversation(userId: string, id: string): Promise<ConversationFull | null> {
    await ensureConversationsTable();
    const rows = await query(
        `SELECT TOP 1 IdConversacion, Titulo, MensajesJson, FechaCreacion, FechaActualizacion
         FROM tblAgentConversaciones
         WHERE IdConversacion = ? AND IdUsuario = ? AND Eliminada = 0`,
        [id, userId]
    );
    const r = (rows as any[])[0];
    if (!r) return null;

    let messages: any[] = [];
    try {
        messages = r.MensajesJson ? JSON.parse(r.MensajesJson) : [];
    } catch {
        messages = [];
    }

    return {
        id: r.IdConversacion,
        title: r.Titulo || 'Conversación sin título',
        messages,
        created_at: r.FechaCreacion?.toISOString?.() || String(r.FechaCreacion),
        updated_at: r.FechaActualizacion?.toISOString?.() || String(r.FechaActualizacion)
    };
}

export async function saveConversation(opts: {
    userId: string;
    id: string;
    title: string;
    messages: any[];
}): Promise<void> {
    await ensureConversationsTable();
    const { userId, id, title, messages } = opts;
    const messagesJson = JSON.stringify(messages).slice(0, 10_000_000); // límite duro 10MB

    // UPSERT: si ya existe, actualiza; si no, inserta
    await query(
        `IF EXISTS (SELECT 1 FROM tblAgentConversaciones WHERE IdConversacion = ?)
            UPDATE tblAgentConversaciones
            SET Titulo = ?, MensajesJson = ?, FechaActualizacion = GETDATE()
            WHERE IdConversacion = ? AND IdUsuario = ?
        ELSE
            INSERT INTO tblAgentConversaciones (IdConversacion, IdUsuario, Titulo, MensajesJson, FechaCreacion, FechaActualizacion)
            VALUES (?, ?, ?, ?, GETDATE(), GETDATE())`,
        [id, title, messagesJson, id, userId, id, userId, title, messagesJson]
    );
}

export async function deleteConversation(userId: string, id: string): Promise<void> {
    await ensureConversationsTable();
    await query(
        `UPDATE tblAgentConversaciones
         SET Eliminada = 1, FechaActualizacion = GETDATE()
         WHERE IdConversacion = ? AND IdUsuario = ?`,
        [id, userId]
    );
}

export function generateTitle(firstUserMessage: string): string {
    const cleaned = firstUserMessage
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 80);
    return cleaned || 'Conversación nueva';
}
