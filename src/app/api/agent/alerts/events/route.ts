import { NextResponse } from 'next/server';
import { listAlertEvents, markAllEventsRead } from '@/lib/alerts';
import { getUserId } from '@/lib/conversations';

/** GET /api/agent/alerts/events?unread=true&limit=20 → lista eventos disparados */
export async function GET(req: Request) {
    try {
        const userId = await getUserId();
        const url = new URL(req.url);
        const onlyUnread = url.searchParams.get('unread') === 'true';
        const limit = parseInt(url.searchParams.get('limit') || '20', 10);
        const events = await listAlertEvents(userId, { onlyUnread, limit });
        return NextResponse.json({ events });
    } catch (error: any) {
        console.error('listAlertEvents error:', error);
        return NextResponse.json(
            { error: error.message || 'Error listando eventos', events: [] },
            { status: 500 }
        );
    }
}

/** POST /api/agent/alerts/events → marca todos como leídos */
export async function POST() {
    try {
        const userId = await getUserId();
        await markAllEventsRead(userId);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('markAllRead error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
