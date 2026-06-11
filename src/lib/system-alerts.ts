/**
 * Lógica de las ALERTAS DE SISTEMA (sembradas por default).
 *
 * Estas alertas NO pasan por el motor genérico (SQL + condición). El cron
 * /api/agent/alerts/evaluate las atiende por su `Clave`:
 *
 *   - inicio_operaciones → al registrar la PRIMERA venta del día en cada sucursal
 *     (revisión frecuente, dedup por sucursal+día en tblAgentInicioLog).
 *   - resumen_dia        → resumen de operaciones del día (11:00 PM).
 *   - hallazgos_dia      → hallazgos más importantes del día (11:00 PM).
 *
 * Los destinatarios salen de la columna Telefono de CADA alerta (splitPhones).
 */

import { query } from '@/lib/db';
import { anthropic, ANTHROPIC_MODEL_FAST } from '@/lib/anthropic';
import { openai } from '@/lib/ai';
import { sendWhatsApp } from '@/lib/whatsapp/send';
import { recordAlertEvent, getSystemAlertModel } from '@/lib/alerts';
import { getScannersByPriority } from '@/lib/insights-scanners';
import { getModel } from '@/lib/advanced-reports/models';
import { createShare } from '@/lib/whatsapp-shares/shares-store';

const fmtMxn = (n: number) => `$${Math.round(Number(n) || 0).toLocaleString('es-MX')}`;

/**
 * Corre el SQL "como si fuera hace N días": todo GETDATE() se desplaza.
 * Con daysAgo=1 un envío manual de madrugada reporta el día que acaba de cerrar.
 */
function shiftDays(sql: string, daysAgo: number): string {
    if (!daysAgo) return sql;
    return sql.replace(/GETDATE\(\)/g, `DATEADD(DAY, -${daysAgo}, GETDATE())`);
}

/** Fecha objetivo legible ("martes 10 de junio") para el título del reporte. */
function targetDateLabel(daysAgo: number): string {
    const d = new Date(Date.now() - daysAgo * 86400000);
    return d.toLocaleDateString('es-MX', {
        timeZone: 'America/Monterrey', weekday: 'long', day: 'numeric', month: 'long',
    });
}

/** Contenido de fin de día: versión completa (página pública) + corta (WhatsApp). */
export interface EndOfDayContent {
    title: string;
    full: string;
    short: string;
    rows: Record<string, any>[];
}

/**
 * El prompt pide ambas versiones separadas por una línea "---". Si el modelo
 * no respeta el formato, la corta se deriva truncando la completa.
 */
function splitFullShort(raw: string): { full: string; short: string } {
    const parts = raw.split(/\n\s*-{3,}\s*\n?/);
    if (parts.length >= 2 && parts[1].trim()) {
        return { full: parts[0].trim(), short: parts[1].trim() };
    }
    const full = raw.trim();
    const flat = full.replace(/\s*\n+\s*/g, ' · ');
    return { full, short: flat.length > 300 ? flat.slice(0, 297) + '…' : flat };
}

/**
 * Narración con el modelo configurado por el usuario (Claude u OpenAI).
 * Sin modelId usa el default del server (ANTHROPIC_MODEL_FAST). Si el
 * proveedor elegido falla, cae al otro proveedor; nunca lanza.
 */
async function narrate(prompt: string, maxTokens = 700, modelId?: string | null): Promise<string> {
    const chosen = modelId ? getModel(modelId) : null;
    const askAnthropic = async (model: string) => {
        const r = await anthropic.messages.create({
            model,
            max_tokens: maxTokens,
            messages: [{ role: 'user', content: prompt }],
        });
        return ((r.content[0] as any)?.text || '').trim();
    };
    const askOpenAI = async (model: string) => {
        const c = await openai.chat.completions.create({
            model,
            max_tokens: maxTokens,
            messages: [{ role: 'user', content: prompt }],
        });
        return (c.choices[0]?.message?.content || '').trim();
    };
    try {
        if (chosen?.provider === 'openai') return await askOpenAI(chosen.id);
        return await askAnthropic(chosen?.id || ANTHROPIC_MODEL_FAST);
    } catch {
        try {
            return chosen?.provider === 'openai'
                ? await askAnthropic(ANTHROPIC_MODEL_FAST)
                : await askOpenAI('gpt-4o-mini');
        } catch {
            return '';
        }
    }
}

