import { NextResponse } from 'next/server';
import { anthropic } from '@/lib/anthropic';
import { openai } from '@/lib/ai';
import { getUserId } from '@/lib/conversations';
import { getReportById } from '@/lib/advanced-reports/reports-store';
import { substituteParams } from '@/lib/advanced-reports/params';
import { getModel } from '@/lib/advanced-reports/models';
import { assertReadOnly } from '@/lib/sql-sandbox';
import { query } from '@/lib/db';
import { costUsd, costMxn, USD_MXN_RATE } from '@/lib/pricing';
import { recordMetric } from '@/lib/metrics';

export const runtime = 'nodejs';

function buildAnalysisPrompt(title: string, description: string | undefined, rows: any[]): string {
    const sample = rows.slice(0, 50);
    const dataStr = JSON.stringify(sample).slice(0, 8000);
    return `Eres un consultor senior de retail. Analiza los datos ACTUALES de este reporte y da una lectura accionable.

REPORTE: ${title}
${description ? `DESCRIPCIÓN: ${description}` : ''}
FILAS (${rows.length} en total, muestra de ${sample.length}): ${dataStr}

Responde SOLO con un JSON válido (sin markdown), en español:
{
  "narrative": "2-4 oraciones con la lectura principal. Cifras con **negritas Markdown** (ej. **$1.2M**, **+12%**).",
  "insights": ["3-4 hallazgos concretos con dato"],
  "recommendations": ["1-3 acciones recomendadas"]
}`;
}

function parseJsonLoose(text: string): any {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) return {};
    try { return JSON.parse(text.substring(start, end + 1)); } catch { return {}; }
}

/**
 * POST /api/agent/advanced/reports/[id]/analyze
 *
 * "Modo IA" del reporte: re-ejecuta el SQL (read-only) para tener datos FRESCOS
 * y los analiza con el MODELO elegido (Claude u OpenAI). NO modifica el reporte;
 * es un análisis bajo demanda. Devuelve narrativa + hallazgos + costo real.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const startTime = Date.now();
    const { id } = await params;
    const idReporte = Number(id);
    if (!Number.isFinite(idReporte) || idReporte <= 0) {
        return NextResponse.json({ error: 'id inválido' }, { status: 400 });
    }

    const userId = await getUserId().catch(() => 'anonymous');
    const body = await req.json().catch(() => ({}));
    const model = getModel(body?.model);

    const report = await getReportById(userId, idReporte);
    if (!report || !report.definition) {
        return NextResponse.json({ error: 'Reporte no encontrado' }, { status: 404 });
    }

    const def = report.definition;
    try {
        // Datos frescos con los valores por defecto de los parámetros
        const sql = assertReadOnly(substituteParams(def.sql, def.params));
        const rows = (await query(sql)) as any[];

        if (rows.length === 0) {
            return NextResponse.json({ error: 'El reporte no devolvió datos para analizar.' }, { status: 400 });
        }

        const prompt = buildAnalysisPrompt(report.titulo, def.description, rows);

        let text = '';
        let inTok = 0;
        let outTok = 0;

        if (model.provider === 'anthropic') {
            const resp = await anthropic.messages.create({
                model: model.id,
                max_tokens: 1500,
                messages: [{ role: 'user', content: prompt }],
            });
            text = (resp.content.find((c: any) => c.type === 'text') as any)?.text || '';
            inTok = resp.usage?.input_tokens || 0;
            outTok = resp.usage?.output_tokens || 0;
        } else {
            const resp = await openai.chat.completions.create({
                model: model.id,
                max_tokens: 1500,
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' },
            });
            text = resp.choices[0]?.message?.content || '';
            inTok = resp.usage?.prompt_tokens || 0;
            outTok = resp.usage?.completion_tokens || 0;
        }

        const parsed = parseJsonLoose(text);
        const usd = costUsd(inTok, outTok, model.inputUsdPerMTok, model.outputUsdPerMTok);
        const mxn = costMxn(usd);

        void recordMetric({
            userId,
            endpoint: '/api/agent/advanced/analyze',
            model: model.id,
            streaming: false,
            tokensInput: inTok,
            tokensOutput: outTok,
            latencyMs: Date.now() - startTime,
            status: 'ok',
            extra: { idReporte, costoUsd: usd, costoMxn: mxn, provider: model.provider },
        });

        return NextResponse.json({
            model: model.id,
            modelLabel: model.label,
            narrative: parsed.narrative || text.slice(0, 600),
            insights: Array.isArray(parsed.insights) ? parsed.insights : [],
            recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
            cost: { tokensInput: inTok, tokensOutput: outTok, costUsd: usd, costMxn: mxn, usdMxnRate: USD_MXN_RATE },
            rowCount: rows.length,
        });
    } catch (e: any) {
        const msg = e?.message || 'Error analizando el reporte';
        void recordMetric({
            userId,
            endpoint: '/api/agent/advanced/analyze',
            model: model.id,
            status: 'error',
            errorMsg: msg,
            latencyMs: Date.now() - startTime,
        });
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
