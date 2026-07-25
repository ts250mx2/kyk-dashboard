/**
 * Lógica de las ALERTAS DE SISTEMA (sembradas por default).
 *
 * Estas alertas NO pasan por el motor genérico (SQL + condición). El cron
 * /api/agent/alerts/evaluate las atiende por su `Clave`:
 *
 *   - inicio_operaciones     → al registrar la PRIMERA venta del día en cada sucursal
 *     (revisión frecuente, dedup por sucursal+día en tblAgentInicioLog).
 *   - resumen_dia            → resumen de operaciones del día (11:00 PM).
 *   - hallazgos_dia          → hallazgos más importantes del día (11:00 PM).
 *   - resumen_cancelaciones  → resumen de cancelaciones del día (7:00 PM).
 *   - resumen_devoluciones   → resumen de devoluciones de venta del día (7:30 PM).
 *
 * Los destinatarios salen de la columna Telefono de CADA alerta (splitPhones).
 */

import { query, localizeDatesForModel } from '@/lib/db';
import { mysqlQuery } from '@/lib/mysql';
import { anthropic, ANTHROPIC_MODEL_FAST } from '@/lib/anthropic';
import { openai } from '@/lib/ai';
import { sendWhatsApp, SendWhatsAppResult } from '@/lib/whatsapp/send';
import { recordAlertEvent, getSystemAlertModel, EndOfDayClave } from '@/lib/alerts';
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

/**
 * Envía el mismo texto a todos los destinatarios. Devuelve cuántos SALIERON
 * (los duplicados suprimidos por dedup no cuentan). Con `dedupe` (envíos del
 * cron) no reenvía un texto idéntico al mismo número dentro de la ventana.
 */
async function sendToAll(recipients: string[], text: string, dedupe = false, dedupeKey?: string): Promise<number> {
    let sent = 0;
    for (const phone of recipients) {
        const r: SendWhatsAppResult = await sendWhatsApp({ phone, text, dedupe, dedupeKey }).catch(() => ({ ok: false }));
        if (r.ok && !r.skipped) sent++;
    }
    return sent;
}

/** Fecha local de Monterrey 'YYYY-MM-DD' para claves de dedup estables por día. */
function monterreyDateKey(): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Monterrey' });
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
        sent += await sendToAll(recipients, text, true); // cron: dedup activado

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
        .map((r) => `[${r.area.toUpperCase()}] ${r.label}\n${JSON.stringify(localizeDatesForModel(r.data))}`)
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

// ─── 4) Resumen de cancelaciones del día ───────────────────────────────────
export async function generateResumenCancelaciones(daysAgo = 0, modelId?: string | null): Promise<EndOfDayContent> {
    const totRows = (await query(shiftDays(`
        SELECT SUM(Total) AS Monto, COUNT(*) AS Num, COUNT(DISTINCT IdTienda) AS Sucursales
        FROM Cancelaciones WHERE CAST([Fecha Cancelacion] AS DATE) = CAST(GETDATE() AS DATE)
    `, daysAgo))) as any[];
    const tot = totRows[0] || {};

    const porTienda = (await query(shiftDays(`
        SELECT TOP 30 Tienda, SUM(Total) AS Monto, COUNT(*) AS Cancelaciones
        FROM Cancelaciones WHERE CAST([Fecha Cancelacion] AS DATE) = CAST(GETDATE() AS DATE)
        GROUP BY Tienda ORDER BY Monto DESC
    `, daysAgo))) as any[];

    const top = (await query(shiftDays(`
        SELECT TOP 8 Tienda, Descripcion, Cantidad, Total, Supervisor, Cajero
        FROM Cancelaciones WHERE CAST([Fecha Cancelacion] AS DATE) = CAST(GETDATE() AS DATE)
        ORDER BY Total DESC
    `, daysAgo))) as any[];

    const dayHeader = daysAgo === 1 ? '🚫 Cancelaciones del día (ayer)' : '🚫 Cancelaciones del día';
    const title = `Resumen de cancelaciones — ${targetDateLabel(daysAgo)}`;
    const monto = Number(tot.Monto) || 0;
    const num = Number(tot.Num) || 0;

    if (num === 0) {
        const nada = `${dayHeader}\nSin cancelaciones registradas${daysAgo === 1 ? ' ayer' : ' hoy'} 🎉`;
        return { title, full: nada, short: nada.replace('\n', ': '), rows: [] };
    }

    const datos = `Total cancelado: ${fmtMxn(monto)} en ${num} cancelación(es), ${Number(tot.Sucursales) || 0} sucursal(es).

Por sucursal:
${porTienda.map((t) => `${t.Tienda}: ${fmtMxn(t.Monto)} (${Number(t.Cancelaciones) || 0})`).join('\n')}

Cancelaciones más grandes:
${top.map((c) => `${c.Tienda} · ${c.Descripcion} x${Number(c.Cantidad) || 0} · ${fmtMxn(c.Total)} · supervisor ${c.Supervisor || '—'} / cajero ${c.Cajero || '—'}`).join('\n')}`;

    const prompt = `Eres Kesito, analista de KYK retail. Redacta un RESUMEN DE CANCELACIONES ${daysAgo === 1 ? 'del DÍA ANTERIOR (ayer)' : 'del día'} para el dueño. Datos reales:

${datos}

Devuelve DOS versiones separadas por una línea que contenga solo "---":

VERSIÓN COMPLETA (para la página del reporte):
- Empieza con "${dayHeader}".
- 4-8 líneas, texto plano (sin markdown ni tablas). Cifras en pesos con coma de miles.
- Menciona el total cancelado, número de cancelaciones, las 2-3 sucursales con más monto
  y la cancelación más grande (producto, monto y quién la autorizó).
- Si algo se ve anómalo (montos altos, mismo supervisor repetido), señálalo en una línea.
- Tono directo (tutea).

---

VERSIÓN CORTA (notificación de WhatsApp):
- UNA sola línea, SIN saltos de línea, máximo 300 caracteres.
- Empieza con "${dayHeader}:" y menciona total, número y la sucursal con más cancelaciones.

Devuelve SOLO los dos bloques separados por "---", sin comillas ni prefijos.`;

    const raw = await narrate(prompt, 900, modelId);
    const fallbackFull = `${dayHeader}\nTotal cancelado: ${fmtMxn(monto)} en ${num} cancelación(es).\nSucursal con más monto: ${porTienda[0]?.Tienda || '—'} (${fmtMxn(porTienda[0]?.Monto || 0)}).`;
    const fallbackShort = `${dayHeader}: ${fmtMxn(monto)} en ${num} cancelación(es). Lidera ${porTienda[0]?.Tienda || '—'} con ${fmtMxn(porTienda[0]?.Monto || 0)}.`;
    const { full, short } = raw ? splitFullShort(raw) : { full: fallbackFull, short: fallbackShort };
    return { title, full, short, rows: porTienda };
}

