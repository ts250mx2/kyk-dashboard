/**
 * Persistencia de las listas faciales (negra/blanca) en SQL Server.
 *
 * El SQL es la FUENTE DE VERDAD: nombre, sexo, teléfono (solo aquí, nunca en el
 * NVR), comentario y la foto JPEG. Los NVR's se sincronizan desde estas filas
 * (ver face-sync.ts); en el equipo cada persona lleva la marca `KYK-<IdRostro>`
 * en su campo ID para reconciliar.
 */

import { query } from '@/lib/db';

export type FaceList = 'negra' | 'blanca';

let tableEnsured = false;

export async function ensureFacesTable(): Promise<void> {
    if (tableEnsured) return;
    try {
        await query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tblRostros' AND xtype='U')
            CREATE TABLE tblRostros (
                IdRostro INT IDENTITY(1,1) PRIMARY KEY,
                Lista VARCHAR(6) NOT NULL,
                Nombre NVARCHAR(63) NOT NULL,
                Sexo VARCHAR(6) NOT NULL DEFAULT 'Female',
                Telefono VARCHAR(20) NULL,
                Comentario NVARCHAR(200) NULL,
                Foto VARBINARY(MAX) NOT NULL,
                FechaAlta DATETIME NOT NULL DEFAULT GETDATE(),
                INDEX IX_Rostros_Lista (Lista)
            )
        `);
        tableEnsured = true;
    } catch (e) {
        console.error('No se pudo asegurar la tabla tblRostros:', e);
    }
}

export interface FaceRecord {
    id: number;
    lista: FaceList;
    nombre: string;
    sexo: string;
    telefono: string | null;
    comentario: string | null;
    fechaAlta: string;
}

export interface FaceRecordWithPhoto extends FaceRecord {
    foto: Buffer;
}

function mapRow(r: any): FaceRecord {
    return {
        id: r.IdRostro,
        lista: r.Lista === 'blanca' ? 'blanca' : 'negra',
        nombre: r.Nombre ?? '',
        sexo: r.Sexo ?? '',
        telefono: r.Telefono ?? null,
        comentario: r.Comentario ?? null,
        fechaAlta: r.FechaAlta instanceof Date ? r.FechaAlta.toISOString() : String(r.FechaAlta ?? ''),
    };
}

export async function listFaces(lista: FaceList): Promise<FaceRecord[]> {
    await ensureFacesTable();
    const rows = await query(
        'SELECT IdRostro, Lista, Nombre, Sexo, Telefono, Comentario, FechaAlta FROM tblRostros WHERE Lista = ? ORDER BY FechaAlta DESC',
        [lista]
    );
    return (rows as any[]).map(mapRow);
}

export async function listFacesWithPhotos(lista: FaceList): Promise<FaceRecordWithPhoto[]> {
    await ensureFacesTable();
    const rows = await query(
        'SELECT IdRostro, Lista, Nombre, Sexo, Telefono, Comentario, FechaAlta, Foto FROM tblRostros WHERE Lista = ? ORDER BY IdRostro',
        [lista]
    );
    return (rows as any[]).map((r) => ({ ...mapRow(r), foto: r.Foto as Buffer }));
}

export async function getFaceById(id: number): Promise<FaceRecord | null> {
    await ensureFacesTable();
    const rows = await query(
        'SELECT IdRostro, Lista, Nombre, Sexo, Telefono, Comentario, FechaAlta FROM tblRostros WHERE IdRostro = ?',
        [id]
    );
    const row = (rows as any[])[0];
    return row ? mapRow(row) : null;
}

export async function getFacePhoto(id: number): Promise<Buffer | null> {
    await ensureFacesTable();
    const rows = await query('SELECT Foto FROM tblRostros WHERE IdRostro = ?', [id]);
    const row = (rows as any[])[0];
    return row?.Foto ? (row.Foto as Buffer) : null;
}

export interface NewFaceRecord {
    lista: FaceList;
    nombre: string;
    sexo: string;
    telefono?: string | null;
    comentario?: string | null;
    foto: Buffer;
}

export async function insertFace(data: NewFaceRecord): Promise<number> {
    await ensureFacesTable();
    const rows = await query(
        `INSERT INTO tblRostros (Lista, Nombre, Sexo, Telefono, Comentario, Foto)
         OUTPUT INSERTED.IdRostro
         VALUES (?, ?, ?, ?, ?, ?)`,
        [data.lista, data.nombre, data.sexo, data.telefono ?? null, data.comentario ?? null, data.foto]
    );
    const id = (rows as any[])[0]?.IdRostro;
    if (!id) throw new Error('No se pudo insertar el rostro');
    return Number(id);
}

export async function deleteFace(id: number): Promise<void> {
    await ensureFacesTable();
    await query('DELETE FROM tblRostros WHERE IdRostro = ?', [id]);
}

/** Búsqueda por nombre exacto dentro de una lista (para adopción sin duplicar). */
export async function findFaceByName(lista: FaceList, nombre: string): Promise<FaceRecord | null> {
    await ensureFacesTable();
    const rows = await query(
        'SELECT TOP 1 IdRostro, Lista, Nombre, Sexo, Telefono, Comentario, FechaAlta FROM tblRostros WHERE Lista = ? AND Nombre = ?',
        [lista, nombre]
    );
    const row = (rows as any[])[0];
    return row ? mapRow(row) : null;
}
