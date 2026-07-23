import { NextResponse } from 'next/server';
import { getNvrConnection } from '@/lib/nvr/nvr-db';
import { withDahuaRpc, type DahuaRpcSession } from '@/lib/nvr/dahua-rpc';
import {
    listFaceGroups,
    listFacePersons,
    pickFaceGroup,
    type FaceGroup,
    type FaceGroupType,
} from '@/lib/nvr/dahua-face';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_PERSONS = 200;

interface ViewPerson {
    uid: string;
    name: string;
    sex: string;
    /** true si la persona lleva la marca KYK- (sincronizada desde el dashboard). */
    synced: boolean;
    photo: string | null;
}

interface ViewList {
    group: { name: string; groupId: string; channels: number[] } | null;
    persons: ViewPerson[];
}

async function readList(session: DahuaRpcSession, groups: FaceGroup[], type: FaceGroupType): Promise<ViewList> {
    const group = pickFaceGroup(groups, null, type);
    if (!group) return { group: null, persons: [] };
    const persons = (await listFacePersons(session, group.groupId)).slice(0, MAX_PERSONS);
    const out: ViewPerson[] = [];
    for (const p of persons) {
        const photo = p.picPath ? await session.loadFaceFile(p.picPath) : null;
        out.push({
            uid: p.uid,
            name: p.name,
            sex: p.sex,
            synced: p.id.startsWith('KYK-'),
            photo: photo ? `data:image/jpeg;base64,${photo.toString('base64')}` : null,
        });
    }
    return { group: { name: group.name, groupId: group.groupId, channels: group.channels }, persons: out };
}

/**
 * GET /api/nvr/[id]/faces
 * SOLO LECTURA: rostros que este NVR tiene cargados en sus grupos de lista
 * negra y lista blanca (las altas se hacen por /api/faces, que sincroniza).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const nvr = await getNvrConnection(Number(id));

        const data = await withDahuaRpc({ ip: nvr.ip, user: nvr.user, pass: nvr.pass }, async (session) => {
            const groups = await listFaceGroups(session);
            const black = await readList(session, groups, 'BlackListDB');
            const white = await readList(session, groups, 'WhiteListDB');
            return { black, white };
        });

        return NextResponse.json(data);
    } catch (error: any) {
        console.error('Error reading NVR faces:', error);
        return NextResponse.json(
            { error: error?.name === 'AbortError' ? 'El NVR no respondió (timeout)' : error.message || 'Error' },
            { status: 502 }
        );
    }
}
