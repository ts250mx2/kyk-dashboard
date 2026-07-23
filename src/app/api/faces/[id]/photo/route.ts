import { NextResponse } from 'next/server';
import { getFacePhoto } from '@/lib/faces/faces-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/faces/[id]/photo — foto JPEG del registro. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const faceId = Number(id);
        if (!Number.isFinite(faceId) || faceId <= 0) {
            return NextResponse.json({ error: 'id inválido' }, { status: 400 });
        }
        const photo = await getFacePhoto(faceId);
        if (!photo) return NextResponse.json({ error: 'Sin foto' }, { status: 404 });
        return new NextResponse(new Uint8Array(photo), {
            headers: {
                'Content-Type': 'image/jpeg',
                'Cache-Control': 'private, max-age=3600',
            },
        });
    } catch (error: any) {
        console.error('Error fetching face photo:', error);
        return NextResponse.json({ error: error.message || 'Error' }, { status: 500 });
    }
}
