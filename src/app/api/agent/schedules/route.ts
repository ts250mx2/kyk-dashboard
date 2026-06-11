import { NextResponse } from 'next/server';
import { getUserId } from '@/lib/conversations';
import {
    createSchedule,
    listSchedulesByUser,
    listSchedulesByReport,
    deleteSchedule,
    setScheduleActive,
} from '@/lib/agent-schedules/schedules-store';

export const runtime = 'nodejs';

/** GET /api/agent/schedules?reportId=123 → envíos programados (del usuario, o de un reporte). */
export async function GET(req: Request) {
    try {
        const userId = await getUserId().catch(() => 'anonymous');
        const reportId = Number(new URL(req.url).searchParams.get('reportId'));
        const schedules = Number.isFinite(reportId) && reportId > 0
            ? await listSchedulesByReport(userId, reportId)
            : await listSchedulesByUser(userId);
        return NextResponse.json({ schedules });
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Error listando envíos', schedules: [] }, { status: 500 });
    }
}

/** POST /api/agent/schedules → crea un envío programado. */
export async function POST(req: Request) {
    try {
        const userId = await getUserId().catch(() => 'anonymous');
        const body = await req.json();
        const idReporte = Number(body?.idReporte);
        const telefono = String(body?.telefono || '').trim();
        const frecuencia = body?.frecuencia === 'weekly' ? 'weekly' : 'daily';
        const horaLocal = Number(body?.horaLocal);
        const diaSemana = body?.diaSemana != null ? Number(body.diaSemana) : null;

        if (!Number.isFinite(idReporte) || idReporte <= 0) {
            return NextResponse.json({ error: 'idReporte inválido' }, { status: 400 });
        }
        if (!telefono) {
            return NextResponse.json({ error: 'Falta el teléfono' }, { status: 400 });
        }
        const idSchedule = await createSchedule({
            userId, idReporte, telefono, frecuencia,
            horaLocal: Number.isFinite(horaLocal) ? horaLocal : 8,
            diaSemana,
        });
        return NextResponse.json({ ok: true, idSchedule });
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Error creando el envío' }, { status: 500 });
    }
}

/** PATCH /api/agent/schedules → activa/pausa un envío. */
export async function PATCH(req: Request) {
    try {
        const userId = await getUserId().catch(() => 'anonymous');
        const body = await req.json();
        const id = Number(body?.id);
        if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: 'id inválido' }, { status: 400 });
        await setScheduleActive(userId, id, !!body?.activo);
        return NextResponse.json({ ok: true });
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Error actualizando el envío' }, { status: 500 });
    }
}

/** DELETE /api/agent/schedules?id=123 → elimina un envío. */
export async function DELETE(req: Request) {
    try {
        const userId = await getUserId().catch(() => 'anonymous');
        const id = Number(new URL(req.url).searchParams.get('id'));
        if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: 'id inválido' }, { status: 400 });
        await deleteSchedule(userId, id);
        return NextResponse.json({ ok: true });
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Error eliminando el envío' }, { status: 500 });
    }
}
