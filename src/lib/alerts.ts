/**
 * Sistema de alertas proactivas del agente.
 *
 * Una "alerta" es una regla que el usuario configura para que el sistema
 * evalúe periódicamente. Cuando la condición se cumple, se dispara y
 * aparece en la bandeja del usuario.
 *
 * Tablas:
 *  - tblAgentAlertas: definición de las reglas
 *  - tblAgentAlertHistorial: cada vez que una regla se dispara
 *
 * El SQL de evaluación pasa por el sandbox read-only (heredamos seguridad).
 */

import { query } from '@/lib/db';
import { assertReadOnly } from '@/lib/sql-sandbox';

let tablesEnsured = false;

export async function ensureAlertTables(): Promise<void> {
    if (tablesEnsured) return;
    try {
        await query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tblAgentAlertas' AND xtype='U')
            CREATE TABLE tblAgentAlertas (
                IdAlerta VARCHAR(64) NOT NULL PRIMARY KEY,
                IdUsuario VARCHAR(64) NOT NULL,
                Nombre NVARCHAR(200) NOT NULL,
                Descripcion NVARCHAR(500) NULL,
                SqlConsulta NVARCHAR(MAX) NOT NULL,
                CondicionTipo VARCHAR(20) NOT NULL,
                CondicionValor FLOAT NULL,
                ColumnaObjetivo NVARCHAR(100) NULL,
                Frecuencia VARCHAR(20) NOT NULL DEFAULT 'hourly',
                Activa BIT NOT NULL DEFAULT 1,
                FechaCreacion DATETIME NOT NULL DEFAULT GETDATE(),
                FechaUltimaEvaluacion DATETIME NULL,
                INDEX IX_AgentAlertas_Usuario (IdUsuario, Activa)
            )
        `);
        await query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tblAgentAlertHistorial' AND xtype='U')
            CREATE TABLE tblAgentAlertHistorial (
                IdEvento VARCHAR(64) NOT NULL PRIMARY KEY,
                IdAlerta VARCHAR(64) NOT NULL,
                IdUsuario VARCHAR(64) NOT NULL,
                ValorObservado FLOAT NULL,
                Mensaje NVARCHAR(500) NULL,
                ResultadoJson NVARCHAR(MAX) NULL,
                FechaDisparo DATETIME NOT NULL DEFAULT GETDATE(),
                Leida BIT NOT NULL DEFAULT 0,
                INDEX IX_AlertHist_Usuario (IdUsuario, Leida, FechaDisparo DESC),
                INDEX IX_AlertHist_Alerta (IdAlerta, FechaDisparo DESC)
            )
        `);
        tablesEnsured = true;
    } catch (e) {
        console.error('No se pudo asegurar tablas de alertas:', e);
        throw e;
    }
}

export type CondicionTipo = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq' | 'has_rows';
export type Frecuencia = 'hourly' | 'daily' | 'weekly';

export interface AlertRule {
    id: string;
    userId: string;
    name: string;
    description: string | null;
    sql: string;
    conditionType: CondicionTipo;
    conditionValue: number | null;
    targetColumn: string | null;
    frequency: Frecuencia;
    active: boolean;
    createdAt: string;
    lastEvaluatedAt: string | null;
}

export interface AlertEvent {
    id: string;
    alertId: string;
    userId: string;
    observedValue: number | null;
    message: string | null;
    triggeredAt: string;
    read: boolean;
    /** Nombre/título de la alerta que disparó (join cómodo para UI) */
    alertName?: string;
}

function mapAlertRow(r: any): AlertRule {
    return {
        id: r.IdAlerta,
        userId: r.IdUsuario,
        name: r.Nombre,
        description: r.Descripcion,
        sql: r.SqlConsulta,
        conditionType: r.CondicionTipo as CondicionTipo,
        conditionValue: r.CondicionValor,
        targetColumn: r.ColumnaObjetivo,
        frequency: r.Frecuencia as Frecuencia,
        active: !!r.Activa,
        createdAt: r.FechaCreacion?.toISOString?.() || String(r.FechaCreacion),
        lastEvaluatedAt: r.FechaUltimaEvaluacion
            ? (r.FechaUltimaEvaluacion?.toISOString?.() || String(r.FechaUltimaEvaluacion))
            : null
    };
}

export async function listAlerts(userId: string): Promise<AlertRule[]> {
    await ensureAlertTables();
    const rows = await query(
        `SELECT * FROM tblAgentAlertas WHERE IdUsuario = ? ORDER BY FechaCreacion DESC`,
        [userId]
    );
    return (rows as any[]).map(mapAlertRow);
}

export async function getAlert(userId: string, id: string): Promise<AlertRule | null> {
    await ensureAlertTables();
    const rows = await query(
        `SELECT TOP 1 * FROM tblAgentAlertas WHERE IdAlerta = ? AND IdUsuario = ?`,
        [id, userId]
    );
    const r = (rows as any[])[0];
    return r ? mapAlertRow(r) : null;
}