/** Envía el mismo texto a todos los destinatarios. Devuelve cuántos salieron OK. */
async function sendToAll(recipients: string[], text: string): Promise<number> {
    let sent = 0;
    for (const phone of recipients) {
        const r = await sendWhatsApp({ phone, text }).catch(() => ({ ok: false }));
        if (r.ok) sent++;
    }
    return sent;
}

// ─── 1) Inicio de operaciones por sucursal ────────────────────────────────
export async function runInicioOperaciones(
    userId: string,
    alertId: string,
    recipients: string[]
): Promise<{ sent: number; stores: number }> {
    // Primera venta del día por sucursal.
    const rows = (await query(`
        SELECT IdTienda, MIN(Tienda) AS Tienda, MIN([Fecha Venta]) AS Primera,
               SUM(Total) AS Venta, COUNT(DISTINCT [Folio Venta]) AS Tickets
        FROM Ventas
        WHERE CAST([Fecha Venta] AS DATE) = CAST(GETDATE() AS DATE)
        GROUP BY IdTienda
    `)) as any[];
    if (!rows.length) return { sent: 0, stores: 0 };

    // Sucursales ya avisadas hoy.
    const logged = (await query(
        `SELECT IdTienda FROM tblAgentInicioLog WHERE IdUsuario = ? AND Fecha = CAST(GETDATE() AS DATE)`,
        [userId]
    )) as any[];
    const already = new Set(logged.map((r) => Number(r.IdTienda)));

    let sent = 0;
    let stores = 0;
    for (const row of rows) {
        const idt = Number(row.IdTienda);
        if (already.has(idt)) continue;

        const tienda = row.Tienda || `Sucursal ${idt}`;
        let hora = '';
        try {
            hora = new Date(row.Primera).toLocaleTimeString('es-MX', {
                hour: '2-digit', minute: '2-digit', timeZone: 'America/Monterrey',
            });
        } catch { /* noop */ }

        const text = `🟢 Inicio de operaciones\n${tienda} registró su primera venta del día${hora ? ` a las ${hora}` : ''}.`;
        sent += await sendToAll(recipients, text);

        await query(
            `INSERT INTO tblAgentInicioLog (IdUsuario, IdTienda, Fecha) VALUES (?, ?, CAST(GETDATE() AS DATE))`,
            [userId, idt]
        ).catch(() => { /* si dos pasadas chocan, la PK evita duplicado */ });

        await recordAlertEvent({
            alertId,
            userId,
            observedValue: idt,
            message: `Inicio de operaciones: ${tienda}${hora ? ` (${hora})` : ''}`,
            resultsJson: JSON.stringify(row),
        }).catch(() => { });

        stores++;
    }
    return { sent, stores };
}

