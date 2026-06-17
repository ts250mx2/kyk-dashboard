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
        // Migración: teléfono para notificar la alerta por WhatsApp (push proactivo).
        await query(`IF COL_LENGTH('tblAgentAlertas', 'Telefono') IS NULL ALTER TABLE tblAgentAlertas ADD Telefono VARCHAR(40) NULL`);
        // Multi-número: ensanchar Telefono para guardar varios separados por coma.
        await query(`IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='tblAgentAlertas' AND COLUMN_NAME='Telefono' AND CHARACTER_MAXIMUM_LENGTH < 500)
                     ALTER TABLE tblAgentAlertas ALTER COLUMN Telefono NVARCHAR(500) NULL`);
        // Clave: identifica alertas de sistema (inicio_operaciones, resumen_dia, hallazgos_dia).
        await query(`IF COL_LENGTH('tblAgentAlertas', 'Clave') IS NULL ALTER TABLE tblAgentAlertas ADD Clave VARCHAR(50) NULL`);
        // Hora de envío 'HH:MM' de las alertas de hora fija (NULL = default del código).
        await query(`IF COL_LENGTH('tblAgentAlertas', 'HoraEnvio') IS NULL ALTER TABLE tblAgentAlertas ADD HoraEnvio VARCHAR(5) NULL`);
        // Destinatarios COMPARTIDOS de las alertas de sistema (una lista por usuario).
        await query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tblAgentAlertConfig' AND xtype='U')
            CREATE TABLE tblAgentAlertConfig (
                IdUsuario VARCHAR(64) NOT NULL PRIMARY KEY,
                TelefonosSistema NVARCHAR(1000) NULL,
                FechaActualizacion DATETIME NOT NULL DEFAULT GETDATE()
            )
        `);
        // Modelo de IA para narrar las alertas de sistema (NULL = default del server).
        await query(`IF COL_LENGTH('tblAgentAlertConfig', 'Modelo') IS NULL ALTER TABLE tblAgentAlertConfig ADD Modelo VARCHAR(64) NULL`);
        // Dedup de "inicio de operaciones": una fila por usuario + sucursal + día.
        await query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tblAgentInicioLog' AND xtype='U')
            CREATE TABLE tblAgentInicioLog (
                IdUsuario VARCHAR(64) NOT NULL,
                IdTienda INT NOT NULL,
                Fecha DATE NOT NULL,
                FechaAviso DATETIME NOT NULL DEFAULT GETDATE(),
                PRIMARY KEY (IdUsuario, IdTienda, Fecha)
            )
        `);
        // Dedup de "cancelaciones atípicas": una fila por usuario + cancelación + día,
        // para avisar cada cancelación rara una sola vez. La Fecha la pone GETDATE()
        // (reloj de la BD), igual que el barrido, para no depender del huso del proceso.
        await query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tblAgentCancelacionAlertLog' AND xtype='U')
            CREATE TABLE tblAgentCancelacionAlertLog (
                IdUsuario VARCHAR(64) NOT NULL,
                CancelKey VARCHAR(80) NOT NULL,
                Fecha DATE NOT NULL,
                Motivo VARCHAR(20) NULL,
                FechaAviso DATETIME NOT NULL DEFAULT GETDATE(),
                PRIMARY KEY (IdUsuario, CancelKey, Fecha)
            )
        `);
        tablesEnsured = true;
    } catch (e) {
        console.error('No se pudo asegurar tablas de alertas:', e);
        throw e;
    }
}

export type CondicionTipo = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq' | 'has_rows';
export type Frecuencia = '5min' | 'hourly' | 'daily' | 'weekly';

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
    telefono?: string | null;     // uno o varios números separados por coma; WhatsApp al dispararse
    clave?: string | null;        // si está, es una alerta de SISTEMA (no editable salvo destinatarios/hora)
    horaEnvio?: string | null;    // 'HH:MM' — hora fija de envío (solo claves de fin de día)
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
        telefono: r.Telefono ?? null,
        clave: r.Clave ?? null,
        horaEnvio: r.HoraEnvio ?? null,
        createdAt: r.FechaCreacion?.toISOString?.() || String(r.FechaCreacion),
        lastEvaluatedAt: r.FechaUltimaEvaluacion
            ? (r.FechaUltimaEvaluacion?.toISOString?.() || String(r.FechaUltimaEvaluacion))
            : null
    };
}

export async function listAlerts(userId: string): Promise<AlertRule[]> {
    await ensureAlertTables();
    await ensureSystemAlerts(userId);
    const rows = await query(
        `SELECT * FROM tblAgentAlertas WHERE IdUsuario = ? ORDER BY (CASE WHEN Clave IS NULL THEN 1 ELSE 0 END), FechaCreacion DESC`,
        [userId]
    );
    return (rows as any[]).map(mapAlertRow);
}

// ─── Alertas de SISTEMA (sembradas por default) ───────────────────────────
// El cron las atiende por su Clave (no por SQL/condición). El usuario solo
// puede editar la lista COMPARTIDA de números (tblAgentAlertConfig).

export const SYSTEM_ALERT_CLAVES = [
    'inicio_operaciones', 'resumen_dia', 'hallazgos_dia',
    'resumen_cancelaciones', 'resumen_devoluciones',
    'cancelaciones_anomalas',
] as const;

/** Alertas de sistema que mandan un mensaje a una hora fija del día. */
export type EndOfDayClave = 'resumen_dia' | 'hallazgos_dia' | 'resumen_cancelaciones' | 'resumen_devoluciones';

/** Hora default 'HH:MM' (Monterrey). El usuario puede cambiarla por alerta (HoraEnvio). */
export const END_OF_DAY_TIMES: Record<EndOfDayClave, string> = {
    resumen_dia: '23:00',
    hallazgos_dia: '23:00',
    resumen_cancelaciones: '19:00',
    resumen_devoluciones: '19:30',
};

export function isEndOfDayClave(clave: string | null | undefined): clave is EndOfDayClave {
    return !!clave && clave in END_OF_DAY_TIMES;
}

/** Valida y normaliza 'H:MM'/'HH:MM' → 'HH:MM'; null si no es una hora válida. */
export function normalizeHora(raw: string | null | undefined): string | null {
    const m = /^(\d{1,2}):(\d{2})$/.exec((raw || '').trim());
    if (!m) return null;
    const hour = Number(m[1]);
    const minute = Number(m[2]);
    if (hour > 23 || minute > 59) return null;
    return `${String(hour).padStart(2, '0')}:${m[2]}`;
}

const SYSTEM_ALERTS: Array<{ clave: string; name: string; description: string; frequency: Frecuencia }> = [
    {
        clave: 'inicio_operaciones',
        name: 'Inicio de operaciones por sucursal',
        description: 'Avisa por WhatsApp cuando cada sucursal registra su primera venta del día.',
        frequency: '5min',
    },
    {
        clave: 'resumen_dia',
        name: 'Resumen de operaciones del día',
        description: 'Resumen del día por WhatsApp a la hora configurada.',
        frequency: 'daily',
    },
    {
        clave: 'hallazgos_dia',
        name: 'Hallazgos más importantes del día',
        description: 'Los hallazgos más relevantes del día por WhatsApp a la hora configurada.',
        frequency: 'daily',
    },
    {
        clave: 'resumen_cancelaciones',
        name: 'Resumen de cancelaciones',
        description: 'Resumen de las cancelaciones del día por WhatsApp a la hora configurada.',
        frequency: 'daily',
    },
    {
        clave: 'resumen_devoluciones',
        name: 'Resumen de devoluciones de venta',
        description: 'Resumen de las devoluciones de venta del día por WhatsApp a la hora configurada.',
        frequency: 'daily',
    },
    {
        clave: 'cancelaciones_anomalas',
        name: 'Cancelaciones atípicas',
        description: 'Avisa por WhatsApp al instante cuando hay una cancelación rara: monto alto (> $1,000) o varias del mismo cajero en menos de 2 minutos. Incluye producto, cantidad, precio, total, sucursal, fecha, cajero y supervisor.',
        frequency: '5min',
    },
];

/**
 * Crea (si faltan) las 3 alertas de sistema para el usuario. Idempotente.
 *
 * Los destinatarios viven POR ALERTA (columna Telefono). La lista compartida
 * vieja (tblAgentAlertConfig.TelefonosSistema) solo se usa para sembrar las
 * alertas nuevas y migrar una vez las que quedaron con Telefono NULL; vaciar
 * los números de una alerta guarda '' (no NULL) para que no se re-migre.
 */
export async function ensureSystemAlerts(userId: string): Promise<void> {
    await ensureAlertTables();
    const sharedRows = await query(
        `SELECT TOP 1 TelefonosSistema FROM tblAgentAlertConfig WHERE IdUsuario = ?`,
        [userId]
    );
    const shared = ((sharedRows as any[])[0]?.TelefonosSistema || '') as string;

    for (const sa of SYSTEM_ALERTS) {
        const defaultHora = isEndOfDayClave(sa.clave) ? END_OF_DAY_TIMES[sa.clave] : null;
        const rows = await query(
            `SELECT TOP 1 IdAlerta, Telefono, Nombre, Descripcion, HoraEnvio FROM tblAgentAlertas WHERE IdUsuario = ? AND Clave = ?`,
            [userId, sa.clave]
        );
        const existing = (rows as any[])[0];
        if (existing) {
            if (existing.Telefono == null && shared) {
                await query(`UPDATE tblAgentAlertas SET Telefono = ? WHERE IdAlerta = ?`, [shared, existing.IdAlerta]);
            }
            // Alertas sembradas antes de que la hora fuera editable: toman el default.
            if (existing.HoraEnvio == null && defaultHora) {
                await query(`UPDATE tblAgentAlertas SET HoraEnvio = ? WHERE IdAlerta = ?`, [defaultHora, existing.IdAlerta]);
            }
            // Nombre/descripción canónicos: si cambian en el código se reflejan.
            if (existing.Nombre !== sa.name || existing.Descripcion !== sa.description) {
                await query(
                    `UPDATE tblAgentAlertas SET Nombre = ?, Descripcion = ? WHERE IdAlerta = ?`,
                    [sa.name, sa.description, existing.IdAlerta]
                );
            }
            continue;
        }
        await query(
            `INSERT INTO tblAgentAlertas (IdAlerta, IdUsuario, Nombre, Descripcion, SqlConsulta,
                CondicionTipo, CondicionValor, ColumnaObjetivo, Frecuencia, Activa, Telefono, Clave, HoraEnvio)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
            [
                generateAlertId(), userId, sa.name, sa.description, 'SELECT 1 AS Sistema',
                'has_rows', null, null, sa.frequency, shared || null, sa.clave, defaultHora
            ]
        );
    }
}

