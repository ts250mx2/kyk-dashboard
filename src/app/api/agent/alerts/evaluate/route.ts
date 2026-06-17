import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { assertReadOnly } from '@/lib/sql-sandbox';
import {
    ensureAlertTables,
    evaluateCondition,
    recordAlertEvent,
    splitPhones,
    normalizeHora,
    isEndOfDayClave,
    END_OF_DAY_TIMES,
    AlertRule
} from '@/lib/alerts';
import { runInicioOperaciones, runEndOfDayMessage, runCancelacionesAnomalas } from '@/lib/system-alerts';
import { sendWhatsApp } from '@/lib/whatsapp/send';

const TZ = 'America/Monterrey';
/** Hora local (minutos del día) + clave de fecha (YYYY-M-D) en Monterrey. */
function monterreyParts(d: Date = new Date()): { minutesOfDay: number; dateKey: string } {
    const local = new Date(d.toLocaleString('en-US', { timeZone: TZ }));
    return {
        minutesOfDay: local.getHours() * 60 + local.getMinutes(),
        dateKey: `${local.getFullYear()}-${local.getMonth()}-${local.getDate()}`,
    };
}
/**
 * Las alertas de hora fija tocan en la PRIMERA pasada del cron a partir de su
 * hora (HoraEnvio editable; default END_OF_DAY_TIMES), una vez por día. Si el
 * cron estuvo caído, alcanzan a salir en cuanto regrese (mismo día).
 */
function isEndOfDayDue(rule: AlertRule, now: { minutesOfDay: number; dateKey: string }): boolean {
    if (!isEndOfDayClave(rule.clave)) return false;
    const hora = normalizeHora(rule.horaEnvio) || END_OF_DAY_TIMES[rule.clave];
    const [h, m] = hora.split(':').map(Number);
    if (now.minutesOfDay < h * 60 + m) return false;
    if (!rule.lastEvaluatedAt) return true;
    return monterreyParts(new Date(rule.lastEvaluatedAt)).dateKey !== now.dateKey;
}

/**
 * POST /api/agent/alerts/evaluate
 *
 * Endpoint cron-callable. Recorre todas las alertas activas, evalúa cada una
 * contra el estado actual de los datos, y registra eventos cuando se disparan.
 *
 * Frecuencia: el cron externo (Windows Task Scheduler, crontab, etc.) debe
 * llamarlo cada 5 minutos. La lógica de frequency de cada regla decide si
 * realmente se evalúa en esa pasada (5min siempre, hourly si pasó >1h, daily
 * solo si pasó >20h desde la última, weekly solo si pasó >6 días).
 *
 * Seguridad: protegido por header X-Cron-Secret (env var CRON_SECRET).
 * Si no está configurado, acepta cualquier llamada (modo desarrollo).
 */

const CRON_SECRET = process.env.CRON_SECRET;

function shouldEvaluateNow(rule: AlertRule): boolean {
    if (!rule.active) return false;
    if (!rule.lastEvaluatedAt) return true;
    const lastMs = new Date(rule.lastEvaluatedAt).getTime();
    const hoursSince = (Date.now() - lastMs) / (1000 * 60 * 60);
    switch (rule.frequency) {
        // 4 min y no 5: tolera el jitter del cron para no saltarse pasadas.
        case '5min': return hoursSince >= 4 / 60;
        case 'hourly': return hoursSince >= 1;
        case 'daily': return hoursSince >= 20;
        case 'weekly': return hoursSince >= 24 * 6;
    }
}

function buildMessage(rule: AlertRule, observedValue: number | null): string {
    const val = observedValue !== null ? observedValue.toLocaleString('es-MX') : 'sin valor';
    const condLabel: Record<string, string> = {
        gt: 'mayor a', gte: 'mayor o igual a',
        lt: 'menor a', lte: 'menor o igual a',
        eq: 'igual a', neq: 'distinto de', has_rows: 'con registros'
    };
    if (rule.conditionType === 'has_rows') {
        return `"${rule.name}" detectó ${val} registros`;
    }
    return `"${rule.name}" se disparó: valor ${val} es ${condLabel[rule.conditionType]} ${rule.conditionValue}`;
}

