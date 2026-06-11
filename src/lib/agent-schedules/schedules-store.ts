/**
 * Persistencia de ENVÍOS PROGRAMADOS (digests por WhatsApp).
 *
 * Una fila = "manda el reporte X al teléfono Y, diario/semanal a tal hora".
 * El cron /api/agent/schedules/run recorre los activos, decide cuáles tocan en
 * esta pasada (por hora local + día), corre el reporte, congela un share y lo
 * envía con sendWhatsApp. Mismo idiom que reports-store / alerts.
 */

import { query } from '@/lib/db';

let tableEnsured = false;

export async function ensureSchedulesTable(): Promise<void> {
    if (tableEnsured) return;
    try {
        await query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tblAgentSchedules' AND xtype='U')
            CREATE TABLE tblAgentSchedules (
                IdSchedule INT IDENTITY(1,1) PRIMARY KEY,
                IdUsuario VARCHAR(64) NOT NULL,
                IdReporte INT NOT NULL,
                Telefono VARCHAR(40) NOT NULL,
                Frecuencia VARCHAR(20) NOT NULL DEFAULT 'daily',
                HoraLocal INT NOT NULL DEFAULT 8,
                DiaSemana INT NULL,
                Activo BIT NOT NULL DEFAULT 1,
                FechaUltimoEnvio DATETIME NULL,
                FechaCreacion DATETIME NOT NULL DEFAULT GETDATE(),
                Eliminado BIT NOT NULL DEFAULT 0,
                INDEX IX_AgentSchedules_Activo (Activo, Eliminado),
                INDEX IX_AgentSchedules_Usuario (IdUsuario, Eliminado)
            )
        `);
        tableEnsured = true;
    } catch (e) {
        console.error('No se pudo asegurar la tabla tblAgentSchedules:', e);
    }
}

export interface AgentSchedule {
    idSchedule: number;
    idUsuario: string;
    idReporte: number;
    telefono: string;
    frecuencia: 'daily' | 'weekly';
    horaLocal: number;
    diaSemana: number | null;
    activo: boolean;
    fechaUltimoEnvio: string | null;
    fechaCreacion: string;
}

function mapRow(r: any): AgentSchedule {
    return {
        idSchedule: r.IdSchedule,
        idUsuario: r.IdUsuario,
        idReporte: r.IdReporte,
        telefono: r.Telefono,
        frecuencia: (r.Frecuencia === 'weekly' ? 'weekly' : 'daily'),
        horaLocal: Number(r.HoraLocal),
        diaSemana: r.DiaSemana != null ? Number(r.DiaSemana) : null,
        activo: !!r.Activo,
        fechaUltimoEnvio: r.FechaUltimoEnvio ? (r.FechaUltimoEnvio?.toISOString?.() || String(r.FechaUltimoEnvio)) : null,
        fechaCreacion: r.FechaCreacion?.toISOString?.() || String(r.FechaCreacion),
    };
}

export interface CreateScheduleInput {
    userId: string;
    idReporte: number;
    telefono: string;
    frecuencia: 'daily' | 'weekly';
    horaLocal: number;
    diaSemana?: number | null;
}

export async function createSchedule(input: CreateScheduleInput): Promise<number> {
    await ensureSchedulesTable();
    const hora = Math.max(0, Math.min(23, Number(input.horaLocal) || 8));
    const freq = input.frecuencia === 'weekly' ? 'weekly' : 'daily';
    const dia = freq === 'weekly' ? Math.max(0, Math.min(6, Number(input.diaSemana) || 1)) : null;
    const result = await query(
        `INSERT INTO tblAgentSchedules (IdUsuario, IdReporte, Telefono, Frecuencia, HoraLocal, DiaSemana, Activo, FechaCreacion, Eliminado)
         VALUES (?, ?, ?, ?, ?, ?, 1, GETDATE(), 0);
         SELECT CAST(SCOPE_IDENTITY() AS INT) AS IdSchedule;`,
        [input.userId, input.idReporte, input.telefono.slice(0, 40), freq, hora, dia]
    ) as Array<{ IdSchedule: number }>;
    return result[0]?.IdSchedule;
}

export async function listSchedulesByUser(userId: string): Promise<AgentSchedule[]> {
    await ensureSchedulesTable();
    const rows = await query(
        `SELECT * FROM tblAgentSchedules WHERE IdUsuario = ? AND Eliminado = 0 ORDER BY FechaCreacion DESC`,
        [userId]
    ) as any[];
    return rows.map(mapRow);
}

export async function listSchedulesByReport(userId: string, idReporte: number): Promise<AgentSchedule[]> {
    await ensureSchedulesTable();
    const rows = await query(
        `SELECT * FROM tblAgentSchedules WHERE IdUsuario = ? AND IdReporte = ? AND Eliminado = 0 ORDER BY FechaCreacion DESC`,
        [userId, idReporte]
    ) as any[];
    return rows.map(mapRow);
}

/** Todos los envíos activos (para el cron). */
export async function listActiveSchedules(): Promise<AgentSchedule[]> {
    await ensureSchedulesTable();
    const rows = await query(
        `SELECT * FROM tblAgentSchedules WHERE Activo = 1 AND Eliminado = 0`
    ) as any[];
    return rows.map(mapRow);
}

export async function markScheduleSent(idSchedule: number): Promise<void> {
    await ensureSchedulesTable();
    await query(`UPDATE tblAgentSchedules SET FechaUltimoEnvio = GETDATE() WHERE IdSchedule = ?`, [idSchedule]);
}

export async function deleteSchedule(userId: string, idSchedule: number): Promise<void> {
    await ensureSchedulesTable();
    await query(`UPDATE tblAgentSchedules SET Eliminado = 1 WHERE IdSchedule = ? AND IdUsuario = ?`, [idSchedule, userId]);
}

export async function setScheduleActive(userId: string, idSchedule: number, activo: boolean): Promise<void> {
    await ensureSchedulesTable();
    await query(`UPDATE tblAgentSchedules SET Activo = ? WHERE IdSchedule = ? AND IdUsuario = ?`, [activo ? 1 : 0, idSchedule, userId]);
}
