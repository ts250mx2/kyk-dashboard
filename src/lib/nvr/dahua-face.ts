import { DahuaRpcSession, DahuaRpcCallError } from './dahua-rpc';

/**
 * Operaciones sobre la librería de rostros (blacklist) de NVR's Dahua 5.x.
 * Formatos verificados en vivo contra un DHI-NVR5416-16HP-EI2 (fw 2026-06):
 * findGroup / startFind / doFind / stopFind. El alta (append) y la baja (delete)
 * siguen el patrón de la web UI del equipo con reintento de formato alterno.
 */

export interface FaceGroup {
    groupId: string;
    name: string;
    type: string;
    size: number;
    channels: number[];
}

export interface FacePerson {
    uid: string;
    name: string;
    sex: string;
    birthday: string;
    comment: string;
    /** Campo ID del equipo; lo usamos para guardar el teléfono en listas blancas. */
    id: string;
    groupId: string;
    picPath: string | null;
    picLen: number;
}

export interface NewFacePerson {
    groupId: string;
    name: string;
    sex?: 'Male' | 'Female' | '';
    birthday?: string;
    comment?: string;
    /** Se escribe en el campo ID del equipo (teléfono en listas blancas). */
    id?: string;
}

export type FaceGroupType = 'BlackListDB' | 'WhiteListDB';

/** Nombre por default al autocrear el grupo de cada tipo. */
export function defaultGroupName(type: FaceGroupType): string {
    return type === 'WhiteListDB' ? 'lista blanca' : 'lista negra';
}

const FACE_INSTANCE = 'faceRecognitionServer.factory.instance';

/**
 * Grupo objetivo: el pedido explícitamente, o el primero del tipo indicado.
 * Nunca cae a un grupo de otro tipo: mezclar lista negra y blanca dispararía
 * alarmas equivocadas en el equipo.
 */
export function pickFaceGroup(
    groups: FaceGroup[],
    requestedId: string | null,
    type: FaceGroupType = 'BlackListDB'
): FaceGroup | null {
    if (requestedId) return groups.find((g) => g.groupId === requestedId) ?? null;
    return groups.find((g) => g.type === type) ?? null;
}

export async function listFaceGroups(session: DahuaRpcSession): Promise<FaceGroup[]> {
    const res = await session.call('faceRecognitionServer.findGroup', { groupID: '', groupType: '' });
    const list: any[] = res.params?.GroupList ?? [];
    return list.map((g) => ({
        groupId: String(g.groupID ?? ''),
        name: String(g.groupName ?? ''),
        type: String(g.groupType ?? ''),
        size: Number(g.groupSize ?? 0),
        channels: Array.isArray(g.channels) ? g.channels : [],
    }));
}

function mapPerson(candidate: any): FacePerson | null {
    const p = candidate?.Person;
    if (!p) return null;
    const image = Array.isArray(p.Image) ? p.Image[0] : null;
    return {
        uid: String(p.UID ?? ''),
        name: String(p.Name ?? ''),
        sex: String(p.Sex ?? ''),
        birthday: String(p.Birthday ?? ''),
        comment: String(p.Comment ?? ''),
        id: String(p.ID ?? ''),
        groupId: String(p.GroupID ?? ''),
        picPath: p.PicUrl || image?.FilePath || null,
        picLen: Number(p.PicLen ?? image?.Length ?? 0),
    };
}

const FIND_PAGE_SIZE = 20;
const FIND_MAX_PAGES = 50;

export async function listFacePersons(session: DahuaRpcSession, groupId: string): Promise<FacePerson[]> {
    const object = await session.instance(FACE_INSTANCE);
    const start = await session.call('faceRecognitionServer.startFind', {
        condition: { GroupID: [groupId] },
    });
    const token = start.params?.token;
    const total = Number(start.params?.totalCount ?? 0);
    if (token == null || total === 0) return [];

    const persons: FacePerson[] = [];
    try {
        for (let page = 0; page < FIND_MAX_PAGES && persons.length < total; page++) {
            const res = await session.call(
                'faceRecognitionServer.doFind',
                { condition: { token, beginNumber: page * FIND_PAGE_SIZE, count: FIND_PAGE_SIZE } },
                { object }
            );
            const candidates: any[] = res.params?.results?.candidates ?? [];
            for (const c of candidates) {
                const person = mapPerson(c);
                if (person) persons.push(person);
            }
            const found = Number(res.params?.results?.found ?? candidates.length);
            if (found < FIND_PAGE_SIZE) break;
        }
    } finally {
        await session.call('faceRecognitionServer.stopFind', { token }, { object, allowError: true }).catch(() => undefined);
    }
    return persons;
}

/**
 * Alta de persona con foto (multipart a /RPC3: JSON en `verify` + binario).
 * El firmware puede contestar result:true SIN crear nada si el formato no es el
 * esperado, así que cada intento se verifica contra el listado real del grupo.
 * El formato principal replica el uploader de la web UI: la imagen va en el
 * campo `filename` y sus Offset/Length declarados en `person.Image`.
 */