// ─── 5) Resumen de devoluciones de venta del día ───────────────────────────
export async function generateResumenDevoluciones(daysAgo = 0, modelId?: string | null): Promise<EndOfDayContent> {
    const totRows = (await query(shiftDays(`
        SELECT SUM(Valor) AS Monto, COUNT(*) AS Num, COUNT(DISTINCT IdTienda) AS Sucursales
        FROM tblDevolucionesVenta WHERE CAST(FechaDevolucionVenta AS DATE) = CAST(GETDATE() AS DATE)
    `, daysAgo))) as any[];
    const tot = totRows[0] || {};

    const porTienda = (await query(shiftDays(`
        SELECT TOP 30 ISNULL(T.Tienda, 'Sin tienda') AS Tienda, SUM(A.Valor) AS Monto, COUNT(*) AS Devoluciones
        FROM tblDevolucionesVenta A
        LEFT JOIN tblTiendas T ON A.IdTienda = T.IdTienda
        WHERE CAST(A.FechaDevolucionVenta AS DATE) = CAST(GETDATE() AS DATE)
        GROUP BY T.Tienda ORDER BY Monto DESC
    `, daysAgo))) as any[];

    const top = (await query(shiftDays(`
        SELECT TOP 8 ISNULL(T.Tienda, 'Sin tienda') AS Tienda, A.Valor, A.Cliente, A.Concepto, B.Usuario AS Supervisor
        FROM tblDevolucionesVenta A
        INNER JOIN tblUsuarios B ON A.IdUsuario = B.IdUsuario
        LEFT JOIN tblTiendas T ON A.IdTienda = T.IdTienda
        WHERE CAST(A.FechaDevolucionVenta AS DATE) = CAST(GETDATE() AS DATE)
        ORDER BY A.Valor DESC
    `, daysAgo))) as any[];

    const dayHeader = daysAgo === 1 ? '↩️ Devoluciones del día (ayer)' : '↩️ Devoluciones del día';
    const title = `Resumen de devoluciones de venta — ${targetDateLabel(daysAgo)}`;
    const monto = Number(tot.Monto) || 0;
    const num = Number(tot.Num) || 0;

    if (num === 0) {
        const nada = `${dayHeader}\nSin devoluciones de venta registradas${daysAgo === 1 ? ' ayer' : ' hoy'} 🎉`;
        return { title, full: nada, short: nada.replace('\n', ': '), rows: [] };
    }

    const datos = `Total devuelto: ${fmtMxn(monto)} en ${num} devolución(es), ${Number(tot.Sucursales) || 0} sucursal(es).

Por sucursal:
${porTienda.map((t) => `${t.Tienda}: ${fmtMxn(t.Monto)} (${Number(t.Devoluciones) || 0})`).join('\n')}

Devoluciones más grandes:
${top.map((d) => `${d.Tienda} · ${fmtMxn(d.Valor)} · cliente ${d.Cliente || '—'} · motivo: ${d.Concepto || '—'} · autorizó ${d.Supervisor || '—'}`).join('\n')}`;

    const prompt = `Eres Kesito, analista de KYK retail. Redacta un RESUMEN DE DEVOLUCIONES DE VENTA ${daysAgo === 1 ? 'del DÍA ANTERIOR (ayer)' : 'del día'} para el dueño. Datos reales:

${datos}

Devuelve DOS versiones separadas por una línea que contenga solo "---":

VERSIÓN COMPLETA (para la página del reporte):
- Empieza con "${dayHeader}".
- 4-8 líneas, texto plano (sin markdown ni tablas). Cifras en pesos con coma de miles.
- Menciona el total devuelto, número de devoluciones, las sucursales con más monto
  y la devolución más grande (monto, motivo y quién la autorizó).
- Si algo se ve anómalo (montos altos, motivos repetidos, mismo autorizador), señálalo en una línea.
- Tono directo (tutea).

---

VERSIÓN CORTA (notificación de WhatsApp):
- UNA sola línea, SIN saltos de línea, máximo 300 caracteres.
- Empieza con "${dayHeader}:" y menciona total, número y la sucursal con más devoluciones.

Devuelve SOLO los dos bloques separados por "---", sin comillas ni prefijos.`;

    const raw = await narrate(prompt, 900, modelId);
    const fallbackFull = `${dayHeader}\nTotal devuelto: ${fmtMxn(monto)} en ${num} devolución(es).\nSucursal con más monto: ${porTienda[0]?.Tienda || '—'} (${fmtMxn(porTienda[0]?.Monto || 0)}).`;
    const fallbackShort = `${dayHeader}: ${fmtMxn(monto)} en ${num} devolución(es). Lidera ${porTienda[0]?.Tienda || '—'} con ${fmtMxn(porTienda[0]?.Monto || 0)}.`;
    const { full, short } = raw ? splitFullShort(raw) : { full: fallbackFull, short: fallbackShort };
    return { title, full, short, rows: porTienda };
}

