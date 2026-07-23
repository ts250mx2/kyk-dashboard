import { NextResponse } from 'next/server';
import { listFaces, insertFace, type FaceList } from '@/lib/faces/faces-store';
import { syncFaceList } from '@/lib/faces/face-sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const MAX_NAME_LEN = 63;
const PHONE_RE = /^[\d\s()+-]{7,20}$/;

function listaFromParam(value: string | null): FaceList {
    return value === 'white' ? 'blanca' : 'negra';
}

/**
 * GET /api/faces?type=black|white
 * Listado de la lista facial desde SQL (sin fotos; ver /api/faces/[id]/photo).
 */
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const lista = listaFromParam(searchParams.get('type'));
        const faces = await listFaces(lista);
        return NextResponse.json({ lista, faces });
    } catch (error: any) {
        console.error('Error listing faces:', error);
        return NextResponse.json({ error: error.message || 'Error' }, { status: 500 });
    }
}

/**
 * POST /api/faces
 * Alta en SQL + sincronización inmediata a los NVR's activos.
 * multipart/form-data: photo (JPEG), name, type (black|white),
 * phone (obligatorio en white; SOLO se guarda en SQL), sex, comment.
 */
export async function POST(req: Request) {
    try {
        const form = await req.formData();
        const name = String(form.get('name') ?? '').trim();
        const sexRaw = String(form.get('sex') ?? '').trim();
        const comment = String(form.get('comment') ?? '').trim().slice(0, 200);
        const phone = String(form.get('phone') ?? '').trim();
        const lista = listaFromParam(String(form.get('type') ?? '') || null);
        const photo = form.get('photo');

        if (!name) return NextResponse.json({ error: 'Falta el nombre' }, { status: 400 });
        if (name.length > MAX_NAME_LEN) {
            return NextResponse.json({ error: `El nombre no puede exceder ${MAX_NAME_LEN} caracteres` }, { status: 400 });
        }
        if (lista === 'blanca' && !phone) {
            return NextResponse.json({ error: 'Falta el teléfono' }, { status: 400 });
        }
        if (phone && !PHONE_RE.test(phone)) {
            return NextResponse.json({ error: 'Teléfono inválido (7 a 20 dígitos)' }, { status: 400 });
        }
        if (!(photo instanceof File) || photo.size === 0) {
            return NextResponse.json({ error: 'Falta la foto' }, { status: 400 });
        }
        if (photo.size > MAX_PHOTO_BYTES) {
            return NextResponse.json({ error: 'La foto excede 2 MB; usa una más ligera' }, { status: 400 });
        }
        const buf = Buffer.from(await photo.arrayBuffer());
        if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) {
            return NextResponse.json({ error: 'La foto debe ser JPEG' }, { status: 400 });
        }
        const sexo = sexRaw === 'Male' ? 'Male' : 'Female';

        const id = await insertFace({
            lista,
            nombre: name,
            sexo,
            telefono: phone || null,
            comentario: comment || null,
            foto: buf,
        });

        const sync = await syncFaceList(lista);
        return NextResponse.json({ ok: true, id, sync });
    } catch (error: any) {
        console.error('Error adding face:', error);
        return NextResponse.json({ error: error.message || 'Error' }, { status: 500 });
    }
}
