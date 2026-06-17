import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { assertReadOnly } from '@/lib/sql-sandbox';
import { getAlert, splitPhones, isEndOfDayClave, isManualEventClave, evaluateCondition, AlertRule } from '@/lib/alerts';
import { getUserId } from '@/lib/conversations';
import { runEndOfDayMessage, runCancelacionesAnomalas, runDevolucionesAnomalas, runRetirosInusuales, runSupervisorSello } from '@/lib/system-alerts';
import { sendWhatsApp } from '@/lib/whatsapp/send';

const TZ = 'America/Monterrey';

const CONDITION_WORDS: Record<string, string> = {
    gt: 'mayor a', gte: 'mayor o igual a',
    lt: 'menor a', lte: 'menor o igual a',
    eq: 'igual a', neq: 'distinto de',
};

/** Mensaje del envío manual de una alerta de usuario: estado actual, se cumpla o no. */
function buildManualMessage(alert: AlertRule, triggered: boolean, observedValue: number | null): string {
    const val = observedValue !== null ? observedValue.toLocaleString('es-MX') : '—';
    if (alert.conditionType === 'has_rows') {
        return `🔔 *${alert.name}* (envío manual)\nAhora mismo hay ${observedValue ?? 0} registro(s) que coinciden.`;
    }
    const col = alert.targetColumn || 'el valor';
    const cond = `${col} ${CONDITION_WORDS[alert.conditionType] || alert.conditionType} ${alert.conditionValue?.toLocaleString('es-MX') ?? ''}`;
    const status = triggered
        ? `✅ La condición (${cond}) SÍ se cumple ahora.`
        : `La condición (${cond}) no se cumple todavía.`;
    return `🔔 *${alert.name}* (envío manual)\nValor actual: ${val}\n${status}`;
}

/**
 * POST /api/agent/alerts/[id]/send
 *
 * Envío MANUAL por WhatsApp a los números de ESA alerta:
 *  - Resúmenes de hora fija (resumen_dia, hallazgos_dia, resumen_cancelaciones,
 *    resumen_devoluciones): de 00:00 a 4:00 hora local (Monterrey) se envía el
 *    resumen del DÍA ANTERIOR (el día que acaba de cerrar).
 *  - Alertas creadas por el usuario: ejecuta su consulta y manda el valor
 *    actual junto con si la condición se cumple o no en este momento.
 *
 * No toca FechaUltimaEvaluacion: la evaluación automática del cron sigue su curso.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const userId = await getUserId();

        const alert = await getAlert(userId, id);
        if (!alert) {
            return NextResponse.json({ error: 'Alerta no encontrada' }, { status: 404 });
        }
        // inicio_operaciones es la única de sistema que no se puede enviar a mano
        // (se dispara sola por sucursal); las demás (resúmenes y eventos) sí.
        if (alert.clave && !isEndOfDayClave(alert.clave) && !isManualEventClave(alert.clave)) {
            return NextResponse.json(
                { error: 'Esta alerta automática se dispara sola y no se puede enviar manualmente.' },
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

        // ── Alertas de evento (atípicas/inusuales): reportan lo de HOY al momento ──
        if (isManualEventClave(alert.clave)) {
            const run =
                alert.clave === 'cancelaciones_anomalas' ? runCancelacionesAnomalas :
                alert.clave === 'devoluciones_anomalas' ? runDevolucionesAnomalas :
                alert.clave === 'retiros_inusuales' ? runRetirosInusuales :
                runSupervisorSello;
            const r = await run(userId, alert.id, recipients, { manual: true });
            return NextResponse.json({
                success: true,
                sent: r.sent,
                recipients: recipients.length,
                period: 'hoy',
                anomalias: r.anomalias,
            });
        }

        // ── Resúmenes de sistema de hora fija ──
        if (isEndOfDayClave(alert.clave)) {
            const hour = new Date(new Date().toLocaleString('en-US', { timeZone: TZ })).getHours();
            const daysAgo = hour < 4 ? 1 : 0; // 00:00–03:59 → el día que acaba de cerrar

            const r = await runEndOfDayMessage(alert.clave, userId, alert.id, recipients, daysAgo);

            return NextResponse.json({
                success: true,
                sent: r.sent,
                recipients: recipients.length,
                period: daysAgo === 1 ? 'ayer' : 'hoy',
            });
        }

        // ── Alerta creada por el usuario: estado actual de su consulta ──
        const safeSql = assertReadOnly(alert.sql);
        const results = await query(safeSql);
        const { triggered, observedValue } = evaluateCondition(
            results as any[],
            alert.conditionType,
            alert.conditionValue,
            alert.targetColumn
        );

        const text = buildManualMessage(alert, triggered, observedValue);
        let sent = 0;
        for (const phone of recipients) {
            try {
                await sendWhatsApp({ phone, text });
                sent++;
            } catch (e) {
                console.error(`manual send: fallo WhatsApp a ${phone}:`, e);
            }
        }

        return NextResponse.json({
            success: true,
            sent,
            recipients: recipients.length,
            period: 'hoy',
            triggered,
            observedValue,
        });
    } catch (error: any) {
        console.error('manual send alert error:', error);
        return NextResponse.json(
            { error: error.message || 'Error enviando la alerta' },
            { status: 500 }
        );
    }
}