// ─── 2) Resumen de operaciones del día ─────────────────────────────────────
export async function generateResumenDia(daysAgo = 0, modelId?: string | null): Promise<EndOfDayContent> {
    const totRows = (await query(shiftDays(`
        SELECT SUM(Total) AS Venta, COUNT(DISTINCT [Folio Venta]) AS Tickets,
               COUNT(DISTINCT IdTienda) AS Sucursales
        FROM Ventas WHERE CAST([Fecha Venta] AS DATE) = CAST(GETDATE() AS DATE)
    `, daysAgo))) as any[];
    const tot = totRows[0] || {};

    const porTienda = (await query(shiftDays(`
        SELECT TOP 30 Tienda, SUM(Total) AS Venta, COUNT(DISTINCT [Folio Venta]) AS Tickets
        FROM Ventas WHERE CAST([Fecha Venta] AS DATE) = CAST(GETDATE() AS DATE)
        GROUP BY Tienda ORDER BY Venta DESC
    `, daysAgo))) as any[];

    const cancRows = (await query(shiftDays(`
        SELECT SUM(Total) AS Monto, COUNT(*) AS Num FROM Cancelaciones
        WHERE CAST([Fecha Cancelacion] AS DATE) = CAST(GETDATE() AS DATE)
    `, daysAgo))) as any[];
    const canc = cancRows[0] || {};

    const retRows = (await query(shiftDays(`
        SELECT SUM(Monto) AS Monto, COUNT(*) AS Num FROM Retiros
        WHERE CAST([Fecha Retiro] AS DATE) = CAST(GETDATE() AS DATE)
    `, daysAgo))) as any[];
    const ret = retRows[0] || {};

    const ventaTotal = Number(tot.Venta) || 0;
    const tickets = Number(tot.Tickets) || 0;
    const ticketProm = tickets > 0 ? ventaTotal / tickets : 0;

    const topTiendas = porTienda
        .slice(0, 8)
        .map((t) => `${t.Tienda}: ${fmtMxn(t.Venta)} (${Number(t.Tickets) || 0} tickets)`)
        .join('\n');

    const datos = `Venta total del día: ${fmtMxn(ventaTotal)}
Tickets (clientes): ${tickets.toLocaleString('es-MX')}
Ticket promedio: ${fmtMxn(ticketProm)}
Sucursales con venta: ${Number(tot.Sucursales) || 0}
Cancelaciones: ${Number(canc.Num) || 0} por ${fmtMxn(canc.Monto || 0)}
Retiros: ${Number(ret.Num) || 0} por ${fmtMxn(ret.Monto || 0)}

Venta por sucursal:
${topTiendas || 'Sin ventas registradas.'}`;

    const dayHeader = daysAgo === 1 ? '📊 Resumen del día (ayer)' : '📊 Resumen del día';
    const dayDesc = daysAgo === 1 ? 'del DÍA ANTERIOR (ayer)' : 'del día';
    const title = `Resumen de operaciones — ${targetDateLabel(daysAgo)}`;

    const prompt = `Eres Kesito, analista de KYK retail. Redacta un RESUMEN DE OPERACIONES ${dayDesc} para
el dueño. Datos reales:

${datos}

Devuelve DOS versiones separadas por una línea que contenga solo "---":

VERSIÓN COMPLETA (para la página del reporte):
- Empieza con "${dayHeader}".
- 4-8 líneas, claro y directo, texto plano (sin markdown ni tablas).
- Cifras en pesos con coma de miles ($14,820).
- Menciona la venta total, tickets, ticket promedio, y las 2-3 sucursales que más vendieron.
- Si hubo cancelaciones o retiros notables, dilo en una línea.
- Tono profesional pero cercano (tutea).

---

VERSIÓN CORTA (notificación de WhatsApp):
- UNA sola línea, SIN saltos de línea, máximo 300 caracteres.
- Empieza con "${dayHeader}:" y menciona venta total, tickets y la sucursal que más vendió.

Devuelve SOLO los dos bloques separados por "---", sin comillas ni prefijos.`;

    const raw = await narrate(prompt, 900, modelId);
    const fallbackFull = `${dayHeader}\nVenta total: ${fmtMxn(ventaTotal)} en ${tickets.toLocaleString('es-MX')} tickets (ticket prom. ${fmtMxn(ticketProm)}).\nCancelaciones: ${fmtMxn(canc.Monto || 0)} · Retiros: ${fmtMxn(ret.Monto || 0)}.`;
    const fallbackShort = `${dayHeader}: venta ${fmtMxn(ventaTotal)} en ${tickets.toLocaleString('es-MX')} tickets (prom. ${fmtMxn(ticketProm)}). Cancelaciones ${fmtMxn(canc.Monto || 0)}, retiros ${fmtMxn(ret.Monto || 0)}.`;
    const { full, short } = raw ? splitFullShort(raw) : { full: fallbackFull, short: fallbackShort };
    return { title, full, short, rows: porTienda };
}