/** Separa una cadena "+52...,+52..." en números individuales. */
export function splitPhones(raw: string | null | undefined): string[] {
    return (raw || '').split(',').map((s) => s.trim()).filter(Boolean);
}

/** Lista COMPARTIDA de números para las alertas de sistema (por usuario). */
export async function getSystemRecipients(userId: string): Promise<string[]> {
    await ensureAlertTables();
    const rows = await query(
        `SELECT TOP 1 TelefonosSistema FROM tblAgentAlertConfig WHERE IdUsuario = ?`,
        [userId]
    );
    return splitPhones((rows as any[])[0]?.TelefonosSistema);
}

export async function setSystemRecipients(userId: string, phones: string[]): Promise<void> {
    await ensureAlertTables();
    const joined = phones.map((p) => p.trim()).filter(Boolean).join(',').slice(0, 1000);
    await query(
        `MERGE tblAgentAlertConfig AS t
         USING (SELECT ? AS IdUsuario) AS s ON t.IdUsuario = s.IdUsuario
         WHEN MATCHED THEN UPDATE SET TelefonosSistema = ?, FechaActualizacion = GETDATE()
         WHEN NOT MATCHED THEN INSERT (IdUsuario, TelefonosSistema) VALUES (?, ?);`,
        [userId, joined, userId, joined]
    );
}

