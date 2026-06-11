import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { assertReadOnly } from '@/lib/sql-sandbox';
import { substituteParams } from '@/lib/advanced-reports/params';
import { getReportById } from '@/lib/advanced-reports/reports-store';
import { listActiveSchedules, markScheduleSent, type AgentSchedule } from '@/lib/agent-schedules/schedules-store';
import { createShare } from '@/lib/whatsapp-shares/shares-store';
import { sendWhatsApp } from '@/lib/whatsapp/send';
import type { AdvancedReportDefinition } from '@/lib/advanced-reports/types';

export const runtime = 'nodejs';

/**
 * POST /api/agent/schedules/run  — cron-callable (igual que alerts/evaluate).
 *
 * Recorre los envíos activos, decide cuáles tocan en esta pasada (por hora local
 * de Monterrey + día), corre el reporte, congela un share y lo manda por WhatsApp.
 * Protegido por X-Cron-Secret (env CRON_SECRET). El cron externo (Windows Task
 * Scheduler) debe pegarlo cada hora.
 */

const CRON_SECRET = process.env.CRON_SECRET;
const TZ = 'America/Monterrey';

/** Hora/día actuales en horario de Monterrey (hack estándar con toLocaleString). */
function monterreyNow(): { hour: number; weekday: number } {
    const local = new Date(new Date().toLocaleString('en-US', { timeZone: TZ }));
    return { hour: local.getHours(), weekday: local.getDay() }; // weekday: 0=domingo
}

function isDue(s: AgentSchedule, now: { hour: number; weekday: number }): boolean {
    if (s.horaLocal !== now.hour) return false;
    if (s.frecuencia === 'weekly' && (s.diaSemana ?? 1) !== now.weekday) return false;
    // Evita doble envío si el cron corre más de una vez en la hora.
    if (s.fechaUltimoEnvio) {
        const hoursSince = (Date.now() - new Date(s.fechaUltimoEnvio).getTime()) / 36e5;
        if (hoursSince < 20) return false;
    }
    return true;
}

/** Dataset "principal" del reporte para el digest (single sql o primer bloque con SQL). */
function primaryDataset(def: AdvancedReportDefinition): { sql?: string; viz?: string } {
    if (Array.isArray(def.blocks) && def.blocks.length > 0) {
        const b = def.blocks.find((x) => x.sql && (x.type === 'chart' || x.type === 'table')) || def.blocks.find((x) => x.sql);
        return { sql: b?.sql, viz: b?.visualization };
    }
    return { sql: def.sql, viz: def.visualization };
}

export async function POST(req: Request) {
    try {
        if (CRON_SECRET) {
            const provided = req.headers.get('x-cron-secret');
            if (provided !== CRON_SECRET) {
                return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
            }
        }

        const now = monterreyNow();
        const base = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
        const all = await listActiveSchedules();
        const due = all.filter((s) => isDue(s, now));

        const summary = { total: all.length, due: due.length, sent: 0, errors: 0, details: [] as any[] };

        for (const s of due) {
            try {
                const report = await getReportById(s.idUsuario, s.idReporte);
                if (!report?.definition) {
                    summary.details.push({ id: s.idSchedule, status: 'report_not_found' });
                    summary.errors++;
                    continue;
                }
                const def = report.definition;
                const { sql, viz } = primaryDataset(def);
                if (!sql) {
                    summary.details.push({ id: s.idSchedule, status: 'no_sql' });
                    summary.errors++;
                    continue;
                }
                const finalSql = assertReadOnly(substituteParams(sql, def.params));
                const rows = (await query(finalSql)) as any[];

                const uuid = await createShare({
                    question: report.titulo,
                    answer: (def.insights?.[0] || '').replace(/\*\*/g, ''),
                    tool: 'scheduled',
                    viz: viz ?? null,
                    sql: finalSql,
                    rows: rows.slice(0, 500),
                    insights: def.insights,
                    fromPhone: s.telefono,
                });
                const link = base ? `${base}/r/${uuid}` : undefined;

                const headline = (def.insights?.[0] || 'Tu reporte programado está listo.').replace(/\*\*/g, '');
                const text = `📊 ${report.titulo}\n${headline}${link ? `\n\nVer: ${link}` : ''}`;
                const res = await sendWhatsApp({ phone: s.telefono, text, link });

                await markScheduleSent(s.idSchedule);
                summary.sent += res.ok ? 1 : 0;
                if (!res.ok) summary.errors++;
                summary.details.push({ id: s.idSchedule, status: res.ok ? 'sent' : 'send_failed', error: res.error });
            } catch (e: any) {
                console.error(`Error en envío programado ${s.idSchedule}:`, e);
                summary.errors++;
                summary.details.push({ id: s.idSchedule, status: 'error', error: e?.message });
            }
        }

        return NextResponse.json({ success: true, summary });
    } catch (error: any) {
        console.error('schedules/run error:', error);
        return NextResponse.json({ error: error?.message || 'Error en envíos programados' }, { status: 500 });
    }
}

/** GET para prueba manual desde el navegador. */
export async function GET(req: Request) {
    return POST(req);
}