// ─── 3) Hallazgos más importantes del día ──────────────────────────────────
export async function generateHallazgosDia(daysAgo = 0, modelId?: string | null): Promise<EndOfDayContent> {
    // Reutilizamos los "scanners" de hallazgos del dashboard (mismos que daily-insights).
    const scanners = getScannersByPriority([]).slice(0, 8);
    const results: Array<{ area: string; label: string; data: any[] }> = [];
    for (const s of scanners) {
        try {
            const data = (await query(shiftDays(s.sql, daysAgo))) as any[];
            if (Array.isArray(data) && data.length) {
                results.push({ area: s.area, label: s.label, data: data.slice(0, 5) });
            }
        } catch { /* un scanner que falle no detiene los demás */ }
    }

    const dayHeader = daysAgo === 1 ? '🔎 Hallazgos del día (ayer)' : '🔎 Hallazgos del día';
    const title = `Hallazgos del día — ${targetDateLabel(daysAgo)}`;
    if (!results.length) {
        const nada = `${dayHeader}\nNo detecté señales relevantes${daysAgo === 1 ? ' ayer' : ' hoy'}.`;
        return { title, full: nada, short: nada.replace('\n', ': '), rows: [] };
    }

    const dataDesc = results
        .map((r) => `[${r.area.toUpperCase()}] ${r.label}\n${JSON.stringify(r.data)}`)
        .join('\n\n');

    const prompt = `Eres Kesito, analista senior de KYK retail. A partir de estos datos ${daysAgo === 1 ? 'del DÍA ANTERIOR (ayer)' : 'del día'}, redacta los
HALLAZGOS MÁS IMPORTANTES para el dueño.

DATOS:
${dataDesc}

Devuelve DOS versiones separadas por una línea que contenga solo "---":

VERSIÓN COMPLETA (para la página del reporte):
- Empieza con "${dayHeader}".
- 3 a 5 hallazgos, uno por línea, cada uno con un emoji al inicio (🔴 crítico, 🟡 atención, 🟢 oportunidad).
- Cada hallazgo: una frase concreta con la cifra/dato que lo respalda.
- Prioriza lo crítico (caídas, cancelaciones anómalas, sucursales en problemas) antes que oportunidades.
- Texto plano, sin markdown ni tablas. Cifras en pesos con coma de miles.
- Tono directo y útil (tutea).

---

VERSIÓN CORTA (notificación de WhatsApp):
- UNA sola línea, SIN saltos de línea, máximo 300 caracteres.
- Empieza con "${dayHeader}:" y resume los 2 hallazgos más críticos con su cifra.

Devuelve SOLO los dos bloques separados por "---", sin comillas ni prefijos.`;

    const raw = await narrate(prompt, 1000, modelId);
    if (!raw) {
        const err = `${dayHeader}\nNo pude generar los hallazgos en este momento.`;
        return { title, full: err, short: err.replace('\n', ': '), rows: [] };
    }
    const { full, short } = splitFullShort(raw);
    return { title, full, short, rows: [] };
}

/**
 * Envía resumen o hallazgos a los destinatarios y registra el evento.
 * daysAgo=1 reporta el día anterior (envío manual de madrugada).
 * El envío manual NO toca FechaUltimaEvaluacion para no suprimir el envío
 * automático de las 11 PM (el cron hace su propio UPDATE aparte).
 */
export async function runEndOfDayMessage(
    clave: 'resumen_dia' | 'hallazgos_dia',
    userId: string,
    alertId: string,
    recipients: string[],
    daysAgo = 0
): Promise<{ sent: number }> {
    const modelId = await getSystemAlertModel(userId).catch(() => null);
    const gen = clave === 'resumen_dia'
        ? await generateResumenDia(daysAgo, modelId)
        : await generateHallazgosDia(daysAgo, modelId);

    // Liga pública para profundizar: congela la versión completa + datos como
    // snapshot /r/<uuid> (mismo sistema de shares del chat de WhatsApp).
    let link = '';
    try {
        const base = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
        if (base) {
            const uuid = await createShare({
                question: gen.title,
                answer: gen.full,
                tool: clave,
                viz: gen.rows.length ? 'bar' : null,
                rows: gen.rows,
                tenantId: userId,
            });
            link = ` Ver detalle: ${base}/r/${uuid}`;
        }
    } catch { /* sin liga, la notificación corta sale igual */ }

    // Axon limita `message` a 800 caracteres: corto (≤700) + liga (~60).
    const text = gen.short.slice(0, 700) + link;
    const sent = await sendToAll(recipients, text);
    await recordAlertEvent({
        alertId,
        userId,
        observedValue: null,
        message: gen.short.slice(0, 490) || (clave === 'resumen_dia' ? 'Resumen del día' : 'Hallazgos del día'),
        resultsJson: JSON.stringify({ clave, recipients: recipients.length, daysAgo }),
        touchLastEvaluation: false,
    }).catch(() => { });
    return { sent };
}