// ─── 6) Productos con baja de ventas (últimos 30 días vs últimos 30 días año pasado)
export async function generateProductosBajasVentas(userId: string = '', daysAgo = 0, modelId?: string | null): Promise<EndOfDayContent> {
    const today = new Date();
    today.setDate(today.getDate() - daysAgo);
    const year = today.getFullYear();
    const lastYear = year - 1;
    const month = today.getMonth() + 1;
    const day = today.getDate();

    // Pareto 80%: últimos 90 días de venta (para tener universo robusto)
    const hace90 = new Date(today);
    hace90.setDate(hace90.getDate() - 90);
    const paretoStart = `${hace90.getFullYear()}-${String(hace90.getMonth() + 1).padStart(2, '0')}-${String(hace90.getDate()).padStart(2, '0')}`;
    const paretoEnd = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    console.log(`[PRODUCTOS_BAJA] Pareto últimos 90 días: ${paretoStart} a ${paretoEnd}`);

    // Pareto 80% POR SUCURSAL
    const paretoRows = (await query(`
        WITH ParetoCalc AS (
            SELECT Tienda, Descripcion,
                   SUM(Cantidad * [Precio Venta]) AS Venta,
                   SUM(SUM(Cantidad * [Precio Venta])) OVER (PARTITION BY Tienda) AS TotalTienda,
                   SUM(SUM(Cantidad * [Precio Venta])) OVER (PARTITION BY Tienda ORDER BY SUM(Cantidad * [Precio Venta]) DESC
                       ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS AcumuladoTienda
            FROM Ventas
            WHERE CAST([Fecha Venta] AS DATE) >= CAST(? AS DATE)
              AND CAST([Fecha Venta] AS DATE) <= CAST(? AS DATE)
            GROUP BY Tienda, Descripcion
        )
        SELECT Tienda, Descripcion, CAST(100.0 * AcumuladoTienda / NULLIF(TotalTienda, 0) AS NUMERIC(5,2)) AS PctAcum
        FROM ParetoCalc WHERE CAST(100.0 * AcumuladoTienda / NULLIF(TotalTienda, 0) AS NUMERIC(5,2)) <= 80
        ORDER BY Tienda, AcumuladoTienda DESC
    `, [paretoStart, paretoEnd])) as any[];

    const productosPareto = new Set<string>();
    const paretoByTienda = new Map<string, Set<string>>();

    for (const row of paretoRows) {
        productosPareto.add(row.Descripcion);
        if (!paretoByTienda.has(row.Tienda)) {
            paretoByTienda.set(row.Tienda, new Set());
        }
        paretoByTienda.get(row.Tienda)!.add(row.Descripcion);
    }

    console.log(`[PRODUCTOS_BAJA] Sucursales con Pareto: ${paretoByTienda.size}`);
    console.log(`[PRODUCTOS_BAJA] Productos únicos en Pareto 80%: ${productosPareto.size}`);

    if (productosPareto.size === 0) {
        const title = `Análisis de productos con baja de ventas — ${targetDateLabel(daysAgo)}`;
        return { title, full: '📉 Sin datos.', short: '📉 Sin datos.', rows: [] };
    }

    // Últimos 30 días: ESTE AÑO vs AÑO PASADO (misma época)
    const hace30 = new Date(today);
    hace30.setDate(hace30.getDate() - 30);
    const hace30AñoPasado = new Date(hace30);
    hace30AñoPasado.setFullYear(lastYear);

    const periodEsteAñoStart = `${hace30.getFullYear()}-${String(hace30.getMonth() + 1).padStart(2, '0')}-${String(hace30.getDate()).padStart(2, '0')}`;
    const periodEsteAñoEnd = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const periodAñoPasadoStart = `${lastYear}-${String(hace30AñoPasado.getMonth() + 1).padStart(2, '0')}-${String(hace30AñoPasado.getDate()).padStart(2, '0')}`;
    const periodAñoPasadoEnd = `${lastYear}-${String(hace30AñoPasado.getMonth() + 1 + (hace30AñoPasado.getDate() < day ? 1 : 0)).padStart(2, '0')}-${String(Math.min(hace30AñoPasado.getDate() + (day - hace30.getDate()), 28)).padStart(2, '0')}`;

    console.log(`[PRODUCTOS_BAJA] Período Este Año: ${periodEsteAñoStart} a ${periodEsteAñoEnd}`);
    console.log(`[PRODUCTOS_BAJA] Período Año Pasado: ${periodAñoPasadoStart} a ${periodAñoPasadoEnd}`);

    const clausulaProductos = Array.from(productosPareto).map(p => `'${p.replace(/'/g, "''")}'`).join(',');

    // Comparación: CANTIDAD (no dinero). Solo Pareto 80% de cada sucursal
    const allComparisons = (await query(`
        WITH EsteAño AS (
            SELECT Tienda, Descripcion, SUM(CAST(Cantidad AS INT)) AS Cantidad
            FROM Ventas
            WHERE CAST([Fecha Venta] AS DATE) >= CAST(? AS DATE)
              AND CAST([Fecha Venta] AS DATE) <= CAST(? AS DATE)
              AND Descripcion IN (${clausulaProductos})
            GROUP BY Tienda, Descripcion
        ),
        AñoPasado AS (
            SELECT Tienda, Descripcion, SUM(CAST(Cantidad AS INT)) AS Cantidad
            FROM Ventas
            WHERE CAST([Fecha Venta] AS DATE) >= CAST(? AS DATE)
              AND CAST([Fecha Venta] AS DATE) <= CAST(? AS DATE)
              AND Descripcion IN (${clausulaProductos})
            GROUP BY Tienda, Descripcion
        )
        SELECT COALESCE(E.Tienda, A.Tienda) AS Tienda,
               COALESCE(E.Descripcion, A.Descripcion) AS Descripcion,
               ISNULL(E.Cantidad, 0) AS CantidadEsteAño,
               ISNULL(A.Cantidad, 0) AS CantidadAñoPasado,
               ISNULL(A.Cantidad, 0) - ISNULL(E.Cantidad, 0) AS DisminucionCantidad,
               CAST(100.0 * (ISNULL(A.Cantidad, 0) - ISNULL(E.Cantidad, 0)) / NULLIF(ISNULL(A.Cantidad, 1), 0) AS NUMERIC(5,2)) AS DisminucionPct
        FROM EsteAño E FULL OUTER JOIN AñoPasado A
            ON E.Tienda = A.Tienda AND E.Descripcion = A.Descripcion
        WHERE ISNULL(A.Cantidad, 0) > ISNULL(E.Cantidad, 0)
          AND ISNULL(A.Cantidad, 0) > 0
        ORDER BY DisminucionCantidad DESC
    `, [periodEsteAñoStart, periodEsteAñoEnd, periodAñoPasadoStart, periodAñoPasadoEnd])) as any[];

    console.log(`[PRODUCTOS_BAJA] Productos con comparación: ${allComparisons.length}`);

    if (allComparisons.length === 0) {
        const title = `Análisis de productos con baja de ventas — ${targetDateLabel(daysAgo)}`;
        return { title, full: '📉 Sin datos en el período.', short: '📉 Sin datos.', rows: [] };
    }

    // TOP 5 rotativo (WhatsApp): excluir ya reportados este mes
    const alreadyReported = userId ? (await query(
        `SELECT CONCAT(Tienda, '|', Descripcion) AS Clave FROM tblAgentProductosBajasLog WHERE IdUsuario = ? AND Mes = ? AND Año = ?`,
        [userId, month, year]
    )) as any[] : [];
    const reportedSet = new Set(alreadyReported.map(r => r.Clave));

    const candidatos = allComparisons.filter(r => !reportedSet.has(`${r.Tienda}|${r.Descripcion}`));
    const top5 = candidatos.slice(0, 5);
    const top20 = allComparisons.slice(0, 20);

    // Registrar TOP 5 como reportado (rotación)
    for (const item of top5) {
        if (userId) {
            await query(
                `INSERT INTO tblAgentProductosBajasLog (IdUsuario, Mes, Año, Descripcion, Tienda, DisminucionDinero)
                 VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (IdUsuario, Mes, Año, Descripcion, Tienda) DO NOTHING`,
                [userId, month, year, item.Descripcion, item.Tienda, item.DisminucionCantidad]
            ).catch(() => { });
        }
    }

    const dayHeader = daysAgo === 1 ? '📉 Top 5 productos con baja de cantidad (ayer)' : '📉 Top 5 productos con baja de cantidad';
    const title = `Análisis de baja de cantidad en ventas — ${targetDateLabel(daysAgo)}`;

    // Datos para IA (CANTIDAD, no dinero)
    const datos5 = top5.map((p, i) => `${i + 1}. ${p.Descripcion} (${p.Tienda}): ${p.CantidadAñoPasado} unidades → ${p.CantidadEsteAño} unidades | ↓${p.DisminucionCantidad} unidades (${p.DisminucionPct || 0}%)`).join('\n');
    const datos20 = top20.map((p, i) => `${i + 1}. ${p.Descripcion} (${p.Tienda}): ↓${p.DisminucionCantidad} unidades`).join('\n');

    const prompt = `Eres Kesito, analista senior de KYK retail. Analiza DISMINUCIÓN DE CANTIDAD (unidades vendidas) últimos 30 días: ${hace30.toLocaleDateString('es-MX')} — ${today.toLocaleDateString('es-MX')} vs hace 1 año.

TOP 5 (nuevo hoy, por cantidad):
${datos5}

TOP 20 (panorama completo):
${datos20}

Devuelve DOS versiones separadas por "---":

VERSIÓN COMPLETA (página + detalle por sucursal):
- Empieza con "${dayHeader}".
- Análisis de 10-15 líneas: cuáles productos bajaron en cantidad, en cuáles sucursales, magnitud (unidades perdidas).
- Destaca top 5, luego contexto del top 20 (tendencias, patrones por sucursal).
- Usa cantidades y %, estructura clara.
- Tono ejecutivo (tutea).

---

VERSIÓN CORTA (WhatsApp, ≤300 caracteres):
- Una línea: "${dayHeader}:" + top 1 producto + sucursal + cantidad perdida + link.

Devuelve SOLO dos bloques separados por "---".`;

    const raw = await narrate(prompt, 1500, modelId);
    const fallbackFull = `${dayHeader}\n\n${datos5}\n\nPanorama TOP 20 en reporte detallado.`;
    const fallbackShort = `${dayHeader}: ${top5[0]?.Descripcion || '...'} (${top5[0]?.Tienda || '...'}) ↓${top5[0]?.DisminucionCantidad || 0} unidades.`;
    const { full, short } = raw ? splitFullShort(raw) : { full: fallbackFull, short: fallbackShort };

    // TOP 20 + detalle por sucursal para reporte
    const porTienda = new Map<string, typeof allComparisons>();
    for (const comp of allComparisons) {
        if (!porTienda.has(comp.Tienda)) porTienda.set(comp.Tienda, []);
        porTienda.get(comp.Tienda)!.push(comp);
    }

    const rows = top20;

    return { title, full, short, rows };
}

