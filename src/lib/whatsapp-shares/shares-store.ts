/**
 * Persistencia de "shares" de WhatsApp: snapshots públicos accesibles por UUID.
 *
 * Cuando /api/whatsapp/ask produce una respuesta que amerita gráfica/tabla, se
 * CONGELAN las filas que la generaron en tblWhatsAppShares y se devuelve un link
 * /r/<uuid>. La página pública SOLO lee este JSON (nunca re-ejecuta SQL), por lo
 * que no hay superficie de inyección y el dato refleja el momento de la pregunta.
 *
 * Sigue el idiom del codebase: guard de módulo + `IF NOT EXISTS sysobjects`
 * (idéntico a reports-store.ts) y placeholders posicionales `?`.
 */

import { query } from '@/lib/db';
import { randomUUID } from 'node:crypto';

let tableEnsured = false;
const DEFAULT_TTL_DAYS = Number(process.env.WHATSAPP_SHARE_TTL_DAYS) || 90;

export async function ensureSharesTable(): Promise<void> {
    if (tableEnsured) return;
    try {
        await query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tblWhatsAppShares' AND xtype='U')
            CREATE TABLE tblWhatsAppShares (
                Uuid VARCHAR(36) NOT NULL PRIMARY KEY,
                Pregunta NVARCHAR(500) NULL,
                Answer NVARCHAR(MAX) NULL,
                Tool VARCHAR(40) NULL,
                Viz VARCHAR(20) NULL,
                Sql NVARCHAR(MAX) NULL,
                DatosJson NVARCHAR(MAX) NOT NULL,
                InsightsJson NVARCHAR(MAX) NULL,
                FromPhone VARCHAR(40) NULL,
                TenantId VARCHAR(64) NULL,
                Vistas INT NOT NULL DEFAULT 0,
                FechaCreacion DATETIME NOT NULL DEFAULT GETDATE(),
                FechaExpira DATETIME NULL,
                INDEX IX_WhatsAppShares_Fecha (FechaCreacion DESC)
            )
        `);
        tableEnsured = true;
    } catch (e) {
        console.error('No se pudo asegurar la tabla tblWhatsAppShares:', e);
    }
}

function parseJsonSafe<T>(s: string | null | undefined, fallback: T): T {
    if (!s) return fallback;
    try { return JSON.parse(s) as T; } catch { return fallback; }
}

export interface CreateShareInput {
    question: string;
    answer: string;
    tool: string;
    viz?: string | null;
    sql?: string | null;
    rows: Record<string, any>[];
    insights?: string[];
    fromPhone?: string;
    tenantId?: string;
    ttlDays?: number;
}

/** Inserta un snapshot y devuelve su UUID público. */
export async function createShare(input: CreateShareInput): Promise<string> {
    await ensureSharesTable();
    const uuid = randomUUID();
    const ttl = Number(input.ttlDays) > 0 ? Number(input.ttlDays) : DEFAULT_TTL_DAYS;
    const datos = JSON.stringify(input.rows || []).slice(0, 400000);
    const insights = input.insights && input.insights.length ? JSON.stringify(input.insights).slice(0, 8000) : null;
    await query(
        `INSERT INTO tblWhatsAppShares
            (Uuid, Pregunta, Answer, Tool, Viz, Sql, DatosJson, InsightsJson, FromPhone, TenantId, Vistas, FechaCreacion, FechaExpira)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, GETDATE(), DATEADD(day, ?, GETDATE()))`,
        [
            uuid,
            (input.question || '').slice(0, 500),
            (input.answer || '').slice(0, 4000),
            (input.tool || '').slice(0, 40),
            input.viz ? input.viz.slice(0, 20) : null,
            input.sql ? input.sql.slice(0, 8000) : null,
            datos,
            insights,
            input.fromPhone ? input.fromPhone.slice(0, 40) : null,
            input.tenantId ? input.tenantId.slice(0, 64) : null,
            ttl,
        ]
    );
    return uuid;
}

export interface SharedView {
    uuid: string;
    question: string;
    answer: string;
    tool: string;
    viz: string | null;
    rows: any[];
    insights: string[];
    fechaCreacion: string;
    expired: boolean;
}

/** Lee un snapshot por UUID. Devuelve null si no existe; `expired:true` si venció. */
export async function getShareByUuid(uuid: string): Promise<SharedView | null> {
    await ensureSharesTable();
    const rows = await query(
        `SELECT TOP 1 Uuid, Pregunta, Answer, Tool, Viz, DatosJson, InsightsJson, FechaCreacion, FechaExpira
         FROM tblWhatsAppShares WHERE Uuid = ?`,
        [uuid]
    ) as any[];
    const r = rows[0];
    if (!r) return null;
    const expired = r.FechaExpira != null && new Date(r.FechaExpira).getTime() < Date.now();
    if (!expired) {
        // Contador de vistas (no crítico: fire-and-forget).
        query(`UPDATE tblWhatsAppShares SET Vistas = Vistas + 1 WHERE Uuid = ?`, [uuid]).catch(() => { /* noop */ });
    }
    return {
        uuid: r.Uuid,
        question: r.Pregunta || '',
        answer: r.Answer || '',
        tool: r.Tool || '',
        viz: r.Viz || null,
        rows: parseJsonSafe<any[]>(r.DatosJson, []),
        insights: parseJsonSafe<string[]>(r.InsightsJson, []),
        fechaCreacion: r.FechaCreacion?.toISOString?.() || String(r.FechaCreacion),
        expired,
    };
}
