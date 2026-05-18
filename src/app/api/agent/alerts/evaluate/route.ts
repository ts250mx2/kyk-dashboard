import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { assertReadOnly } from '@/lib/sql-sandbox';
import {
    ensureAlertTables,
    evaluateCondition,
    recordAlertEvent,
    AlertRule
} from '@/lib/alerts';

/**
 * POST /api/agent/alerts/evaluate
 *
 * Endpoint cron-callable. Recorre todas las alertas activas, evalúa cada una
 * contra el estado actual de los datos, y registra eventos cuando se disparan.
 *
 * Frecuencia: el cron externo (Windows Task Scheduler, Cron de Vercel, etc.)
 * debe llamarlo cada hora. La lógica de frequency de cada regla decide si
 * realmente se evalúa en esa pasada (hourly siempre, daily solo si pasó >20h
 * desde la última, weekly solo si pasó >6 días).
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

        for (const rule of pending) {
            try {
                // Sandbox: doble defensa por si alguien metió SQL malicioso en la BD
                const safeSql = assertReadOnly(rule.sql);
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