// ─── CEDIS: salidas en tránsito atoradas (aviso matutino) ───────────────────
// Transferencias que salieron del CEDIS (IdTienda 64, en MySQL) hace más de
// N días y que ninguna tienda ha registrado como recibidas. Contenido
// determinístico (sin IA): folios, tiendas, días y valor en riesgo.
const CEDIS_ID_ALMACEN = 64;
const CEDIS_TRANSITO_DIAS = Math.max(1, Number(process.env.CEDIS_TRANSITO_DIAS) || 3);
const CEDIS_TRANSITO_LOOKBACK_DIAS = 60;

interface TransitoRow {
    Folio: string;
    Tienda: string | null;
    Fecha: string;
    Dias: number;
    Valor: number | null;
}

export async function generateCedisTransito(): Promise<EndOfDayContent> {
    const selectFor = (table: string) => `
        SELECT s.FolioSalida AS Folio,
               t.Tienda,
               DATE_FORMAT(s.FechaSalida, '%Y-%m-%d') AS Fecha,
               TIMESTAMPDIFF(DAY, s.FechaSalida, NOW()) AS Dias,
               d.Valor
        FROM ${table} s
        LEFT JOIN tblTiendas t ON t.IdTienda = s.IdTiendaDestino
        LEFT JOIN (
            SELECT IdTransferenciaSalida, IdTienda, SUM(Mov * Costo) AS Valor
            FROM tblDetalleTransferenciasSalidas
            WHERE IdTienda = ${CEDIS_ID_ALMACEN}
            GROUP BY IdTransferenciaSalida, IdTienda
        ) d ON d.IdTransferenciaSalida = s.IdTransferenciaSalida AND d.IdTienda = s.IdTienda
        WHERE s.IdTienda = ${CEDIS_ID_ALMACEN} AND s.Status = 0
          AND s.FechaEntrada <= '2000-01-01'
          AND (s.FolioEntrada IS NULL OR s.FolioEntrada = '')
          AND s.FechaSalida < DATE_SUB(NOW(), INTERVAL ${CEDIS_TRANSITO_DIAS} DAY)
          AND s.FechaSalida >= DATE_SUB(NOW(), INTERVAL ${CEDIS_TRANSITO_LOOKBACK_DIAS} DAY)`;

    const [normales, facturas] = await Promise.all([
        mysqlQuery(selectFor('tblTransferenciasSalidas')) as Promise<TransitoRow[]>,
        mysqlQuery(selectFor('tblTransferenciasSalidasFacturas')) as Promise<TransitoRow[]>,
    ]);
    const stuck = [...(normales ?? []), ...(facturas ?? [])]
        .map((r) => ({ ...r, Valor: Number(r.Valor ?? 0), Tienda: r.Tienda || 'Tienda desconocida' }))
        .sort((a, b) => b.Dias - a.Dias || b.Valor - a.Valor);

    const title = `CEDIS: salidas en tránsito atoradas — ${targetDateLabel(0)}`;
    if (stuck.length === 0) {
        return {
            title,
            full: `🚚 Sin salidas atoradas: todo lo enviado por el CEDIS en los últimos ${CEDIS_TRANSITO_LOOKBACK_DIAS} días ya fue recibido (umbral ${CEDIS_TRANSITO_DIAS} días).`,
            short: '🚚 CEDIS al día: sin salidas en tránsito atoradas.',
            rows: [],
        };
    }

    const valorTotal = stuck.reduce((acc, s) => acc + s.Valor, 0);
    const lineas = stuck.slice(0, 20).map(
        (s) => `• ${s.Folio} → ${s.Tienda}: ${s.Dias} días (salió ${s.Fecha}) · ${fmtMxn(s.Valor)}`
    );
    const porTienda = new Map<string, number>();
    for (const s of stuck) porTienda.set(s.Tienda!, (porTienda.get(s.Tienda!) ?? 0) + 1);
    const tiendasResumen = [...porTienda.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([tienda, n]) => `${tienda} (${n})`)
        .join(', ');

    const full = [
        `🚚 CEDIS: ${stuck.length} salidas con más de ${CEDIS_TRANSITO_DIAS} días sin que la tienda registre su entrada. Valor en riesgo: ${fmtMxn(valorTotal)}.`,
        '',
        ...lineas,
        stuck.length > 20 ? `… y ${stuck.length - 20} más.` : '',
        '',
        `Tiendas con pendientes: ${tiendasResumen}.`,
        'Revisar físicamente y registrar la transferencia de entrada en cada tienda, o cancelar la salida si no procede.',
    ].filter(Boolean).join('\n');

    const top = stuck[0];
    const short = `🚚 CEDIS: ${stuck.length} salidas atoradas (+${CEDIS_TRANSITO_DIAS}d) por ${fmtMxn(valorTotal)}. Peor: ${top.Folio} → ${top.Tienda} (${top.Dias} días, ${fmtMxn(top.Valor)}).`;

    return { title, full, short, rows: stuck.slice(0, 100) as unknown as Record<string, any>[] };
}

/**
 * Envía resumen o hallazgos a los destinatarios y registra el evento.
 * daysAgo=1 reporta el día anterior (envío manual de madrugada).
 * El envío manual NO toca FechaUltimaEvaluacion para no suprimir el envío
 * automático de las 11 PM (el cron hace su propio UPDATE aparte).
 */
const END_OF_DAY_GENERATORS: Record<Exclude<EndOfDayClave, 'productos_baja_ventas'>, (daysAgo: number, modelId?: string | null) => Promise<EndOfDayContent>> = {
    resumen_dia: generateResumenDia,
    hallazgos_dia: generateHallazgosDia,
    resumen_cancelaciones: generateResumenCancelaciones,
    resumen_devoluciones: generateResumenDevoluciones,
    cedis_transito: generateCedisTransito,
};

export async function runEndOfDayMessage(
    clave: EndOfDayClave,
    userId: string,
    alertId: string,
    recipients: string[],
    daysAgo = 0,
    dedupe = false
): Promise<{ sent: number }> {
    const modelId = await getSystemAlertModel(userId).catch(() => null);
    const gen = clave === 'productos_baja_ventas'
        ? await generateProductosBajasVentas(userId, daysAgo, modelId)
        : await END_OF_DAY_GENERATORS[clave](daysAgo, modelId);

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
    // Dedup por clave ESTABLE (clave+día): un envío por número al día aunque el
    // texto varíe (link con UUID, narración IA) o lo disparen varios usuarios.
    const sent = await sendToAll(recipients, text, dedupe, `eod:${clave}:${monterreyDateKey()}`);
    await recordAlertEvent({
        alertId,
        userId,
        observedValue: null,
        message: gen.short.slice(0, 490) || gen.title,
        resultsJson: JSON.stringify({ clave, recipients: recipients.length, daysAgo }),
        touchLastEvaluation: false,
    }).catch(() => { });
    return { sent };
}