/** Modelo de IA elegido para narrar las alertas de sistema (null = default del server). */
export async function getSystemAlertModel(userId: string): Promise<string | null> {
    await ensureAlertTables();
    const rows = await query(
        `SELECT TOP 1 Modelo FROM tblAgentAlertConfig WHERE IdUsuario = ?`,
        [userId]
    );
    return (rows as any[])[0]?.Modelo || null;
}

export async function setSystemAlertModel(userId: string, model: string | null): Promise<void> {
    await ensureAlertTables();
    await query(
        `MERGE tblAgentAlertConfig AS t
         USING (SELECT ? AS IdUsuario) AS s ON t.IdUsuario = s.IdUsuario
         WHEN MATCHED THEN UPDATE SET Modelo = ?, FechaActualizacion = GETDATE()
         WHEN NOT MATCHED THEN INSERT (IdUsuario, Modelo) VALUES (?, ?);`,
        [userId, model, userId, model]
    );
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
            CondicionTipo, CondicionValor, ColumnaObjetivo, Frecuencia, Activa, Telefono)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            rule.id, rule.userId, rule.name, rule.description, rule.sql,
            rule.conditionType, rule.conditionValue, rule.targetColumn,
            rule.frequency, rule.active ? 1 : 0, rule.telefono ?? null
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

