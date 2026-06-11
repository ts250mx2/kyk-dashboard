import { NextResponse } from 'next/server';
import { getAlert, splitPhones } from '@/lib/alerts';
import { getUserId } from '@/lib/conversations';
import { runEndOfDayMessage } from '@/lib/system-alerts';

const TZ = 'America/Monterrey';

/**
 * POST /api/agent/alerts/[id]/send
 *
 * Envío MANUAL de una alerta automática de fin de día (resumen_dia / hallazgos_dia)
 * a los números de ESA alerta. Si la hora local (Monterrey) está entre las
 * 00:00 y las 4:00, se envía el resumen del DÍA ANTERIOR (el día que acaba de cerrar).
 *
 * No toca FechaUltimaEvaluacion: el envío automático de las 11 PM sigue su curso.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const userId = await getUserId();

        const alert = await getAlert(userId, id);
        if (!alert) {
            return NextResponse.json({ error: 'Alerta no encontrada' }, { status: 404 });
        }
        if (alert.clave !== 'resumen_dia' && alert.clave !== 'hallazgos_dia') {
            return NextResponse.json(
                { error: 'Solo el resumen y los hallazgos del día se pueden enviar manualmente.' },
                { status: 400 }
            );
        }

        const recipients = splitPhones(alert.telefono);
        if (recipients.length === 0) {
            return NextResponse.json(
                { error: 'Agrega al menos un número de WhatsApp a esta alerta.' },
                { status: 400 }
            );
        }

        const hour = new Date(new Date().toLocaleString('en-US', { timeZone: TZ })).getHours();
        const daysAgo = hour < 4 ? 1 : 0; // 00:00–03:59 → el día que acaba de cerrar

        const r = await runEndOfDayMessage(alert.clave, userId, alert.id, recipients, daysAgo);

        return NextResponse.json({
            success: true,
            sent: r.sent,
            recipients: recipients.length,
            period: daysAgo === 1 ? 'ayer' : 'hoy',
        });
    } catch (error: any) {
        console.error('manual send alert error:', error);
        return NextResponse.json(
            { error: error.message || 'Error enviando la alerta' },
            { status: 500 }
        );
    }
}