// ─── 6) Cancelaciones atípicas (evento, cada 5 min) ────────────────────────
// Dispara cuando aparece una cancelación "rara": monto alto, o parte de una
// ráfaga de muchas cancelaciones en poco tiempo hechas por el MISMO cajero.
// Manda el detalle de CADA cancelación atípica UNA sola vez (dedup en
// tblAgentCancelacionAlertLog, por usuario + cancelación + día).
//
// Umbrales configurables por env (con default = lo que pidió el dueño):
const CANCEL_BIG_AMOUNT = Math.max(1, Number(process.env.CANCEL_ALERT_MONTO) || 1000);        // "> $1,000"
const CANCEL_BURST_COUNT = Math.max(1, Number(process.env.CANCEL_ALERT_RAFAGA_NUM) || 4);     // "más de 4"
const CANCEL_BURST_WINDOW_MIN = Math.max(1, Number(process.env.CANCEL_ALERT_RAFAGA_MIN) || 2);// "en menos de 2 min"
const CANCEL_MAX_PER_PASS = 15; // tope de avisos por pasada; el resto se manda en la siguiente

interface CancHeader {
    IdTienda: number;
    IdComputadora: number;
    IdCancelacion: number;
    IdCajero: number | null;
    FechaCancelacion: Date;
    Total: number;
}

const cancelKey = (h: { IdTienda: unknown; IdComputadora: unknown; IdCancelacion: unknown }) =>
    `${h.IdTienda}-${h.IdComputadora}-${h.IdCancelacion}`;

/** Detalle (una línea por producto) de UNA cancelación, para el mensaje. */
async function buildCancelacionMessage(h: CancHeader, big: boolean, burst: number): Promise<string | null> {
    const detalle = (await query(
        `SELECT T.Tienda,
                ISNULL(F.Descripcion, '(sin descripción)') AS Producto,
                B.Cantidad,
                B.PrecioVenta AS Precio,
                B.Cantidad * B.PrecioVenta AS Total,
                A.FechaCancelacion,
                ISNULL(D.Usuario, '—') AS Cajero,
                ISNULL(E.Usuario, '—') AS Supervisor
         FROM tblCancelaciones A
         INNER JOIN tblDetalleCancelaciones B
            ON A.IdCancelacion = B.IdCancelacion AND A.IdComputadora = B.IdComputadora AND A.IdTienda = B.IdTienda
         LEFT JOIN tblAperturasCierres C
            ON A.IdTienda = C.IdTienda AND A.IdApertura = C.IdApertura AND A.IdComputadora = C.IdComputadora
         LEFT JOIN tblUsuarios D ON C.IdCajero = D.IdUsuario
         LEFT JOIN tblUsuarios E ON A.IdSupervisor = E.IdUsuario
         LEFT JOIN tblArticulos F ON B.CodigoInterno = F.CodigoInterno
         INNER JOIN tblTiendas T ON A.IdTienda = T.IdTienda
         WHERE A.IdTienda = ? AND A.IdComputadora = ? AND A.IdCancelacion = ?
         ORDER BY B.Cantidad * B.PrecioVenta DESC`,
        [h.IdTienda, h.IdComputadora, h.IdCancelacion]
    )) as any[];
    if (!detalle.length) return null;

    const first = detalle[0];
    let fecha = '';
    try {
        fecha = new Date(first.FechaCancelacion).toLocaleString('es-MX', {
            timeZone: 'America/Monterrey', day: '2-digit', month: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
        });
    } catch { fecha = String(first.FechaCancelacion); }

    const motivos: string[] = [];
    if (big) motivos.push(`monto mayor a ${fmtMxn(CANCEL_BIG_AMOUNT)}`);
    if (burst > CANCEL_BURST_COUNT) motivos.push(`ráfaga (${burst} cancelaciones del mismo cajero en menos de ${CANCEL_BURST_WINDOW_MIN} min)`);

    const lineas = detalle
        .map((d) => `• ${d.Producto} — ${Number(d.Cantidad) || 0} x ${fmtMxn(d.Precio)} = ${fmtMxn(d.Total)}`)
        .join('\n');

    return `🚨 Cancelación atípica (${motivos.join(' y ')})
Sucursal: ${first.Tienda}
Folio: ${h.IdComputadora}-${h.IdCancelacion}
Fecha: ${fecha}
Cajero: ${first.Cajero} · Supervisor: ${first.Supervisor}
Detalle:
${lineas}
Total cancelación: ${fmtMxn(h.Total)}`;
}