export async function POST(req: Request) {
    try {
        // Verificación de secret si está configurado
        if (CRON_SECRET) {
            const provided = req.headers.get('x-cron-secret');
            if (provided !== CRON_SECRET) {
                return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
            }
        }

        await ensureAlertTables();

        // Trae todas las alertas activas de todos los usuarios
        const rows = await query(
            `SELECT * FROM tblAgentAlertas WHERE Activa = 1`
        );

        const allRules = (rows as any[]).map(r => ({
            id: r.IdAlerta,
            userId: r.IdUsuario,
            name: r.Nombre,
            description: r.Descripcion,
            sql: r.SqlConsulta,
            conditionType: r.CondicionTipo,
            conditionValue: r.CondicionValor,
            targetColumn: r.ColumnaObjetivo,
            frequency: r.Frecuencia,
            active: !!r.Activa,
            telefono: r.Telefono ?? null,
            clave: r.Clave ?? null,
            horaEnvio: r.HoraEnvio ?? null,
            createdAt: r.FechaCreacion?.toISOString?.() || String(r.FechaCreacion),
            lastEvaluatedAt: r.FechaUltimaEvaluacion
                ? (r.FechaUltimaEvaluacion?.toISOString?.() || String(r.FechaUltimaEvaluacion))
                : null
        })) as AlertRule[];

        const pending = allRules.filter(shouldEvaluateNow);

        const summary = {
            total: allRules.length,
            evaluated: 0,
            triggered: 0,
            errors: 0,
            details: [] as Array<{ id: string; name: string; status: string; observedValue?: number | null }>
        };

        const now = monterreyParts();

        for (const rule of pending) {
            try {
                // ── Alertas de SISTEMA: atendidas por su clave, no por SQL/condición ──
                if (rule.clave) {
                    // Destinatarios POR ALERTA (columna Telefono).
                    const recipients = splitPhones(rule.telefono);
                    if (recipients.length === 0) {
                        summary.details.push({ id: rule.id, name: rule.name, status: 'sin_destinatarios' });
                        continue;
                    }
                    if (rule.clave === 'inicio_operaciones') {
                        const r = await runInicioOperaciones(rule.userId, rule.id, recipients);
                        await query(`UPDATE tblAgentAlertas SET FechaUltimaEvaluacion = GETDATE() WHERE IdAlerta = ?`, [rule.id]);
                        summary.evaluated++;
                        if (r.stores > 0) summary.triggered++;
                        summary.details.push({ id: rule.id, name: rule.name, status: r.stores > 0 ? `inicio: ${r.stores} suc / ${r.sent} envíos` : 'inicio: sin nuevas' });
                    } else if (rule.clave === 'cancelaciones_anomalas') {
                        const r = await runCancelacionesAnomalas(rule.userId, rule.id, recipients);
                        await query(`UPDATE tblAgentAlertas SET FechaUltimaEvaluacion = GETDATE() WHERE IdAlerta = ?`, [rule.id]);
                        summary.evaluated++;
                        if (r.anomalias > 0) summary.triggered++;
                        summary.details.push({ id: rule.id, name: rule.name, status: r.anomalias > 0 ? `cancelaciones: ${r.anomalias} atípicas / ${r.sent} envíos` : 'cancelaciones: sin atípicas' });
                    } else if (isEndOfDayClave(rule.clave)) {
                        if (!isEndOfDayDue(rule, now)) {
                            summary.details.push({ id: rule.id, name: rule.name, status: 'fin_dia: no toca' });
                            continue;
                        }
                        const r = await runEndOfDayMessage(rule.clave, rule.userId, rule.id, recipients, 0, true);
                        await query(`UPDATE tblAgentAlertas SET FechaUltimaEvaluacion = GETDATE() WHERE IdAlerta = ?`, [rule.id]);
                        summary.evaluated++;
                        summary.triggered++;
                        summary.details.push({ id: rule.id, name: rule.name, status: `fin_dia: ${r.sent} envíos` });
                    }
                    continue;
                }

                // Sandbox: doble defensa por si alguien metió SQL malicioso en la BD
                const safeSql = assertReadOnly(rule.sql);
                console.log(`\n\x1b[33m[AGENT SQL - EVALUACIÓN ALERTA: ${rule.name.toUpperCase()}]\x1b[0m\n${safeSql}\n`);
                const results = await query(safeSql);

                const { triggered, observedValue } = evaluateCondition(
                    results as any[],
                    rule.conditionType,
                    rule.conditionValue,
                    rule.targetColumn
                );

                summary.evaluated++;

                if (triggered) {
                    const message = buildMessage(rule, observedValue);
                    await recordAlertEvent({
                        alertId: rule.id,
                        userId: rule.userId,
                        observedValue,
                        message,
                        resultsJson: JSON.stringify(((results as any[]).slice(0, 5)))
                    });
                    // Push proactivo: avisa por WhatsApp a cada número configurado.
                    // dedupe: no repetir el mismo aviso al mismo número si el cron re-dispara.
                    for (const phone of splitPhones(rule.telefono)) {
                        await sendWhatsApp({ phone, text: `🔔 Alerta: ${message}`, dedupe: true }).catch(() => { /* no bloquea la evaluación */ });
                    }
                    summary.triggered++;
                    summary.details.push({ id: rule.id, name: rule.name, status: 'triggered', observedValue });
                } else {
                    // Actualizar FechaUltimaEvaluacion aunque no se haya disparado
                    await query(
                        `UPDATE tblAgentAlertas SET FechaUltimaEvaluacion = GETDATE() WHERE IdAlerta = ?`,
                        [rule.id]
                    );
                    summary.details.push({ id: rule.id, name: rule.name, status: 'ok', observedValue });
                }
            } catch (e: any) {
                console.error(`Error evaluando alerta ${rule.id}:`, e);
                summary.errors++;
                summary.details.push({ id: rule.id, name: rule.name, status: 'error' });
            }
        }

        return NextResponse.json({ success: true, summary });
    } catch (error: any) {
        console.error('evaluate alerts error:', error);
        return NextResponse.json(
            { error: error.message || 'Error en evaluación de alertas' },
            { status: 500 }
        );
    }
}

/** GET para testing manual desde el navegador */
export async function GET(req: Request) {
    return POST(req);
}
