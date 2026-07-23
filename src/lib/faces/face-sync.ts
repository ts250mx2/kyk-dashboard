/**
 * Sincronización de las listas faciales SQL → NVR's Dahua.
 *
 * El SQL es la fuente de verdad. En el NVR cada persona sincronizada lleva
 * `KYK-<IdRostro>` en su campo ID (el teléfono NUNCA se escribe al equipo).
 * Reconciliación por NVR y lista:
 *   1. ADOPCIÓN: personas del equipo SIN marca KYK- (altas manuales previas) se
 *      importan a SQL con su foto y se reescriben en el equipo con su marca.
 *   2. ALTAS: filas de SQL que no están en el equipo se agregan.
 *   3. BAJAS: personas del equipo con marca KYK- que ya no existen en SQL se
 *      eliminan.
 */

import { query } from '@/lib/db';
import { withDahuaRpc, DahuaRpcSession } from '@/lib/nvr/dahua-rpc';
import {
    listFaceGroups,
    listFacePersons,
    addFacePerson,
    deleteFacePerson,
    createFaceGroup,
    pickFaceGroup,
    defaultGroupName,
    type FaceGroupType,
    type FacePerson,
} from '@/lib/nvr/dahua-face';
import {
    listFacesWithPhotos,
    insertFace,
    findFaceByName,
    type FaceList,
    type FaceRecordWithPhoto,
} from './faces-store';

const KYK_PREFIX = 'KYK-';

export function listToGroupType(lista: FaceList): FaceGroupType {
    return lista === 'blanca' ? 'WhiteListDB' : 'BlackListDB';
}

export interface NvrSyncReport {
    idNvr: number;
    nvr: string;
    ok: boolean;
    /** Personas del NVR importadas a SQL (primera adopción). */
    imported: number;
    /** Personas de SQL dadas de alta en el NVR. */
    added: number;
    /** Personas eliminadas del NVR (ya no están en SQL). */
    removed: number;
    errors: string[];
}

interface NvrRow {
    IdNVR: number;
    Tienda: string | null;
    Descripcion: string | null;
    IP: string | null;
    Usuario: string | null;
    Passwd: string | null;
}

function sexOf(value: string): string {
    return value === 'Male' || value === 'Female' ? value : 'Female';
}

function kykIdOf(person: FacePerson): number | null {
    if (!person.id.startsWith(KYK_PREFIX)) return null;
    const n = Number(person.id.slice(KYK_PREFIX.length));
    return Number.isFinite(n) && n > 0 ? n : null;
}