export async function runCancelacionesAnomalas(
    userId: string,
    alertId: string,
    recipients: string[],
    opts: { manual?: boolean } = {}
): Promise<{ sent: number; anomalias: number }> {
    const manual = !!opts.manual;
    // En envío manual, si hoy no hay nada raro, confirmamos; en automático, silencio.
    const nada = async (): Promise<{ sent: number; anomalias: number }> =>
        manual
            ? { sent: await sendToAll(recipients, '✅ Sin cancelaciones atípicas hoy.', false), anomalias: 0 }
            : { sent: 0, anomalias: 0 };

    // Cancelaciones de HOY, una fila por cancelación con su monto total.
    const headers = (await query(`
        ;WITH Canc AS (
            SELECT A.IdTienda, A.IdComputadora, A.IdCancelacion, C.IdCajero,
                   MIN(A.FechaCancelacion) AS FechaCancelacion,
                   SUM(B.Cantidad * B.PrecioVenta) AS Total
            FROM tblCancelaciones A
            INNER JOIN tblDetalleCancelaciones B
                ON A.IdCancelacion = B.IdCancelacion AND A.IdComputadora = B.IdComputadora AND A.IdTienda = B.IdTienda
            LEFT JOIN tblAperturasCierres C
                ON A.IdTienda = C.IdTienda AND A.IdApertura = C.IdApertura AND A.IdComputadora = C.IdComputadora
            WHERE A.FechaCancelacion >= CAST(GETDATE() AS DATE)
            GROUP BY A.IdTienda, A.IdComputadora, A.IdCancelacion, C.IdCajero
        )
        SELECT IdTienda, IdComputadora, IdCancelacion, IdCajero, FechaCancelacion, Total
        FROM Canc
        ORDER BY IdCajero, FechaCancelacion
    `)) as CancHeader[];
    if (!headers.length) return nada();

    // Motivos por cancelación (una cancelación puede cumplir ambos).
    const flagged = new Map<string, { h: CancHeader; big: boolean; burst: number }>();
    const mark = (h: CancHeader, patch: { big?: boolean; burst?: number }) => {
        const k = cancelKey(h);
        const cur = flagged.get(k) || { h, big: false, burst: 0 };
        if (patch.big) cur.big = true;
        if (patch.burst) cur.burst = Math.max(cur.burst, patch.burst);
        flagged.set(k, cur);
    };

    // Regla A: cancelación con monto mayor al umbral.
    for (const h of headers) {
        if (Number(h.Total) > CANCEL_BIG_AMOUNT) mark(h, { big: true });
    }

    // Regla B: ráfaga — > N cancelaciones dentro de una ventana < W min del MISMO cajero.
    // Ventana deslizante (dos punteros) sobre las cancelaciones de cada cajero, ya ordenadas por fecha.
    const windowMs = CANCEL_BURST_WINDOW_MIN * 60_000;
    const byCajero = new Map<number, CancHeader[]>();
    for (const h of headers) {
        if (h.IdCajero == null) continue;            // sin cajero atribuible no se evalúa ráfaga
        const idc = Number(h.IdCajero);
        const arr = byCajero.get(idc) || [];
        arr.push(h);
        byCajero.set(idc, arr);
    }
    for (const arr of byCajero.values()) {
        let i = 0;
        for (let j = 0; j < arr.length; j++) {
            const tj = new Date(arr[j].FechaCancelacion).getTime();
            while (tj - new Date(arr[i].FechaCancelacion).getTime() >= windowMs) i++;
            const count = j - i + 1; // cancelaciones del cajero dentro de (tj - W, tj]
            if (count > CANCEL_BURST_COUNT) {
                for (let k = i; k <= j; k++) mark(arr[k], { burst: count });
            }
        }
    }

    if (flagged.size === 0) return nada();

    // Automático: omite las ya avisadas hoy (dedup persistente; el día lo define la BD).
    // Manual: manda TODAS las de hoy (reporte on-demand), aunque ya se hayan avisado.
    let candidatas = [...flagged.values()];
    if (!manual) {
        const logged = (await query(
            `SELECT CancelKey FROM tblAgentCancelacionAlertLog WHERE IdUsuario = ? AND Fecha = CAST(GETDATE() AS DATE)`,
            [userId]
        )) as Array<{ CancelKey: string }>;
        const already = new Set(logged.map((r) => r.CancelKey));
        candidatas = candidatas.filter((r) => !already.has(cancelKey(r.h)));
        if (candidatas.length === 0) return { sent: 0, anomalias: 0 };
    }
    candidatas.sort((a, b) => new Date(b.h.FechaCancelacion).getTime() - new Date(a.h.FechaCancelacion).getTime());

    const cap = manual ? 30 : CANCEL_MAX_PER_PASS;
    if (candidatas.length > cap) {
        console.log(`[cancelaciones_anomalas] ${candidatas.length} atípicas; mando ${cap}, el resto ${manual ? 'se omite' : 'en la siguiente pasada'}.`);
    }

    let sent = 0;
    let anomalias = 0;
    for (const r of candidatas.slice(0, cap)) {
        const text = await buildCancelacionMessage(r.h, r.big, r.burst).catch(() => null);
        if (!text) continue;

        // cron: dedup de envío activado; manual: directo (acción deliberada del usuario).
        sent += await sendToAll(recipients, text, !manual);

        const motivo = r.big && r.burst > CANCEL_BURST_COUNT ? 'ambos' : r.big ? 'grande' : 'rafaga';
        await query(
            `INSERT INTO tblAgentCancelacionAlertLog (IdUsuario, CancelKey, Fecha, Motivo)
             VALUES (?, ?, CAST(GETDATE() AS DATE), ?)`,
            [userId, cancelKey(r.h), motivo]
        ).catch(() => { /* si ya estaba (cron previo o pasadas que chocan), la PK evita el duplicado */ });

        await recordAlertEvent({
            alertId,
            userId,
            observedValue: Number(r.h.Total) || null,
            message: `Cancelación atípica · Folio ${r.h.IdComputadora}-${r.h.IdCancelacion} · ${fmtMxn(r.h.Total)}`,
            resultsJson: JSON.stringify({ ...r.h, motivo }),
            touchLastEvaluation: !manual, // el envío manual no debe correr el reloj del cron
        }).catch(() => { });
        anomalias++;
    }

    return { sent, anomalias };
}

// ─── Helpers compartidos de alertas de evento (devoluciones, retiros, supervisor) ─
const EVENT_MAX_PER_PASS = 15;       // tope por pasada del cron
const EVENT_MAX_MANUAL = 30;         // tope por clic manual

/** Llaves ya avisadas HOY para una clave (dedup; el día lo define la BD). */
async function loadAlertedKeys(userId: string, clave: string): Promise<Set<string>> {
    const rows = (await query(
        `SELECT EventoKey FROM tblAgentEventoAlertLog WHERE IdUsuario = ? AND Clave = ? AND Fecha = CAST(GETDATE() AS DATE)`,
        [userId, clave]
    )) as Array<{ EventoKey: string }>;
    return new Set(rows.map((r) => r.EventoKey));
}

/** Marca un evento como avisado hoy (idempotente; la PK evita duplicados). */
async function markAlerted(userId: string, clave: string, key: string, motivo: string): Promise<void> {
    await query(
        `INSERT INTO tblAgentEventoAlertLog (IdUsuario, Clave, EventoKey, Fecha, Motivo)
         VALUES (?, ?, ?, CAST(GETDATE() AS DATE), ?)`,
        [userId, clave, key, motivo]
    ).catch(() => { /* si ya estaba (cron previo / pasadas que chocan), la PK lo evita */ });
}

/** Marca como "ráfaga" los elementos con > maxCount eventos del MISMO actor dentro de < windowMs. */
function detectBursts<T>(
    items: T[],
    actorOf: (t: T) => number | null,
    timeOf: (t: T) => number,
    windowMs: number,
    maxCount: number,
    onBurst: (t: T, count: number) => void
): void {
    const byActor = new Map<number, T[]>();
    for (const it of items) {
        const a = actorOf(it);
        if (a == null) continue;
        const arr = byActor.get(a) || [];
        arr.push(it);
        byActor.set(a, arr);
    }
    for (const arr of byActor.values()) {
        arr.sort((x, y) => timeOf(x) - timeOf(y));
        let i = 0;
        for (let j = 0; j < arr.length; j++) {
            while (timeOf(arr[j]) - timeOf(arr[i]) >= windowMs) i++;
            const count = j - i + 1;
            if (count > maxCount) for (let k = i; k <= j; k++) onBurst(arr[k], count);
        }
    }
}

const fmtFechaHora = (d: Date): string => {
    try {
        return new Date(d).toLocaleString('es-MX', {
            timeZone: 'America/Monterrey', day: '2-digit', month: '2-digit',
            hour: '2-digit', minute: '2-digit',
        });
    } catch { return String(d); }
};

// ─── 7) Devoluciones atípicas (evento, cada 5 min) ─────────────────────────
const DEV_BIG_AMOUNT = Math.max(1, Number(process.env.DEV_ALERT_MONTO) || 1000);
const DEV_BURST_COUNT = Math.max(1, Number(process.env.DEV_ALERT_RAFAGA_NUM) || 4);
const DEV_BURST_WINDOW_MIN = Math.max(1, Number(process.env.DEV_ALERT_RAFAGA_MIN) || 2);

interface DevRow {
    IdTienda: number;
    IdDevolucionVenta: number;
    IdUsuario: number | null;
    FechaDevolucionVenta: Date;
    Valor: number;
    Tienda: string;
    Cliente: string | null;
    Concepto: string | null;
    Empleado: string | null;
    Supervisor: string;
}

