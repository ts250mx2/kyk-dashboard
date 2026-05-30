/**
 * Persistencia del Agente Avanzado.
 *
 * - tblAgentReports:     una fila = un reporte guardado (definición JSON data-driven).
 * - tblAgentReportRuns:  log de cada ejecución (tokens/costo real conciliado).
 *
 * Sigue el idiom del codebase: guard de módulo + `IF NOT EXISTS sysobjects`
 * (idéntico a metrics.ts) y `INSERT ...; SELECT SCOPE_IDENTITY()` (forecast/plans).
 * Soft-delete con `Eliminado BIT` (convención tblAgent*).
 */

import { query } from '@/lib/db';
import type { AdvancedReportDefinition } from './types';

let tablesEnsured = false;

export async function ensureAdvancedReportsTables(): Promise<void> {
    if (tablesEnsured) return;
    try {
        await query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tblAgentReports' AND xtype='U')
            CREATE TABLE tblAgentReports (
                IdReporte INT IDENTITY(1,1) PRIMARY KEY,
                IdUsuario VARCHAR(64) NOT NULL,
                Titulo NVARCHAR(300) NOT NULL,
                Descripcion NVARCHAR(1000) NULL,
                DefinicionJson NVARCHAR(MAX) NOT NULL,
                SchemaVersion INT NOT NULL DEFAULT 1,
                EstTokensInput INT NULL,
                EstTokensOutput INT NULL,
                EstCostoUsd DECIMAL(10,4) NULL,
                EstCostoMxn DECIMAL(10,2) NULL,
                RealTokensInput INT NULL,
                RealTokensOutput INT NULL,
                RealCostoUsd DECIMAL(10,4) NULL,
                RealCostoMxn DECIMAL(10,2) NULL,
                UsdMxnRate DECIMAL(10,4) NULL,
                Modelo VARCHAR(50) NULL,
                IdFolder INT NULL,
                FechaCreacion DATETIME NOT NULL DEFAULT GETDATE(),
                FechaActualizacion DATETIME NOT NULL DEFAULT GETDATE(),
                Eliminado BIT NOT NULL DEFAULT 0,
                INDEX IX_AgentReports_Usuario (IdUsuario, Eliminado, FechaCreacion DESC)
            )
        `);
        // Migración: columna de carpeta para tablas existentes
        await query(`IF COL_LENGTH('tblAgentReports', 'IdFolder') IS NULL ALTER TABLE tblAgentReports ADD IdFolder INT NULL`);
        // Tabla de carpetas
        await query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tblAgentReportFolders' AND xtype='U')
            CREATE TABLE tblAgentReportFolders (
                IdFolder INT IDENTITY(1,1) PRIMARY KEY,
                IdUsuario VARCHAR(64) NOT NULL,
                Nombre NVARCHAR(120) NOT NULL,
                FechaCreacion DATETIME NOT NULL DEFAULT GETDATE(),
                Eliminado BIT NOT NULL DEFAULT 0,
                INDEX IX_ReportFolders_Usuario (IdUsuario, Eliminado, FechaCreacion ASC)
            )
        `);
        await query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tblAgentReportRuns' AND xtype='U')
            CREATE TABLE tblAgentReportRuns (
                IdRun INT IDENTITY(1,1) PRIMARY KEY,
                IdUsuario VARCHAR(64) NOT NULL,
                IdReporte INT NULL,
                Prompt NVARCHAR(MAX) NULL,
                Modelo VARCHAR(50) NULL,
                Turnos INT NOT NULL DEFAULT 0,
                TokensInput INT NOT NULL DEFAULT 0,
                TokensOutput INT NOT NULL DEFAULT 0,
                TokensCacheRead INT NOT NULL DEFAULT 0,
                TokensCacheWrite INT NOT NULL DEFAULT 0,
                CostoUsd DECIMAL(10,4) NULL,
                CostoMxn DECIMAL(10,2) NULL,
                UsdMxnRate DECIMAL(10,4) NULL,
                EstCostoUsd DECIMAL(10,4) NULL,
                Status VARCHAR(20) NOT NULL DEFAULT 'ok',
                ErrorMsg NVARCHAR(500) NULL,
                LatenciaMs INT NULL,
                FechaEvento DATETIME NOT NULL DEFAULT GETDATE(),
                INDEX IX_AgentReportRuns_Usuario (IdUsuario, FechaEvento DESC),
                INDEX IX_AgentReportRuns_Reporte (IdReporte)
            )
        `);
        tablesEnsured = true;
    } catch (e) {
        console.error('No se pudieron asegurar las tablas de reportes avanzados:', e);
    }
}

function parseJsonSafe<T>(s: string | null | undefined, fallback: T): T {
    if (!s) return fallback;
    try { return JSON.parse(s) as T; } catch { return fallback; }
}

export interface ReportCostFields {
    tokensInput?: number;
    tokensOutput?: number;
    costoUsd?: number;
    costoMxn?: number;
}

export interface CreateReportInput {
    userId: string;
    definition: AdvancedReportDefinition;
    est?: ReportCostFields;
    real?: ReportCostFields;
    usdMxnRate?: number;
    model?: string;
}

/** Inserta un reporte y devuelve su IdReporte. */
export async function createReport(input: CreateReportInput): Promise<number> {
    await ensureAdvancedReportsTables();
    const def = input.definition;
    const json = JSON.stringify(def).slice(0, 200000);
    const descripcion = (def.description || '').slice(0, 1000) || null;
    const result = await query(
        `INSERT INTO tblAgentReports
            (IdUsuario, Titulo, Descripcion, DefinicionJson, SchemaVersion,
             EstTokensInput, EstTokensOutput, EstCostoUsd, EstCostoMxn,
             RealTokensInput, RealTokensOutput, RealCostoUsd, RealCostoMxn,
             UsdMxnRate, Modelo, FechaCreacion, FechaActualizacion, Eliminado)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, GETDATE(), GETDATE(), 0);
         SELECT CAST(SCOPE_IDENTITY() AS INT) AS IdReporte;`,
        [
            input.userId,
            def.title.slice(0, 300),
            descripcion,
            json,
            def.schemaVersion || 1,
            input.est?.tokensInput ?? null,
            input.est?.tokensOutput ?? null,
            input.est?.costoUsd ?? null,
            input.est?.costoMxn ?? null,
            input.real?.tokensInput ?? null,
            input.real?.tokensOutput ?? null,
            input.real?.costoUsd ?? null,
            input.real?.costoMxn ?? null,
            input.usdMxnRate ?? null,
            input.model ?? null,
        ]
    ) as Array<{ IdReporte: number }>;
    return result[0]?.IdReporte;
}

export interface SavedReportRow {
    idReporte: number;
    idUsuario: string;
    titulo: string;
    descripcion: string | null;
    definition: AdvancedReportDefinition | null;
    estCostoUsd: number | null;
    estCostoMxn: number | null;
    realCostoUsd: number | null;
    realCostoMxn: number | null;
    realTokensInput: number | null;
    realTokensOutput: number | null;
    modelo: string | null;
    idFolder: number | null;
    fechaCreacion: string;
    fechaActualizacion: string;
}

export interface SavedReportListItem {
    idReporte: number;
    titulo: string;
    descripcion: string | null;
    visualization: string | null;
    realCostoUsd: number | null;
    realCostoMxn: number | null;
    estCostoMxn: number | null;
    modelo: string | null;
    idFolder: number | null;
    fechaCreacion: string;
}

/** Devuelve un reporte completo (con definición parseada) para el visor. */
export async function getReportById(userId: string, idReporte: number): Promise<SavedReportRow | null> {
    await ensureAdvancedReportsTables();
    const rows = await query(
        `SELECT TOP 1 IdReporte, IdUsuario, Titulo, Descripcion, DefinicionJson,
                EstCostoUsd, EstCostoMxn, RealCostoUsd, RealCostoMxn,
                RealTokensInput, RealTokensOutput, Modelo, IdFolder, FechaCreacion, FechaActualizacion
         FROM tblAgentReports
         WHERE IdReporte = ? AND IdUsuario = ? AND Eliminado = 0`,
        [idReporte, userId]
    ) as any[];
    const r = rows[0];
    if (!r) return null;
    return {
        idReporte: r.IdReporte,
        idUsuario: r.IdUsuario,
        titulo: r.Titulo,
        descripcion: r.Descripcion ?? null,
        definition: parseJsonSafe<AdvancedReportDefinition | null>(r.DefinicionJson, null),
        estCostoUsd: r.EstCostoUsd != null ? Number(r.EstCostoUsd) : null,
        estCostoMxn: r.EstCostoMxn != null ? Number(r.EstCostoMxn) : null,
        realCostoUsd: r.RealCostoUsd != null ? Number(r.RealCostoUsd) : null,
        realCostoMxn: r.RealCostoMxn != null ? Number(r.RealCostoMxn) : null,
        realTokensInput: r.RealTokensInput != null ? Number(r.RealTokensInput) : null,
        realTokensOutput: r.RealTokensOutput != null ? Number(r.RealTokensOutput) : null,
        modelo: r.Modelo ?? null,
        idFolder: r.IdFolder != null ? Number(r.IdFolder) : null,
        fechaCreacion: r.FechaCreacion?.toISOString?.() || String(r.FechaCreacion),
        fechaActualizacion: r.FechaActualizacion?.toISOString?.() || String(r.FechaActualizacion),
    };
}

/** Lista los reportes del usuario para la galería (sin la definición pesada). */
export async function listReportsByUser(userId: string): Promise<SavedReportListItem[]> {
    await ensureAdvancedReportsTables();
    const rows = await query(
        `SELECT IdReporte, Titulo, Descripcion, DefinicionJson,
                EstCostoMxn, RealCostoUsd, RealCostoMxn, Modelo, IdFolder, FechaCreacion
         FROM tblAgentReports
         WHERE IdUsuario = ? AND Eliminado = 0
         ORDER BY FechaCreacion DESC`,
        [userId]
    ) as any[];
    return rows.map((r) => {
        const def = parseJsonSafe<AdvancedReportDefinition | null>(r.DefinicionJson, null);
        return {
            idReporte: r.IdReporte,
            titulo: r.Titulo,
            descripcion: r.Descripcion ?? null,
            visualization: def?.visualization ?? null,
            realCostoUsd: r.RealCostoUsd != null ? Number(r.RealCostoUsd) : null,
            realCostoMxn: r.RealCostoMxn != null ? Number(r.RealCostoMxn) : null,
            estCostoMxn: r.EstCostoMxn != null ? Number(r.EstCostoMxn) : null,
            modelo: r.Modelo ?? null,
            idFolder: r.IdFolder != null ? Number(r.IdFolder) : null,
            fechaCreacion: r.FechaCreacion?.toISOString?.() || String(r.FechaCreacion),
        };
    });
}

/** Mueve un reporte a una carpeta (folderId null = quitarlo de carpetas). */
export async function moveReport(userId: string, idReporte: number, folderId: number | null): Promise<void> {
    await ensureAdvancedReportsTables();
    await query(
        `UPDATE tblAgentReports SET IdFolder = ?, FechaActualizacion = GETDATE() WHERE IdReporte = ? AND IdUsuario = ?`,
        [folderId ?? null, idReporte, userId]
    );
}

/** Clona un reporte (mismo contenido, nombre " (copia)", misma carpeta). */
export async function cloneReport(userId: string, idReporte: number): Promise<number | null> {
    const src = await getReportById(userId, idReporte);
    if (!src?.definition) return null;
    const def: AdvancedReportDefinition = { ...src.definition, title: `${src.titulo} (copia)`.slice(0, 300) };
    const newId = await createReport({
        userId,
        definition: def,
        real: {
            tokensInput: src.realTokensInput ?? undefined,
            tokensOutput: src.realTokensOutput ?? undefined,
            costoUsd: src.realCostoUsd ?? undefined,
            costoMxn: src.realCostoMxn ?? undefined,
        },
        model: src.modelo ?? undefined,
    });
    if (newId && src.idFolder != null) await moveReport(userId, newId, src.idFolder);
    return newId;
}

// ─── Carpetas ───────────────────────────────────────────────────────────────

export interface ReportFolder {
    idFolder: number;
    nombre: string;
}

export async function listFolders(userId: string): Promise<ReportFolder[]> {
    await ensureAdvancedReportsTables();
    const rows = (await query(
        `SELECT IdFolder, Nombre FROM tblAgentReportFolders WHERE IdUsuario = ? AND Eliminado = 0 ORDER BY FechaCreacion ASC`,
        [userId]
    )) as any[];
    return rows.map((r) => ({ idFolder: r.IdFolder, nombre: r.Nombre }));
}

export async function createFolder(userId: string, nombre: string): Promise<number | null> {
    await ensureAdvancedReportsTables();
    const result = (await query(
        `INSERT INTO tblAgentReportFolders (IdUsuario, Nombre, FechaCreacion, Eliminado)
         VALUES (?, ?, GETDATE(), 0);
         SELECT CAST(SCOPE_IDENTITY() AS INT) AS IdFolder;`,
        [userId, (nombre || 'Carpeta').slice(0, 120)]
    )) as Array<{ IdFolder: number }>;
    return result[0]?.IdFolder ?? null;
}

/** Borra una carpeta y saca sus reportes a la raíz (no los elimina). */
export async function deleteFolder(userId: string, idFolder: number): Promise<void> {
    await ensureAdvancedReportsTables();
    await query(`UPDATE tblAgentReports SET IdFolder = NULL WHERE IdFolder = ? AND IdUsuario = ?`, [idFolder, userId]);
    await query(`UPDATE tblAgentReportFolders SET Eliminado = 1 WHERE IdFolder = ? AND IdUsuario = ?`, [idFolder, userId]);
}

/** Soft-delete: marca el reporte como eliminado. */
export async function softDeleteReport(userId: string, idReporte: number): Promise<boolean> {
    await ensureAdvancedReportsTables();
    await query(
        `UPDATE tblAgentReports SET Eliminado = 1, FechaActualizacion = GETDATE()
         WHERE IdReporte = ? AND IdUsuario = ?`,
        [idReporte, userId]
    );
    return true;
}

/** Concilia el costo REAL del reporte tras terminar la ejecución. */
export async function updateReportCost(
    idReporte: number,
    real: ReportCostFields,
    usdMxnRate?: number
): Promise<void> {
    await ensureAdvancedReportsTables();
    await query(
        `UPDATE tblAgentReports
         SET RealTokensInput = ?, RealTokensOutput = ?, RealCostoUsd = ?, RealCostoMxn = ?,
             UsdMxnRate = ISNULL(?, UsdMxnRate), FechaActualizacion = GETDATE()
         WHERE IdReporte = ?`,
        [
            real.tokensInput ?? null,
            real.tokensOutput ?? null,
            real.costoUsd ?? null,
            real.costoMxn ?? null,
            usdMxnRate ?? null,
            idReporte,
        ]
    );
}

/** Actualiza un reporte existente en su lugar (edición por el agente). */
export async function updateReport(
    userId: string,
    idReporte: number,
    definition: AdvancedReportDefinition,
    real?: ReportCostFields,
    model?: string,
    usdMxnRate?: number
): Promise<number> {
    await ensureAdvancedReportsTables();
    const json = JSON.stringify(definition).slice(0, 200000);
    const descripcion = (definition.description || '').slice(0, 1000) || null;
    await query(
        `UPDATE tblAgentReports
            SET Titulo = ?, Descripcion = ?, DefinicionJson = ?, SchemaVersion = ?,
                RealTokensInput = ?, RealTokensOutput = ?, RealCostoUsd = ?, RealCostoMxn = ?,
                UsdMxnRate = ISNULL(?, UsdMxnRate), Modelo = ISNULL(?, Modelo), FechaActualizacion = GETDATE()
          WHERE IdReporte = ? AND IdUsuario = ? AND Eliminado = 0`,
        [
            definition.title.slice(0, 300),
            descripcion,
            json,
            definition.schemaVersion || 1,
            real?.tokensInput ?? null,
            real?.tokensOutput ?? null,
            real?.costoUsd ?? null,
            real?.costoMxn ?? null,
            usdMxnRate ?? null,
            model ?? null,
            idReporte,
            userId,
        ]
    );
    return idReporte;
}

export interface ReportRunInput {
    userId: string;
    idReporte?: number | null;
    prompt?: string;
    model?: string;
    turnos: number;
    tokensInput: number;
    tokensOutput: number;
    tokensCacheRead?: number;
    tokensCacheWrite?: number;
    costoUsd?: number;
    costoMxn?: number;
    usdMxnRate?: number;
    estCostoUsd?: number;
    status?: string;
    errorMsg?: string;
    latenciaMs?: number;
}

/** Registra una ejecución del agente avanzado (auditoría de gasto). */
export async function insertReportRun(run: ReportRunInput): Promise<number | null> {
    await ensureAdvancedReportsTables();
    try {
        const result = await query(
            `INSERT INTO tblAgentReportRuns
                (IdUsuario, IdReporte, Prompt, Modelo, Turnos,
                 TokensInput, TokensOutput, TokensCacheRead, TokensCacheWrite,
                 CostoUsd, CostoMxn, UsdMxnRate, EstCostoUsd, Status, ErrorMsg, LatenciaMs)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
             SELECT CAST(SCOPE_IDENTITY() AS INT) AS IdRun;`,
            [
                run.userId,
                run.idReporte ?? null,
                (run.prompt || '').slice(0, 8000) || null,
                run.model?.slice(0, 50) ?? null,
                run.turnos,
                run.tokensInput,
                run.tokensOutput,
                run.tokensCacheRead ?? 0,
                run.tokensCacheWrite ?? 0,
                run.costoUsd ?? null,
                run.costoMxn ?? null,
                run.usdMxnRate ?? null,
                run.estCostoUsd ?? null,
                run.status ?? 'ok',
                run.errorMsg?.slice(0, 500) ?? null,
                run.latenciaMs ?? null,
            ]
        ) as Array<{ IdRun: number }>;
        return result[0]?.IdRun ?? null;
    } catch (e) {
        console.error('insertReportRun failed:', e);
        return null;
    }
}
