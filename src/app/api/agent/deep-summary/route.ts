import { NextResponse } from 'next/server';
import { anthropic, ANTHROPIC_MODEL_FAST } from '@/lib/anthropic';

/**
 * POST /api/agent/deep-summary
 *
 * Versión "profunda" del page-summary. Mismo input pero devuelve un análisis
 * estructurado en secciones (executive summary, insights, oportunidades,
 * riesgos, acciones recomendadas).
 *
 * Usa Sonnet (más capacidad) en vez de Haiku porque el output es 5-10×
 * más largo y necesita razonamiento estructurado.
 */

interface DeepSummaryRequest {
    pageContext?: string;
    period?: { fechaInicio?: string; fechaFin?: string };
    scope?: string;
    kpis?: Record<string, any>;
    highlights?: {
        topStores?: Array<{ name: string; value: number }>;
        topItems?: Array<{ name: string; value: number }>;
        anomalies?: string[];
    };
}

function formatPeriod(p?: { fechaInicio?: string; fechaFin?: string }): string {
    if (!p?.fechaInicio || !p?.fechaFin) return 'período no especificado';
    if (p.fechaInicio === p.fechaFin) return `el ${p.fechaInicio}`;
    return `del ${p.fechaInicio} al ${p.fechaFin}`;
}

export async function POST(req: Request) {
    try {
        const body: DeepSummaryRequest = await req.json();
        const { pageContext = 'el dashboard', period, scope, kpis = {}, highlights } = body;

        const periodText = formatPeriod(period);
        const scopeText = scope || 'todas las sucursales';

        const kpiLines = Object.entries(kpis)
            .filter(([, v]) => typeof v === 'number')
            .map(([k, v]) => `  ${k}: ${typeof v === 'number' && v >= 1000 ? new Intl.NumberFormat('es-MX').format(v) : v}`)
            .join('\n');

        const highlightsText = [
            highlights?.topStores?.length
                ? `Top sucursales/elementos:\n${highlights.topStores.slice(0, 10).map((s, i) => `  ${i + 1}. ${s.name}: ${s.value.toLocaleString('es-MX')}`).join('\n')}`
                : null,
            highlights?.topItems?.length
                ? `Top items:\n${highlights.topItems.slice(0, 10).map((it, i) => `  ${i + 1}. ${it.name}: ${it.value.toLocaleString('es-MX')}`).join('\n')}`
                : null,
            highlights?.anomalies?.length
                ? `Anomalías detectadas:\n${highlights.anomalies.map(a => `  - ${a}`).join('\n')}`
                : null
        ].filter(Boolean).join('\n\n');

        const prompt = `Eres Kesito, consultor senior de retail. Vas a hacer un ANÁLISIS PROFUNDO
de ${pageContext} con el snapshot actual de datos.

CONTEXTO:
- Reporte: ${pageContext}
- Período: ${periodText}
- Alcance: ${scopeText}

KPIs visibles:
${kpiLines || '  (sin KPIs)'}

${highlightsText || ''}

TU TAREA:
Genera un análisis estructurado en 5 secciones. Sé directo, usa cifras concretas
con **negritas Markdown**, evita relleno corporativo.

RESPONDE EN JSON ESTRICTO (sin markdown wrapper):
{
  "executiveSummary": "2-3 oraciones con la foto general del reporte. Cifra principal + dirección + 1 observación clave.",
  "keyInsights": [
    "3-5 hallazgos concretos con dato cuantificado. Ejemplo: 'El **top 3** concentra el **62%** del total, dejando una larga cola de bajo aporte.'",
    "..."
  ],
  "opportunities": [
    "2-4 oportunidades accionables basadas en los datos. Específicas, no genéricas. Ej: 'Reactivar **CocaCola** que cayó **-18%** vs mes anterior con campaña local.'",
    "..."
  ],
  "risks": [
    "1-3 riesgos o alertas si los datos los sugieren (concentración, caídas, dependencia). Si no hay riesgos claros, devuelve [].",
    "..."
  ],
  "recommendedActions": [
    "2-4 acciones concretas a tomar AHORA con responsable implícito (revisar, contactar, ajustar precio, etc.). Cada acción en imperativo y con métrica esperada cuando aplique.",
    "..."
  ]
}

REGLAS:
- TODO en español
- Cifras con **negritas Markdown** SIEMPRE
- Sin emojis (excepto si el contexto los amerita)
- NO inventes datos que no estén en KPIs/highlights
- Si los datos son insuficientes en alguna sección, devuelve array vacío
- Sé honesto: si el reporte se ve normal/sano, dilo en executiveSummary

Devuelve SOLO el JSON.`;

        const response = await anthropic.messages.create({
            model: ANTHROPIC_MODEL_FAST,
            max_tokens: 2000,
            messages: [{ role: 'user', content: prompt }]
        });

        const text = (response.content[0] as any)?.text || '';
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');

        let result: any = {};
        if (start >= 0 && end > start) {
            try {
                result = JSON.parse(text.substring(start, end + 1));
            } catch (e) {
                console.error('deep-summary JSON parse failed:', e);
                return NextResponse.json({ error: 'Error parseando respuesta del modelo' }, { status: 500 });
            }
        } else {
            return NextResponse.json({ error: 'Respuesta vacía del modelo' }, { status: 500 });
        }

        return NextResponse.json({
            executiveSummary: result.executiveSummary || '',
            keyInsights: Array.isArray(result.keyInsights) ? result.keyInsights : [],
            opportunities: Array.isArray(result.opportunities) ? result.opportunities : [],
            risks: Array.isArray(result.risks) ? result.risks : [],
            recommendedActions: Array.isArray(result.recommendedActions) ? result.recommendedActions : []
        });
    } catch (error: any) {
        console.error('deep-summary error:', error);
        return NextResponse.json(
            { error: error.message || 'Error generando análisis profundo' },
            { status: 500 }
        );
    }
}