function buildDevolucionMessage(d: DevRow, big: boolean, burst: number): string {
    const motivos: string[] = [];
    if (big) motivos.push(`monto mayor a ${fmtMxn(DEV_BIG_AMOUNT)}`);
    if (burst > DEV_BURST_COUNT) motivos.push(`ráfaga (${burst} devoluciones del mismo supervisor en menos de ${DEV_BURST_WINDOW_MIN} min)`);
    return `🔁 Devolución atípica (${motivos.join(' y ')})
Sucursal: ${d.Tienda}
Folio: ${d.IdDevolucionVenta}
Fecha: ${fmtFechaHora(d.FechaDevolucionVenta)}
Monto: ${fmtMxn(d.Valor)}
Cliente: ${d.Cliente || '—'}
Motivo: ${d.Concepto || '—'}
Empleado: ${d.Empleado || '—'} · Supervisor: ${d.Supervisor}`;
}

export async function runDevolucionesAnomalas(
    userId: string,
    alertId: string,
    recipients: string[],
    opts: { manual?: boolean } = {}
): Promise<{ sent: number; anomalias: number }> {
    const manual = !!opts.manual;
    const nada = async (): Promise<{ sent: number; anomalias: number }> =>
        manual
            ? { sent: await sendToAll(recipients, '✅ Sin devoluciones atípicas hoy.', false), anomalias: 0 }
            : { sent: 0, anomalias: 0 };

    const rows = (await query(`
        SELECT A.IdTienda, A.IdDevolucionVenta, A.IdUsuario, A.FechaDevolucionVenta, A.Valor,
               ISNULL(T.Tienda, 'Sin tienda') AS Tienda, A.Cliente, A.Concepto, A.Empleado,
               ISNULL(U.Usuario, '—') AS Supervisor
        FROM tblDevolucionesVenta A
        LEFT JOIN tblTiendas T ON A.IdTienda = T.IdTienda
        LEFT JOIN tblUsuarios U ON A.IdUsuario = U.IdUsuario
        WHERE CAST(A.FechaDevolucionVenta AS DATE) = CAST(GETDATE() AS DATE)
        ORDER BY A.IdUsuario, A.FechaDevolucionVenta
    `)) as DevRow[];
    if (!rows.length) return nada();

    const keyOf = (d: DevRow) => `${d.IdTienda}-${d.IdDevolucionVenta}`;
    const flagged = new Map<string, { d: DevRow; big: boolean; burst: number }>();
    const mark = (d: DevRow, patch: { big?: boolean; burst?: number }) => {
        const cur = flagged.get(keyOf(d)) || { d, big: false, burst: 0 };
        if (patch.big) cur.big = true;
        if (patch.burst) cur.burst = Math.max(cur.burst, patch.burst);
        flagged.set(keyOf(d), cur);
    };

    for (const d of rows) if (Number(d.Valor) > DEV_BIG_AMOUNT) mark(d, { big: true });
    detectBursts(
        rows,
        (d) => (d.IdUsuario == null ? null : Number(d.IdUsuario)),
        (d) => new Date(d.FechaDevolucionVenta).getTime(),
        DEV_BURST_WINDOW_MIN * 60_000,
        DEV_BURST_COUNT,
        (d, count) => mark(d, { burst: count })
    );

    if (flagged.size === 0) return nada();

    let candidatas = [...flagged.values()];
    if (!manual) {
        const already = await loadAlertedKeys(userId, 'devoluciones_anomalas');
        candidatas = candidatas.filter((r) => !already.has(keyOf(r.d)));
        if (candidatas.length === 0) return { sent: 0, anomalias: 0 };
    }
    candidatas.sort((a, b) => new Date(b.d.FechaDevolucionVenta).getTime() - new Date(a.d.FechaDevolucionVenta).getTime());

    let sent = 0;
    let anomalias = 0;
    for (const r of candidatas.slice(0, manual ? EVENT_MAX_MANUAL : EVENT_MAX_PER_PASS)) {
        sent += await sendToAll(recipients, buildDevolucionMessage(r.d, r.big, r.burst), !manual);
        const motivo = r.big && r.burst > DEV_BURST_COUNT ? 'ambos' : r.big ? 'grande' : 'rafaga';
        await markAlerted(userId, 'devoluciones_anomalas', keyOf(r.d), motivo);
        await recordAlertEvent({
            alertId, userId,
            observedValue: Number(r.d.Valor) || null,
            message: `Devolución atípica · Folio ${r.d.IdDevolucionVenta} · ${fmtMxn(r.d.Valor)}`,
            resultsJson: JSON.stringify({ ...r.d, motivo }),
            touchLastEvaluation: !manual,
        }).catch(() => { });
        anomalias++;
    }
    return { sent, anomalias };
}

// ─── 8) Retiros de efectivo inusuales (evento, cada 5 min) ─────────────────
const RETIRO_BIG_CASH = Math.max(1, Number(process.env.RETIRO_ALERT_MONTO) || 10000);
const parseHour = (v: string | undefined, def: number): number => {
    const n = Number(v);
    return Number.isInteger(n) && n >= 0 && n <= 24 ? n : def;
};
const RETIRO_HORA_INI = parseHour(process.env.RETIRO_ALERT_HORA_INI, 6);   // permitido DESDE (incl.)
const RETIRO_HORA_FIN = parseHour(process.env.RETIRO_ALERT_HORA_FIN, 23);  // permitido HASTA (excl.)

interface RetiroRow {
    IdTienda: number;
    IdComputadora: number;
    IdRetiro: number;
    Fecha: Date;
    Hora: number;
    Tienda: string;
    Concepto: string | null;
    Efectivo: number;
    Total: number;
    Cajero: string;
    Supervisor: string;
}

function buildRetiroMessage(r: RetiroRow, big: boolean, offHours: boolean): string {
    const motivos: string[] = [];
    if (big) motivos.push(`efectivo mayor a ${fmtMxn(RETIRO_BIG_CASH)}`);
    if (offHours) motivos.push(`fuera de horario (permitido ${RETIRO_HORA_INI}:00–${RETIRO_HORA_FIN}:00)`);
    return `💵 Retiro de efectivo inusual (${motivos.join(' y ')})
Sucursal: ${r.Tienda}
Folio: ${r.IdComputadora}-${r.IdRetiro}
Fecha: ${fmtFechaHora(r.Fecha)}
Efectivo: ${fmtMxn(r.Efectivo)}
Total retiro: ${fmtMxn(r.Total)}
Concepto: ${r.Concepto || '—'}
Cajero: ${r.Cajero} · Supervisor: ${r.Supervisor}`;
}