/** Edita los campos de una alerta existente (no toca Activa ni fechas). */
export async function updateAlert(
    userId: string,
    id: string,
    fields: {
        name: string;
        description: string | null;
        sql: string;
        conditionType: CondicionTipo;
        conditionValue: number | null;
        targetColumn: string | null;
        frequency: Frecuencia;
        telefono: string | null;
    }
): Promise<void> {
    await ensureAlertTables();
    // Misma defensa que en createAlert: el SQL debe ser read-only.
    assertReadOnly(fields.sql);

    await query(
        `UPDATE tblAgentAlertas
         SET Nombre = ?, Descripcion = ?, SqlConsulta = ?, CondicionTipo = ?,
             CondicionValor = ?, ColumnaObjetivo = ?, Frecuencia = ?, Telefono = ?
         WHERE IdAlerta = ? AND IdUsuario = ?`,
        [
            fields.name, fields.description, fields.sql, fields.conditionType,
            fields.conditionValue, fields.targetColumn, fields.frequency, fields.telefono,
            id, userId
        ]
    );
}

/** Edita SOLO los números de WhatsApp de una alerta ('' = sin destinatarios). */
export async function updateAlertPhones(userId: string, id: string, telefono: string): Promise<void> {
    await ensureAlertTables();
    await query(
        `UPDATE tblAgentAlertas SET Telefono = ? WHERE IdAlerta = ? AND IdUsuario = ?`,
        [telefono.slice(0, 500), id, userId]
    );
}

/** Edita la hora de envío 'HH:MM' de una alerta de hora fija. */
export async function updateAlertHoraEnvio(userId: string, id: string, hora: string): Promise<void> {
    await ensureAlertTables();
    await query(
        `UPDATE tblAgentAlertas SET HoraEnvio = ? WHERE IdAlerta = ? AND IdUsuario = ?`,
        [hora, id, userId]
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
    /** false en envíos manuales: no debe contar como evaluación del cron. */
    touchLastEvaluation?: boolean;
}): Promise<void> {
    await ensureAlertTables();
    const eventId = 'evt_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    await query(
        `INSERT INTO tblAgentAlertHistorial (IdEvento, IdAlerta, IdUsuario, ValorObservado, Mensaje, ResultadoJson)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [eventId, opts.alertId, opts.userId, opts.observedValue, opts.message, opts.resultsJson.slice(0, 50000)]
    );

    if (opts.touchLastEvaluation === false) return;
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
