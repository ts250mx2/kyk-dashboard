import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { anthropic } from '@/lib/anthropic';

const DAY_MS = 24 * 60 * 60 * 1000;
const HISTORY_DAYS = 90;

function toISO(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function dayOfWeekName(idx: number): string {
    return ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][idx];
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const codigoInterno = Number(body.codigoInterno);
        const rawStoreIds: number[] = Array.isArray(body.storeIds) ? body.storeIds : [];
        const storeIds = rawStoreIds.map(n => Number(n)).filter(n => Number.isFinite(n));
        const horizonDays = Math.max(1, Math.min(180, Number(body.horizonDays) || 30));
        const action: string = typeof body.action === 'string' ? body.action : 'monitor';
        const reasonShort: string = typeof body.reason === 'string' ? body.reason : '';

        if (!Number.isFinite(codigoInterno) || codigoInterno <= 0) {
            return NextResponse.json({ error: 'codigoInterno requerido' }, { status: 400 });
        }

        const today = new Date();
        const recentStart = new Date(today.getTime() - HISTORY_DAYS * DAY_MS);
        const lyRecentStart = new Date(recentStart.getTime() - 365 * DAY_MS);
        const lyRecentEnd = new Date(today.getTime() - 365 * DAY_MS);

        // Future horizon last year (the window we're forecasting INTO, but a year ago)
        const lyHorizonStart = new Date(today.getTime() + DAY_MS - 365 * DAY_MS);
        const lyHorizonEnd = new Date(today.getTime() + horizonDays * DAY_MS - 365 * DAY_MS);

        const storeFilter = storeIds.length > 0 ? `AND v.IdTienda IN (${storeIds.join(',')})` : '';

        // Get product master info
        const productInfo = await query(`
            SELECT TOP 1
                a.CodigoInterno,
                ISNULL(a.Descripcion, 'S/N') AS Descripcion,
                ISNULL(d.Depto, '') AS Depto,
                ISNULL(a.Familia, '') AS Familia
            FROM tblArticulos a
            LEFT JOIN tblDeptos d ON a.IdDepto = d.IdDepto
            WHERE a.CodigoInterno = ${codigoInterno}
        `) as Array<{ CodigoInterno: number; Descripcion: string; Depto: string; Familia: string }>;

        const product = productInfo[0] || { CodigoInterno: codigoInterno, Descripcion: 'S/N', Depto: '', Familia: '' };

        // Daily sales for the product — recent + LY recent (90 days each)
        const dailyRows = await query(`
            SELECT
                CAST(v.FechaVenta AS DATE) AS Fecha,
                SUM(dv.PrecioVenta * dv.Cantidad) AS Total,
                SUM(dv.Cantidad) AS Unidades
            FROM tblVentas v
            JOIN tblDetalleVentas dv ON v.IdVenta = dv.IdVenta AND v.IdTienda = dv.IdTienda AND v.IdComputadora = dv.IdComputadora
            WHERE dv.CodigoInterno = ${codigoInterno}
              AND ((v.FechaVenta >= '${toISO(recentStart)}' AND v.FechaVenta <= '${toISO(today)} 23:59:59')
                OR (v.FechaVenta >= '${toISO(lyRecentStart)}' AND v.FechaVenta <= '${toISO(lyRecentEnd)} 23:59:59'))
              ${storeFilter}
            GROUP BY CAST(v.FechaVenta AS DATE)
            ORDER BY Fecha ASC
        `) as Array<{ Fecha: Date | string; Total: number; Unidades: number }>;

        // Split daily rows into recent and LY series, shift LY to align with recent dates
        const recentDaily: Array<{ fecha: string; total: number; unidades: number }> = [];
        const lyDailyShifted: Array<{ fecha: string; total: number; unidades: number }> = [];
        for (const r of dailyRows) {
            const fechaIso = typeof r.Fecha === 'string' ? r.Fecha.split('T')[0] : toISO(r.Fecha);
            const date = new Date(`${fechaIso}T00:00:00`);
            if (date >= recentStart) {
                recentDaily.push({ fecha: fechaIso, total: Number(r.Total || 0), unidades: Number(r.Unidades || 0) });
            } else {
                // Shift LY to match recent dates (+365d)
                const shifted = new Date(date.getTime() + 365 * DAY_MS);
                lyDailyShifted.push({ fecha: toISO(shifted), total: Number(r.Total || 0), unidades: Number(r.Unidades || 0) });
            }
        }

        // DOW pattern from recent data
        const dowAgg: Record<number, { total: number; days: number }> = {};
        for (let i = 0; i < 7; i++) dowAgg[i] = { total: 0, days: 0 };
        for (const r of recentDaily) {
            const d = new Date(`${r.fecha}T00:00:00`);
            const dow = d.getDay();
            dowAgg[dow].total += r.total;
            dowAgg[dow].days += 1;
        }
        const dowPattern = Array.from({ length: 7 }, (_, i) => ({
            dow: i,
            name: dayOfWeekName(i),
            avgTotal: dowAgg[i].days > 0 ? dowAgg[i].total / dowAgg[i].days : 0,
        }));

        // Top stores for this product (recent)
        const topStoresRows = await query(`
            SELECT TOP 5
                v.IdTienda,
                ISNULL(t.Tienda, 'S/N') AS Tienda,
                SUM(dv.PrecioVenta * dv.Cantidad) AS Total,
                SUM(dv.Cantidad) AS Unidades
            FROM tblVentas v
            JOIN tblDetalleVentas dv ON v.IdVenta = dv.IdVenta AND v.IdTienda = dv.IdTienda AND v.IdComputadora = dv.IdComputadora
            LEFT JOIN tblTiendas t ON v.IdTienda = t.IdTienda
            WHERE dv.CodigoInterno = ${codigoInterno}
              AND v.FechaVenta >= '${toISO(recentStart)}' AND v.FechaVenta <= '${toISO(today)} 23:59:59'
              ${storeFilter}
            GROUP BY v.IdTienda, t.Tienda
            ORDER BY Total DESC
        `) as Array<{ IdTienda: number; Tienda: string; Total: number; Unidades: number }>;

        const topStores = topStoresRows.map(r => ({
            idTienda: r.IdTienda,
            tienda: r.Tienda,
            total: Number(r.Total || 0),
            unidades: Number(r.Unidades || 0),
        }));

        const totalRecent = recentDaily.reduce((a, b) => a + b.total, 0);

        // LY horizon (the period we're projecting into, but last year)
        const lyHorizonRows = await query(`
            SELECT
                SUM(dv.PrecioVenta * dv.Cantidad) AS Total,
                SUM(dv.Cantidad) AS Unidades
            FROM tblVentas v
            JOIN tblDetalleVentas dv ON v.IdVenta = dv.IdVenta AND v.IdTienda = dv.IdTienda AND v.IdComputadora = dv.IdComputadora
            WHERE dv.CodigoInterno = ${codigoInterno}
              AND v.FechaVenta >= '${toISO(lyHorizonStart)}' AND v.FechaVenta <= '${toISO(lyHorizonEnd)} 23:59:59'
              ${storeFilter}
        `) as Array<{ Total: number | null; Unidades: number | null }>;
        const lyHorizonTotal = Number(lyHorizonRows[0]?.Total || 0);
        const lyHorizonUnits = Number(lyHorizonRows[0]?.Unidades || 0);

        // Compose summary for AI
        const recentLast14 = recentDaily.slice(-14).reduce((a, b) => a + b.total, 0);
        const recentPrior14 = recentDaily.slice(-28, -14).reduce((a, b) => a + b.total, 0);
        const last14Growth = recentPrior14 > 0 ? (recentLast14 - recentPrior14) / recentPrior14 : 0;

        const peakDow = [...dowPattern].sort((a, b) => b.avgTotal - a.avgTotal)[0];
        const topStoreText = topStores.length > 0
            ? `Top: ${topStores.slice(0, 3).map(s => `${s.tienda} $${Math.round(s.total).toLocaleString('es-MX')}`).join(', ')}`
            : 'sin top';

        const prompt = `Eres Kesito, consultor de retail mexicano. Vas a explicar EN DETALLE por qué el producto "${product.Descripcion}" fue clasificado como acción "${action.toUpperCase()}".

PRODUCTO:
- ${product.Descripcion} (#${product.CodigoInterno})
- Departamento: ${product.Depto || 'sin clasificar'}
- Familia: ${product.Familia || 'sin clasificar'}

RAZÓN INICIAL DEL MODELO:
"${reasonShort}"

DATOS DETALLADOS:
- Ventas últimos 90 días: $${Math.round(totalRecent).toLocaleString('es-MX')} (${recentDaily.length} días con movimiento)
- Crecimiento últimas 2 semanas vs. 2 anteriores: ${last14Growth >= 0 ? '+' : ''}${(last14Growth * 100).toFixed(0)}%
- Día fuerte de la semana: ${peakDow?.name || '—'} (promedio $${Math.round(peakDow?.avgTotal || 0).toLocaleString('es-MX')})
- Mismo período del año pasado proyectado (próximos ${horizonDays} días, hace 1 año): $${Math.round(lyHorizonTotal).toLocaleString('es-MX')} / ${lyHorizonUnits.toLocaleString('es-MX')} unidades
- Tiendas líderes (últimos 90d): ${topStoreText}

INSTRUCCIONES:
Escribe un análisis editorial de 4-6 oraciones (NO bullets) que explique:
1. La señal principal (estacional, tendencia, concentración geográfica, etc.) usando cifras específicas con **negritas Markdown**.
2. Riesgos o caveats a considerar.
3. Recomendación accionable concreta (cuánto cargar, en qué tiendas empujar, qué día de semana priorizar).

También extrae 3-5 "key insights" cortos (máx 90 caracteres cada uno) que sean cifras o hallazgos puntuales.

RESPONDE EN JSON (sin markdown alrededor):
{
  "analysis": "Párrafo de 4-6 oraciones con **negritas** en cifras y nombres",
  "keyInsights": ["insight 1 corto", "insight 2 corto", ...]
}`;

        const response = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1200,
            messages: [{ role: 'user', content: prompt }],
        });

        const text = (response.content[0] as { text?: string })?.text || '';
        const startIdx = text.indexOf('{');
        const endIdx = text.lastIndexOf('}');
        let aiOut: { analysis?: string; keyInsights?: string[] } = {};
        if (startIdx >= 0 && endIdx > startIdx) {
            try {
                aiOut = JSON.parse(text.substring(startIdx, endIdx + 1));
            } catch {
                aiOut = { analysis: text.slice(0, 600), keyInsights: [] };
            }
        }

        return NextResponse.json({
            product: {
                codigoInterno: product.CodigoInterno,
                descripcion: product.Descripcion,
                depto: product.Depto,
                familia: product.Familia,
            },
            action,
            reasonShort,
            analysis: aiOut.analysis || 'No se generó análisis.',
            keyInsights: Array.isArray(aiOut.keyInsights) ? aiOut.keyInsights : [],
            metrics: {
                totalRecent,
                last14Growth,
                lyHorizonTotal,
                lyHorizonUnits,
                horizonDays,
            },
            recentDaily,
            lyDailyShifted,
            dowPattern,
            topStores,
            generatedAt: new Date().toISOString(),
        });
    } catch (error: unknown) {
        console.error('product-explain error:', error);
        const msg = error instanceof Error ? error.message : 'Error generando explicación';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