export async function runRetirosInusuales(
    userId: string,
    alertId: string,
    recipients: string[],
    opts: { manual?: boolean } = {}
): Promise<{ sent: number; anomalias: number }> {
    const manual = !!opts.manual;
    const nada = async (): Promise<{ sent: number; anomalias: number }> =>
        manual
            ? { sent: await sendToAll(recipients, '✅ Sin retiros de efectivo inusuales hoy.', false), anomalias: 0 }
            : { sent: 0, anomalias: 0 };

    const rows = (await query(`
        SELECT A.IdTienda, A.IdComputadora, A.IdRetiro, A.Fecha, DATEPART(HOUR, A.Fecha) AS Hora,
               ISNULL(T.Tienda, 'Sin tienda') AS Tienda, A.Concepto,
               ISNULL(A.Efectivo, 0) AS Efectivo,
               (ISNULL(A.Efectivo,0) + ISNULL(A.Tarjeta,0) + ISNULL(A.TarjetaDebito,0) + ISNULL(A.Dolares,0)
                + ISNULL(A.Cheques,0) + ISNULL(A.Transferencia,0) + ISNULL(A.Devoluciones,0)) AS Total,
               ISNULL(D.Usuario, '—') AS Cajero, ISNULL(E.Usuario, '—') AS Supervisor
        FROM tblRetiros A
        LEFT JOIN tblAperturasCierres C
            ON A.IdTienda = C.IdTienda AND A.IdComputadora = C.IdComputadora AND A.IdApertura = C.IdApertura
        LEFT JOIN tblUsuarios D ON C.IdCajero = D.IdUsuario
        LEFT JOIN tblUsuarios E ON A.IdSupervisor = E.IdUsuario
        LEFT JOIN tblTiendas T ON A.IdTienda = T.IdTienda
        WHERE CAST(A.Fecha AS DATE) = CAST(GETDATE() AS DATE)
        ORDER BY A.Fecha
    `)) as RetiroRow[];
    if (!rows.length) return nada();

    const keyOf = (r: RetiroRow) => `${r.IdTienda}-${r.IdComputadora}-${r.IdRetiro}`;
    const flagged: Array<{ r: RetiroRow; big: boolean; offHours: boolean }> = [];
    for (const r of rows) {
        const efectivo = Number(r.Efectivo) || 0;
        const big = efectivo > RETIRO_BIG_CASH;
        const offHours = efectivo > 0 && (Number(r.Hora) < RETIRO_HORA_INI || Number(r.Hora) >= RETIRO_HORA_FIN);
        if (big || offHours) flagged.push({ r, big, offHours });
    }
    if (flagged.length === 0) return nada();

    let candidatos = flagged;
    if (!manual) {
        const already = await loadAlertedKeys(userId, 'retiros_inusuales');
        candidatos = candidatos.filter((x) => !already.has(keyOf(x.r)));
        if (candidatos.length === 0) return { sent: 0, anomalias: 0 };
    }
    candidatos.sort((a, b) => new Date(b.r.Fecha).getTime() - new Date(a.r.Fecha).getTime());

    let sent = 0;
    let anomalias = 0;
    for (const x of candidatos.slice(0, manual ? EVENT_MAX_MANUAL : EVENT_MAX_PER_PASS)) {
        sent += await sendToAll(recipients, buildRetiroMessage(x.r, x.big, x.offHours), !manual);
        const motivo = x.big && x.offHours ? 'ambos' : x.big ? 'monto' : 'horario';
        await markAlerted(userId, 'retiros_inusuales', keyOf(x.r), motivo);
        await recordAlertEvent({
            alertId, userId,
            observedValue: Number(x.r.Efectivo) || null,
            message: `Retiro inusual · Folio ${x.r.IdComputadora}-${x.r.IdRetiro} · efectivo ${fmtMxn(x.r.Efectivo)}`,
            resultsJson: JSON.stringify({ ...x.r, motivo }),
            touchLastEvaluation: !manual,
        }).catch(() => { });
        anomalias++;
    }
    return { sent, anomalias };
}

// ─── 9) Supervisor con demasiadas autorizaciones ("sello de goma") ─────────
const SUPERVISOR_MAX = Math.max(1, Number(process.env.SUPERVISOR_ALERT_MAX) || 15);

interface SupRow {
    Id: number | null;
    Supervisor: string;
    CancCnt: number;
    CancMonto: number;
    DevCnt: number;
    DevMonto: number;
}

export async function runSupervisorSello(
    userId: string,
    alertId: string,
    recipients: string[],
    opts: { manual?: boolean } = {}
): Promise<{ sent: number; anomalias: number }> {
    const manual = !!opts.manual;
    const nada = async (): Promise<{ sent: number; anomalias: number }> =>
        manual
            ? { sent: await sendToAll(recipients, '✅ Ningún supervisor con autorizaciones excesivas hoy.', false), anomalias: 0 }
            : { sent: 0, anomalias: 0 };

    // Autorizaciones de HOY por supervisor = cancelaciones (IdSupervisor) + devoluciones (IdUsuario).
    const rows = (await query(`
        SELECT x.Id, ISNULL(U.Usuario, '—') AS Supervisor,
               SUM(x.CancCnt) AS CancCnt, SUM(x.CancMonto) AS CancMonto,
               SUM(x.DevCnt) AS DevCnt, SUM(x.DevMonto) AS DevMonto
        FROM (
            SELECT A.IdSupervisor AS Id,
                   COUNT(DISTINCT CONCAT(A.IdTienda, '-', A.IdComputadora, '-', A.IdCancelacion)) AS CancCnt,
                   SUM(B.Cantidad * B.PrecioVenta) AS CancMonto,
                   0 AS DevCnt, 0 AS DevMonto
            FROM tblCancelaciones A
            INNER JOIN tblDetalleCancelaciones B
                ON A.IdCancelacion = B.IdCancelacion AND A.IdComputadora = B.IdComputadora AND A.IdTienda = B.IdTienda
            WHERE CAST(A.FechaCancelacion AS DATE) = CAST(GETDATE() AS DATE)
            GROUP BY A.IdSupervisor
            UNION ALL
            SELECT A.IdUsuario AS Id, 0, 0, COUNT(*), SUM(A.Valor)
            FROM tblDevolucionesVenta A
            WHERE CAST(A.FechaDevolucionVenta AS DATE) = CAST(GETDATE() AS DATE)
            GROUP BY A.IdUsuario
        ) x
        LEFT JOIN tblUsuarios U ON x.Id = U.IdUsuario
        GROUP BY x.Id, U.Usuario
    `)) as SupRow[];

    const total = (s: SupRow) => (Number(s.CancCnt) || 0) + (Number(s.DevCnt) || 0);
    let candidatos = rows.filter((s) => s.Id != null && total(s) > SUPERVISOR_MAX);
    if (candidatos.length === 0) return nada();

    if (!manual) {
        const already = await loadAlertedKeys(userId, 'supervisor_sello');
        candidatos = candidatos.filter((s) => !already.has(`sup-${s.Id}`));
        if (candidatos.length === 0) return { sent: 0, anomalias: 0 };
    }
    candidatos.sort((a, b) => total(b) - total(a));

    let sent = 0;
    let anomalias = 0;
    for (const s of candidatos.slice(0, manual ? EVENT_MAX_MANUAL : EVENT_MAX_PER_PASS)) {
        const text = `🧑‍⚖️ Supervisor con muchas autorizaciones hoy
Supervisor: ${s.Supervisor}
Autorizaciones: ${total(s)} (más del límite de ${SUPERVISOR_MAX})
Cancelaciones: ${Number(s.CancCnt) || 0} por ${fmtMxn(s.CancMonto || 0)}
Devoluciones: ${Number(s.DevCnt) || 0} por ${fmtMxn(s.DevMonto || 0)}`;
        sent += await sendToAll(recipients, text, !manual);
        await markAlerted(userId, 'supervisor_sello', `sup-${s.Id}`, 'umbral');
        await recordAlertEvent({
            alertId, userId,
            observedValue: total(s),
            message: `Supervisor ${s.Supervisor}: ${total(s)} autorizaciones hoy`,
            resultsJson: JSON.stringify(s),
            touchLastEvaluation: !manual,
        }).catch(() => { });
        anomalias++;
    }
    return { sent, anomalias };
}