export async function createAlert(rule: Omit<AlertRule, 'createdAt' | 'lastEvaluatedAt'>): Promise<void> {
    await ensureAlertTables();
    // Validación SQL read-only — bloquea cualquier intento de DML/DDL al guardar
    assertReadOnly(rule.sql);

    await query(
        `INSERT INTO tblAgentAlertas (IdAlerta, IdUsuario, Nombre, Descripcion, SqlConsulta,
            CondicionTipo, CondicionValor, ColumnaObjetivo, Frecuencia, Activa)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            rule.id, rule.userId, rule.name, rule.description, rule.sql,
            rule.conditionType, rule.conditionValue, rule.targetColumn,
            rule.frequency, rule.active ? 1 : 0
        ]
    );
}

export async function updateAlertActive(userId: string, id: string, active: boolean): Promise<void> {
    await ensureAlertTables();
    await query(
        `UPDATE tblAgentAlertas SET Activa = ? WHERE IdAlerta = ? AND IdUsuario = ?`,
        [active ? 1 : 0, id, userId]
    );
}

export async function deleteAlert(userId: string, id: string): Promise<void> {
    await ensureAlertTables();
    await query(
        `DELETE FROM tblAgentAlertas WHERE IdAlerta = ? AND IdUsuario = ?`,
        [id, userId]
    );
}

/** Evalúa si los resultados cumplen la condición. Devuelve el valor observado o null. */
export function evaluateCondition(
    results: any[],
    conditionType: CondicionTipo,
    conditionValue: number | null,
    targetColumn: string | null
): { triggered: boolean; observedValue: number | null } {
    if (!results || results.length === 0) {
        return { triggered: conditionType === 'has_rows' ? false : false, observedValue: null };
    }

    if (conditionType === 'has_rows') {
        return { triggered: true, observedValue: results.length };
    }

    // Tomamos el valor de la primera fila × columna objetivo (o primera columna numérica)
    const firstRow = results[0];
    let value: any;
    if (targetColumn && firstRow[targetColumn] !== undefined) {
        value = firstRow[targetColumn];
    } else {
        // Primera columna numérica
        const numKey = Object.keys(firstRow).find(k => typeof firstRow[k] === 'number');
        if (!numKey) return { triggered: false, observedValue: null };
        value = firstRow[numKey];
    }

    const num = typeof value === 'number' ? value : parseFloat(String(value));
    if (isNaN(num) || conditionValue === null) return { triggered: false, observedValue: num };

    let triggered = false;
    switch (conditionType) {
        case 'gt': triggered = num > conditionValue; break;
        case 'gte': triggered = num >= conditionValue; break;
        case 'lt': triggered = num < conditionValue; break;
        case 'lte': triggered = num <= conditionValue; break;
        case 'eq': triggered = num === conditionValue; break;
        case 'neq': triggered = num !== conditionValue; break;
    }

    return { triggered, observedValue: num };
}

/** Registra un evento de alerta disparada */
export async function recordAlertEvent(opts: {
    alertId: string;
    userId: string;
    observedValue: number | null;
    message: string;
    resultsJson: string;
}): Promise<void> {
    await ensureAlertTables();
    const eventId = 'evt_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    await query(
        `INSERT INTO tblAgentAlertHistorial (IdEvento, IdAlerta, IdUsuario, ValorObservado, Mensaje, ResultadoJson)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [eventId, opts.alertId, opts.userId, opts.observedValue, opts.message, opts.resultsJson.slice(0, 50000)]
    );

    await query(
        `UPDATE tblAgentAlertas SET FechaUltimaEvaluacion = GETDATE() WHERE IdAlerta = ?`,
        [opts.alertId]
    );
}

export async function listAlertEvents(userId: string, opts: { onlyUnread?: boolean; limit?: number } = {}): Promise<AlertEvent[]> {
    await ensureAlertTables();
    const limit = opts.limit ?? 50;
    const filter = opts.onlyUnread ? 'AND h.Leida = 0' : '';
    const rows = await query(
        `SELECT TOP ${limit}
            h.IdEvento, h.IdAlerta, h.IdUsuario, h.ValorObservado, h.Mensaje,
            h.FechaDisparo, h.Leida, a.Nombre as AlertName
         FROM tblAgentAlertHistorial h
         LEFT JOIN tblAgentAlertas a ON h.IdAlerta = a.IdAlerta
         WHERE h.IdUsuario = ? ${filter}
         ORDER BY h.FechaDisparo DESC`,
        [userId]
    );
    return (rows as any[]).map(r => ({
        id: r.IdEvento,
        alertId: r.IdAlerta,
        userId: r.IdUsuario,
        observedValue: r.ValorObservado,
        message: r.Mensaje,
        triggeredAt: r.FechaDisparo?.toISOString?.() || String(r.FechaDisparo),
        read: !!r.Leida,
        alertName: r.AlertName
    }));
}

export async function markEventRead(userId: string, eventId: string): Promise<void> {
    await ensureAlertTables();
    await query(
        `UPDATE tblAgentAlertHistorial SET Leida = 1 WHERE IdEvento = ? AND IdUsuario = ?`,
        [eventId, userId]
    );
}

export async function markAllEventsRead(userId: string): Promise<void> {
    await ensureAlertTables();
    await query(
        `UPDATE tblAgentAlertHistorial SET Leida = 1 WHERE IdUsuario = ? AND Leida = 0`,
        [userId]
    );
}

export function generateAlertId(): string {
    return 'alert_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}