export async function addFacePerson(
    session: DahuaRpcSession,
    data: NewFacePerson,
    photo: Buffer
): Promise<{ uid: string | null }> {
    const object = await session.instance(FACE_INSTANCE);
    const person: Record<string, unknown> = {
        GroupID: data.groupId,
        Name: data.name,
        Sex: data.sex || 'Male',
        Birthday: data.birthday || '',
        CertificateType: 'Unknown',
        ID: data.id || '',
        Country: '',
        Province: '',
        City: '',
        HomeAddress: '',
        Comment: data.comment || '',
    };
    const image = [{ Offset: 0, Length: photo.length }];
    const attempts: { params: unknown; fieldName: string }[] = [
        { params: { person: { ...person, Image: image } }, fieldName: 'filename' },
        { params: { person: { ...person, Image: image } }, fieldName: 'file' },
        { params: { groupID: data.groupId, person: { ...person, Image: image } }, fieldName: 'filename' },
        { params: { groupID: data.groupId, person: { ...person, PicLen: photo.length } }, fieldName: 'file' },
    ];

    const findByName = async (): Promise<string | null> => {
        const persons = await listFacePersons(session, data.groupId);
        const match = persons.find((p) => p.name === data.name);
        return match?.uid ?? null;
    };

    const results: string[] = [];
    for (const attempt of attempts) {
        const res = await session.callWithFile('faceRecognitionServer.append', attempt.params, photo, {
            object,
            fieldName: attempt.fieldName,
        });
        const uid = res.params?.UID != null ? String(res.params.UID) : null;
        results.push(
            `${attempt.fieldName}: result=${String(res.result)} UID=${uid ?? '—'}` +
            (res.error ? ` (code ${res.error.code}: ${res.error.message})` : '')
        );
        // UID real (> 0) = alta confirmada por el equipo.
        if (res.result && uid && uid !== '0') return { uid };
        // result true con UID 0/nulo puede ser un falso éxito: verificar contra el listado.
        if (res.result) {
            const found = await findByName();
            if (found) return { uid: found };
        }
    }
    throw new DahuaRpcCallError(
        'faceRecognitionServer.append',
        null,
        `el NVR no registró a la persona. Intentos: ${results.join(' | ')}`
    );
}

/**
 * Crea un grupo del tipo pedido y devuelve su groupID.
 * OJO firmware 5.x: createGroup exige los campos CAPITALIZADOS (GroupName,
 * GroupType...) aunque findGroup los devuelva en minúsculas (validado en vivo).
 * Si el tipo final no queda como se pidió, el grupo se elimina para no dejar
 * uno con semántica equivocada.
 */
export async function createFaceGroup(
    session: DahuaRpcSession,
    name: string,
    type: FaceGroupType = 'BlackListDB'
): Promise<string> {
    const paramVariants: unknown[] = [
        { group: { GroupName: name, GroupDetail: '', GroupType: type } },
        { group: { groupName: name, groupDetail: '', groupType: type } },
    ];
    let lastError = '';
    let created: FaceGroup | null = null;
    for (const params of paramVariants) {
        const res = await session.call('faceRecognitionServer.createGroup', params, { allowError: true });
        if (!res.result) {
            lastError = res.error ? `code ${res.error.code}: ${res.error.message}` : 'sin detalle';
            continue;
        }
        const direct = res.params?.groupID ?? res.params?.GroupID;
        const groups = await listFaceGroups(session);
        created = direct != null
            ? groups.find((g) => g.groupId === String(direct)) ?? null
            : groups.find((g) => g.name === name) ?? null;
        if (created) break;
    }
    if (!created) {
        throw new DahuaRpcCallError('faceRecognitionServer.createGroup', null, lastError || 'no se pudo crear el grupo');
    }
    if (created.type === type) return created.groupId;

    // El tipo no quedó como se pidió: intentar corregirlo (campos capitalizados).
    const mod = await session.call(
        'faceRecognitionServer.modifyGroup',
        { group: { GroupID: created.groupId, GroupName: name, GroupDetail: '', GroupType: type } },
        { allowError: true }
    );
    const after = (await listFaceGroups(session)).find((g) => g.groupId === created!.groupId);
    if (after?.type === type) return created.groupId;

    await session
        .call('faceRecognitionServer.deleteGroup', { groupID: created.groupId }, { allowError: true })
        .catch(() => undefined);
    throw new DahuaRpcCallError(
        'faceRecognitionServer.createGroup',
        null,
        `el firmware no permitió dejar el grupo como ${type}` +
        (mod.error ? ` (modifyGroup: code ${mod.error.code}: ${mod.error.message})` : '')
    );
}

/** Baja de persona. Intenta los formatos de params conocidos de `delete`. */
export async function deleteFacePerson(session: DahuaRpcSession, groupId: string, uid: string): Promise<void> {
    const object = await session.instance(FACE_INSTANCE);
    const variants: unknown[] = [
        { groupID: groupId, UID: [uid] },
        { UID: [uid] },
        { person: { GroupID: groupId, UID: uid } },
    ];
    const errors: string[] = [];
    for (const params of variants) {
        const res = await session.call('faceRecognitionServer.delete', params, { object, allowError: true });
        if (res.result) return;
        errors.push(res.error ? `code ${res.error.code}: ${res.error.message}` : 'sin detalle');
    }
    throw new DahuaRpcCallError('faceRecognitionServer.delete', null, errors.join(' | '));
}

