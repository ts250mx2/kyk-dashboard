import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { anthropic, ANTHROPIC_MODEL_CHEAP } from '@/lib/anthropic';

const DAY_MS = 24 * 60 * 60 * 1000;

type ProductRow = {
    CodigoInterno: number;
    Descripcion: string;
    Depto: string;
    Total: number;
    Unidades: number;
};

type Action = 'stock_up' | 'push' | 'monitor' | 'reduce';

function toISO(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

async function topProducts(
    dateStart: string,
    dateEnd: string,
    storeIds: number[],
    topN = 25
): Promise<ProductRow[]> {
    const storeFilter = storeIds.length > 0 ? `AND v.IdTienda IN (${storeIds.join(',')})` : '';
    return await query(`
        SELECT TOP ${topN}
            a.CodigoInterno,
            ISNULL(a.Descripcion, 'S/N') AS Descripcion,
            ISNULL(d.Depto, '') AS Depto,
            SUM(dv.PrecioVenta * dv.Cantidad) AS Total,
            SUM(dv.Cantidad) AS Unidades
        FROM tblVentas v
        JOIN tblDetalleVentas dv ON v.IdVenta = dv.IdVenta AND v.IdTienda = dv.IdTienda AND v.IdComputadora = dv.IdComputadora
        JOIN tblArticulos a ON dv.CodigoInterno = a.CodigoInterno
        LEFT JOIN tblDeptos d ON a.IdDepto = d.IdDepto
        WHERE v.FechaVenta >= '${dateStart}' AND v.FechaVenta <= '${dateEnd} 23:59:59'
        ${storeFilter}
        GROUP BY a.CodigoInterno, a.Descripcion, d.Depto
        ORDER BY Total DESC
    `) as ProductRow[];
}

async function totalsForProducts(
    codigoInternos: number[],
    dateStart: string,
    dateEnd: string,
    storeIds: number[]
): Promise<Map<number, { total: number; unidades: number }>> {
    const map = new Map<number, { total: number; unidades: number }>();
    if (codigoInternos.length === 0) return map;
    const storeFilter = storeIds.length > 0 ? `AND v.IdTienda IN (${storeIds.join(',')})` : '';
    const rows = await query(`
        SELECT
            dv.CodigoInterno,
            SUM(dv.PrecioVenta * dv.Cantidad) AS Total,
            SUM(dv.Cantidad) AS Unidades
        FROM tblVentas v
        JOIN tblDetalleVentas dv ON v.IdVenta = dv.IdVenta AND v.IdTienda = dv.IdTienda AND v.IdComputadora = dv.IdComputadora
        WHERE v.FechaVenta >= '${dateStart}' AND v.FechaVenta <= '${dateEnd} 23:59:59'
          AND dv.CodigoInterno IN (${codigoInternos.join(',')})
        ${storeFilter}
        GROUP BY dv.CodigoInterno
    `) as Array<{ CodigoInterno: number; Total: number; Unidades: number }>;
    for (const r of rows) {
        map.set(r.CodigoInterno, { total: Number(r.Total || 0), unidades: Number(r.Unidades || 0) });
    }
    return map;
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const rawStoreIds: number[] = Array.isArray(body.storeIds) ? body.storeIds : [];
        const storeIds = rawStoreIds.map(n => Number(n)).filter(n => Number.isFinite(n));
        const horizonDays = Math.max(1, Math.min(180, Number(body.horizonDays) || 30));

        const today = new Date();
        const recentEnd = today;
        const recentStart = new Date(today.getTime() - 30 * DAY_MS);
        const priorEnd = recentStart;
        const priorStart = new Date(recentStart.getTime() - 30 * DAY_MS);

        // Forecast horizon last year
        const horizonStart = new Date(today.getTime() + DAY_MS);
        const horizonEnd = new Date(today.getTime() + horizonDays * DAY_MS);
        const lyHorizonStart = new Date(horizonStart.getTime() - 365 * DAY_MS);
        const lyHorizonEnd = new Date(horizonEnd.getTime() - 365 * DAY_MS);

        // LY baseline: 30 days before LY horizon (to compute seasonality ratio)
        const lyBaselineEnd = lyHorizonStart;
        const lyBaselineStart = new Date(lyHorizonStart.getTime() - 30 * DAY_MS);

        const [recentTop, lyHorizonTop] = await Promise.all([
            topProducts(toISO(recentStart), toISO(recentEnd), storeIds, 25),
            topProducts(toISO(lyHorizonStart), toISO(lyHorizonEnd), storeIds, 25),
        ]);

        // Dedupe by CodigoInterno
        const byCode = new Map<number, ProductRow>();
        for (const r of recentTop) byCode.set(r.CodigoInterno, r);
        for (const r of lyHorizonTop) {
            if (!byCode.has(r.CodigoInterno)) byCode.set(r.CodigoInterno, r);
        }
        const allCodes = Array.from(byCode.keys());

        if (allCodes.length === 0) {
            return NextResponse.json({
                narrative: 'No hay datos suficientes para generar sugerencias en este período/scope.',
                tone: 'neutral',
                products: [],
                generatedAt: new Date().toISOString(),
            });
        }

        // Fetch the other windows' totals for the merged set
        const [priorTotals, lyHorizonTotals, lyBaselineTotals, recentTotals] = await Promise.all([
            totalsForProducts(allCodes, toISO(priorStart), toISO(priorEnd), storeIds),
            totalsForProducts(allCodes, toISO(lyHorizonStart), toISO(lyHorizonEnd), storeIds),
            totalsForProducts(allCodes, toISO(lyBaselineStart), toISO(lyBaselineEnd), storeIds),
            totalsForProducts(allCodes, toISO(recentStart), toISO(recentEnd), storeIds),
        ]);

        type Enriched = {
            codigoInterno: number;
            descripcion: string;
            depto: string;
            recentTotal: number;
            recentUnits: number;
            priorTotal: number;
            recentGrowthPct: number;
            lyHorizonTotal: number;
            lyHorizonUnits: number;
            lyBaselineTotal: number;
            seasonalityRatio: number;
            score: number;
        };

        const enriched: Enriched[] = allCodes.map(code => {
            const meta = byCode.get(code)!;
            const recent = recentTotals.get(code) || { total: 0, unidades: 0 };
            const prior = priorTotals.get(code) || { total: 0, unidades: 0 };
            const lyH = lyHorizonTotals.get(code) || { total: 0, unidades: 0 };
            const lyB = lyBaselineTotals.get(code) || { total: 0, unidades: 0 };

            const recentGrowthPct = prior.total > 0 ? (recent.total - prior.total) / prior.total : 0;
            const seasonalityRatio = lyB.total > 0 ? lyH.total / lyB.total : (lyH.total > 0 ? 2 : 1);

            const score = recent.total * 0.6 + lyH.total * 0.4
                + Math.max(0, recentGrowthPct) * 10000
                + Math.max(0, seasonalityRatio - 1) * 5000;

            return {
                codigoInterno: code,
                descripcion: meta.Descripcion,
                depto: meta.Depto,
                recentTotal: recent.total,
                recentUnits: recent.unidades,
                priorTotal: prior.total,
                recentGrowthPct,
                lyHorizonTotal: lyH.total,
                lyHorizonUnits: lyH.unidades,
                lyBaselineTotal: lyB.total,
                seasonalityRatio,
                score,
            };
        });

        enriched.sort((a, b) => b.score - a.score);
        const topForAi = enriched.slice(0, 25);

        const fmtMxn = (n: number) => new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 }).format(n);
        const fmtPct = (n: number) => `${(n * 100).toFixed(0)}%`;
        const scopeText = storeIds.length === 0 ? 'todas las sucursales' : `${storeIds.length} sucursal(es) seleccionada(s)`;
        const horizonText = `próximos ${horizonDays} días (${toISO(horizonStart)} a ${toISO(horizonEnd)})`;
        const lyHorizonText = `${toISO(lyHorizonStart)} a ${toISO(lyHorizonEnd)}`;

        const tableLines = topForAi.map(p => {
            return `#${p.codigoInterno} | ${p.descripcion.slice(0, 40).padEnd(40)} | ${p.depto.slice(0, 14).padEnd(14)} | reciente $${fmtMxn(p.recentTotal)} (${p.recentGrowthPct >= 0 ? '+' : ''}${fmtPct(p.recentGrowthPct)}) | LY mismo período $${fmtMxn(p.lyHorizonTotal)} (×${p.seasonalityRatio.toFixed(2)})`;
        }).join('\n');

        const prompt = `Eres Kesito, consultor de retail mexicano. Estás recomendando qué productos vale la pena empujar, cargar inventario, monitorear o reducir para los próximos días.

CONTEXTO:
- Horizonte de planeación: ${horizonText}
- Sucursales: ${scopeText}
- Ventana reciente: últimos 30 días
- Mismo período del año pasado: ${lyHorizonText}

TABLA DE PRODUCTOS (top ${topForAi.length} por relevancia combinada):
${tableLines}

DEFINICIONES:
- "stock_up" = el año pasado vendió fuerte este mismo período (oportunidad estacional clara, ratio LY/baseline > 1.4)
- "push"     = tendencia reciente claramente positiva, vale la pena empujar
- "monitor"  = señales mixtas, vigilar
- "reduce"   = tendencia decreciente sin soporte estacional

INSTRUCCIONES:
1. Escribe UN PÁRRAFO (2-4 oraciones) de narrativa explicando las 2-3 oportunidades más fuertes del horizonte. Usa **negritas Markdown** para cifras y nombres. Tono profesional pero humano, en español de México.
2. Para CADA producto (todos los ${topForAi.length}) decide una acción y una razón corta (máx 80 caracteres).
3. Determina el TONO general: "positive" (varias oportunidades claras), "attention" (riesgos o caídas relevantes), "neutral" (mix sin destacar).

RESPONDE SOLO EN JSON (sin markdown alrededor):
{
  "narrative": "Párrafo con **negritas** en cifras y nombres",
  "tone": "positive" | "attention" | "neutral",
  "products": [
    { "codigoInterno": 12345, "action": "stock_up", "reason": "Vendió ×1.8 mismo período LY" }
  ]
}`;

        const response = await anthropic.messages.create({
            model: ANTHROPIC_MODEL_CHEAP,
            max_tokens: 2500,
            messages: [{ role: 'user', content: prompt }],
        });

        const text = (response.content[0] as { text?: string })?.text || '';
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        let aiResult: {
            narrative?: string;
            tone?: 'positive' | 'attention' | 'neutral';
            products?: Array<{ codigoInterno: number; action: Action; reason: string }>;
        } = {};
        if (start >= 0 && end > start) {
            try {
                aiResult = JSON.parse(text.substring(start, end + 1));
            } catch {
                aiResult = {};
            }
        }

        const reasonByCode = new Map<number, { action: Action; reason: string }>();
        for (const p of aiResult.products || []) {
            if (typeof p.codigoInterno === 'number') {
                reasonByCode.set(p.codigoInterno, { action: p.action, reason: p.reason });
            }
        }

        const productsOut = topForAi.map(p => {
            const ai = reasonByCode.get(p.codigoInterno);
            return {
                codigoInterno: p.codigoInterno,
                descripcion: p.descripcion,
                depto: p.depto,
                action: ai?.action || 'monitor',
                reason: ai?.reason || '',
                recentTotal: p.recentTotal,
                recentUnits: p.recentUnits,
                recentGrowthPct: p.recentGrowthPct,
                lyHorizonTotal: p.lyHorizonTotal,
                lyHorizonUnits: p.lyHorizonUnits,
                seasonalityRatio: p.seasonalityRatio,
            };
        });

        return NextResponse.json({
            narrative: aiResult.narrative || 'No se generó narrativa.',
            tone: aiResult.tone || 'neutral',
            products: productsOut,
            generatedAt: new Date().toISOString(),
        });
    } catch (error: unknown) {
        console.error('product-recommendations error:', error);
        const msg = error instanceof Error ? error.message : 'Error generando sugerencias';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