/** Reconciliación de UNA lista contra UN NVR. Muta `sqlFaces` al adoptar. */
async function syncListInSession(
    session: DahuaRpcSession,
    lista: FaceList,
    sqlFaces: FaceRecordWithPhoto[],
    report: NvrSyncReport
): Promise<void> {
    const type = listToGroupType(lista);
    const groups = await listFaceGroups(session);
    let group = pickFaceGroup(groups, null, type);
    if (!group) {
        const groupId = await createFaceGroup(session, defaultGroupName(type), type);
        group = { groupId, name: defaultGroupName(type), type, size: 0, channels: [] };
    }

    // 1) Adopción de personas sin marca KYK- (altas hechas fuera del dashboard).
    const devicePersons = await listFacePersons(session, group.groupId);
    for (const person of devicePersons) {
        if (kykIdOf(person) !== null) continue;
        try {
            const photo = person.picPath ? await session.loadFaceFile(person.picPath) : null;
            if (!photo) {
                report.errors.push(`"${person.name}": no se pudo bajar su foto del NVR para adoptarla`);
                continue;
            }
            let sqlId: number;
            const existing =
                sqlFaces.find((f) => f.nombre === person.name) ?? (await findFaceByName(lista, person.name));
            if (existing) {
                sqlId = existing.id;
            } else {
                sqlId = await insertFace({
                    lista,
                    nombre: person.name,
                    sexo: sexOf(person.sex),
                    comentario: person.comment || null,
                    foto: photo,
                });
                sqlFaces.push({
                    id: sqlId,
                    lista,
                    nombre: person.name,
                    sexo: sexOf(person.sex),
                    telefono: null,
                    comentario: person.comment || null,
                    fechaAlta: new Date().toISOString(),
                    foto: photo,
                });
                report.imported++;
            }
            // Reescribir en el equipo con la marca (baja + alta con mismo rostro).
            await deleteFacePerson(session, group.groupId, person.uid);
            await addFacePerson(
                session,
                {
                    groupId: group.groupId,
                    name: person.name,
                    sex: sexOf(person.sex) as 'Male' | 'Female',
                    comment: person.comment || undefined,
                    id: `${KYK_PREFIX}${sqlId}`,
                },
                photo
            );
        } catch (e: any) {
            report.errors.push(`"${person.name}": ${e.message || 'error al adoptar'}`);
        }
    }

    // 2/3) Altas y bajas contra el estado ya adoptado.
    const current = await listFacePersons(session, group.groupId);
    const onDevice = new Map<number, FacePerson>();
    for (const person of current) {
        const kykId = kykIdOf(person);
        if (kykId === null) continue;
        if (onDevice.has(kykId)) {
            // Dos personas con la misma marca (ej. nombres repetidos adoptados): sobra una.
            try {
                await deleteFacePerson(session, group.groupId, person.uid);
                report.removed++;
            } catch (e: any) {
                report.errors.push(`"${person.name}" (duplicada): ${e.message || 'error al eliminar'}`);
            }
            continue;
        }
        onDevice.set(kykId, person);
    }

    for (const face of sqlFaces) {
        if (onDevice.has(face.id)) continue;
        try {
            await addFacePerson(
                session,
                {
                    groupId: group.groupId,
                    name: face.nombre,
                    sex: face.sexo === 'Male' ? 'Male' : 'Female',
                    comment: face.comentario || undefined,
                    id: `${KYK_PREFIX}${face.id}`,
                },
                face.foto
            );
            report.added++;
        } catch (e: any) {
            report.errors.push(`"${face.nombre}": ${e.message || 'error al dar de alta en el NVR'}`);
        }
    }

    const sqlIds = new Set(sqlFaces.map((f) => f.id));
    for (const [kykId, person] of onDevice) {
        if (sqlIds.has(kykId)) continue;
        try {
            await deleteFacePerson(session, group.groupId, person.uid);
            report.removed++;
        } catch (e: any) {
            report.errors.push(`"${person.name}": ${e.message || 'error al eliminar del NVR'}`);
        }
    }
}

async function getActiveNvrs(idNvr?: number): Promise<NvrRow[]> {
    const rows = (await query(
        `SELECT n.IdNVR, t.Tienda, n.Descripcion, n.IP, n.Usuario, n.Passwd
         FROM dbo.tblNVR n
         LEFT JOIN dbo.tblTiendas t ON t.IdTienda = n.IdTienda
         WHERE n.Status = 0 AND n.IP IS NOT NULL AND LTRIM(RTRIM(n.IP)) <> ''`
    )) as NvrRow[];
    return idNvr ? rows.filter((r) => r.IdNVR === idNvr) : rows;
}

/**
 * Sincroniza una lista (negra o blanca) a todos los NVR's activos (o a uno).
 * Nunca lanza por fallas de un equipo: cada NVR trae su propio reporte.
 */
export async function syncFaceList(lista: FaceList, idNvr?: number): Promise<NvrSyncReport[]> {
    const nvrs = await getActiveNvrs(idNvr);
    const sqlFaces = await listFacesWithPhotos(lista);
    const reports: NvrSyncReport[] = [];

    for (const nvr of nvrs) {
        const report: NvrSyncReport = {
            idNvr: nvr.IdNVR,
            nvr: nvr.Descripcion || nvr.Tienda || `NVR #${nvr.IdNVR}`,
            ok: false,
            imported: 0,
            added: 0,
            removed: 0,
            errors: [],
        };
        try {
            await withDahuaRpc(
                { ip: (nvr.IP ?? '').trim(), user: nvr.Usuario ?? '', pass: nvr.Passwd ?? '' },
                (session) => syncListInSession(session, lista, sqlFaces, report)
            );
            report.ok = report.errors.length === 0;
        } catch (e: any) {
            report.errors.push(e?.name === 'AbortError' ? 'El NVR no respondió (timeout)' : e.message || 'Error');
        }
        reports.push(report);
    }
    return reports;
}
