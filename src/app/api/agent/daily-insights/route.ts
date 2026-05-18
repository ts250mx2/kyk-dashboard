import { NextResponse } from 'next/server';
import { anthropic } from '@/lib/anthropic';
import { openai } from '@/lib/ai';
import { query } from '@/lib/db';
import { INSIGHT_SCANNERS, getScannersByPriority } from '@/lib/insights-scanners';
import fs from 'fs';
import path from 'path';

interface Insight {
    id: string;
    question: string;
    severity: 'critical' | 'opportunity' | 'info';
    area: string;
    detected_at: string;
    summary: string;
}

interface DailyInsightsCache {
    date: string;
    executed_scanner_ids: string[];
    insights: Insight[];
    briefing?: string;
    briefing_generated_at?: string;
    last_updated: string;
}

const CACHE_FILE = path.join(process.cwd(), '.cache', 'daily-insights.json');
const MAX_INSIGHTS = 12;
const SCANNERS_PER_RUN = 4;

function getTodayKey(): string {
    return new Date().toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City' });
}

function ensureCacheDir() {
    const dir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function readCache(): DailyInsightsCache | null {
    try {
        if (!fs.existsSync(CACHE_FILE)) return null;
        const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
        const parsed: DailyInsightsCache = JSON.parse(raw);
        if (parsed.date !== getTodayKey()) return null;
        return parsed;
    } catch {
        return null;
    }
}

function writeCache(cache: DailyInsightsCache) {
    try {
        ensureCacheDir();
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
    } catch (e) {
        console.error('Error writing insights cache:', e);
    }
}

async function generateInsightsFromScannerData(
    scannerResults: Array<{ id: string; area: string; label: string; data: any[] }>,
    model: 'claude' | 'openai' = 'claude'
): Promise<Insight[]> {
    const dataDescription = scannerResults
        .map(r => `[${r.area.toUpperCase()}] ${r.label}\nDatos: ${JSON.stringify(r.data.slice(0, 5))}`)
        .join('\n\n');

    const systemPrompt = `Eres un Analista de Datos Senior especializado en retail. Analiza los datos
proporcionados y genera hallazgos accionables.

Para cada hallazgo significativo, formúlalo como una PREGUNTA que el usuario podría hacer
al agente para profundizar. La pregunta debe ser específica, basada en el dato observado.

Cada hallazgo debe tener:
- scanner_id: el ID del scanner del que proviene
- question: pregunta específica y accionable (máximo 80 caracteres)
- severity: "critical" (problema urgente), "opportunity" (oportunidad), "info" (informativo)
- area: ventas|cancelaciones|productos|operacion|compras
- summary: 1 oración corta describiendo el hallazgo (máximo 100 caracteres)

PRIORIDADES:
1. CRITICAL: caídas drásticas, cancelaciones anormales, sucursales en problemas
2. OPPORTUNITY: crecimientos destacados, productos en alza, horarios pico
3. INFO: datos relevantes pero sin urgencia

EJEMPLOS DE PREGUNTAS:
- "¿Por qué Sucursal Centro cayó 25% vs ayer?"
- "¿Qué productos están impulsando el crecimiento de ABARROTES?"
- "¿Cuáles cancelaciones de hoy requieren revisión?"

NO formules preguntas genéricas como "¿Cómo van las ventas?". DEBEN incluir el dato específico.

RETORNA JSON:
{
  "insights": [
    {
      "scanner_id": "id_del_scanner",
      "question": "Pregunta específica con dato",
      "severity": "critical|opportunity|info",
      "area": "ventas|cancelaciones|productos|operacion|compras",
      "summary": "Resumen del hallazgo"
    }
  ]
}`;

    let parsed: { insights: any[] } = { insights: [] };
    try {
        if (model === 'claude') {
            const response = await anthropic.messages.create({
                model: 'claude-opus-4-6',
                max_tokens: 2048,
                messages: [
                    { role: 'user', content: `${systemPrompt}\n\nDATOS A ANALIZAR:\n${dataDescription}\n\nRETORNA SOLO JSON VÁLIDO.` }
                ]
            });
            const content = (response.content[0] as any).text;
            const jsonStr = content.substring(content.indexOf('{'), content.lastIndexOf('}') + 1);
            parsed = JSON.parse(jsonStr);
        } else {
            const response = await openai.chat.completions.create({
                model: 'gpt-4o',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `DATOS A ANALIZAR:\n${dataDescription}` }
                ],
                response_format: { type: 'json_object' }
            });
            parsed = JSON.parse(response.choices[0].message.content || '{"insights":[]}');
        }
    } catch (e) {
        console.error('Error generando hallazgos con IA:', e);
        return [];
    }

    const now = new Date().toISOString();
    return (parsed.insights || []).map((ins: any) => ({
        id: `${ins.scanner_id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        question: ins.question,
        severity: ins.severity || 'info',
        area: ins.area || 'ventas',
        detected_at: now,
        summary: ins.summary || ''
    }));
}

async function generateNarrativeBriefing(insights: Insight[]): Promise<string> {
    if (insights.length === 0) {
        return "Buen día. Aún no hay suficientes datos del día para un análisis profundo, pero estoy listo para cuando quieras empezar a revisar la operación.";
    }

    const insightsForPrompt = insights.slice(0, 8).map(i =>
        `[${i.severity.toUpperCase()}] ${i.area}: ${i.summary}`
    ).join('\n');

    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Buen día' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';

    const briefingPrompt = `Eres Kesito, consultor senior conversacional para KYK retail.
Vas a generar un BRIEFING editorial al estilo de Wall Street Journal pero corto.

Inicia con "${greeting}". Escribe un párrafo único (3-5 oraciones máximo) que:
1. Resuma el estado del negocio hoy con tono profesional pero humano
2. Mencione las 2-3 cosas más importantes (críticos primero, luego oportunidades)
3. Use cifras concretas con **negritas Markdown** cuando estén disponibles
4. Termine con una invitación natural a empezar (no formal, no preguntando)

NO uses bullets, NO uses encabezados, NO listes los hallazgos uno por uno.
Conviertelos en prosa narrativa fluida.

NUNCA digas "los hallazgos son" o "voy a contarte". Solo cuéntalo.

Hallazgos detectados hoy:
${insightsForPrompt}

Genera SOLO el párrafo de briefing, sin comillas, sin metadata, sin JSON.`;

    try {
        const response = await anthropic.messages.create({
            model: 'claude-opus-4-6',
            max_tokens: 512,
            messages: [{ role: 'user', content: briefingPrompt }]
        });
        const text = (response.content[0] as any).text;
        return text.trim();
    } catch (e) {
        console.error('Error generando briefing:', e);
        // Fallback narrativo simple
        const critical = insights.filter(i => i.severity === 'critical').length;
        const opportunities = insights.filter(i => i.severity === 'opportunity').length;
        return `${greeting}. Hoy detecté ${insights.length} señales relevantes en la operación${critical > 0 ? `, ${critical} de ellas merecen atención inmediata` : ''}${opportunities > 0 ? ` y ${opportunities} son oportunidades a evaluar` : ''}. Cuéntame por dónde quieres empezar.`;
    }
}

function rankInsights(insights: Insight[]): Insight[] {
    const severityWeight = { critical: 3, opportunity: 2, info: 1 };
    return [...insights].sort((a, b) => {
        const sevDiff = (severityWeight[b.severity] || 0) - (severityWeight[a.severity] || 0);
        if (sevDiff !== 0) return sevDiff;
        return new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime();
    });
}

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const forceRefresh = url.searchParams.get('refresh') === 'true';
        const limit = parseInt(url.searchParams.get('limit') || '6', 10);

        let cache = readCache();

        if (forceRefresh || !cache) {
            cache = {
                date: getTodayKey(),
                executed_scanner_ids: [],
                insights: [],
                last_updated: new Date().toISOString()
            };
        }

        // Si ya tenemos suficientes hallazgos del día, devolvemos directamente
        if (cache.insights.length >= limit && !forceRefresh) {
            const ranked = rankInsights(cache.insights);

            // Generar briefing si aún no existe para hoy
            if (!cache.briefing) {
                cache.briefing = await generateNarrativeBriefing(ranked);
                cache.briefing_generated_at = new Date().toISOString();
                writeCache(cache);
            }

            return NextResponse.json({
                date: cache.date,
                briefing: cache.briefing,
                total_insights: cache.insights.length,
                executed_scanners: cache.executed_scanner_ids.length,
                total_scanners: INSIGHT_SCANNERS.length,
                insights: ranked.slice(0, limit),
                from_cache: true
            });
        }

        // Ejecutar scanners pendientes (incremental)
        const pendingScanners = getScannersByPriority(cache.executed_scanner_ids).slice(0, SCANNERS_PER_RUN);

        if (pendingScanners.length === 0 && cache.insights.length === 0) {
            // Todos los scanners se ejecutaron pero no hubo hallazgos
            return NextResponse.json({
                date: cache.date,
                total_insights: 0,
                insights: [],
                message: 'No se detectaron hallazgos relevantes hoy.'
            });
        }

        // Ejecutar los scanners en paralelo
        const scannerResults: Array<{ id: string; area: string; label: string; data: any[] }> = [];

        await Promise.all(
            pendingScanners.map(async (scanner) => {
                try {
                    const data = await query(scanner.sql);
                    scannerResults.push({
                        id: scanner.id,
                        area: scanner.area,
                        label: scanner.label,
                        data: data as any[]
                    });
                    cache!.executed_scanner_ids.push(scanner.id);
                } catch (e: any) {
                    console.error(`Scanner ${scanner.id} failed:`, e.message);
                    cache!.executed_scanner_ids.push(scanner.id);
                }
            })
        );

        if (scannerResults.length > 0) {
            const newInsights = await generateInsightsFromScannerData(scannerResults);
            cache.insights = [...cache.insights, ...newInsights].slice(0, MAX_INSIGHTS);
            cache.last_updated = new Date().toISOString();
            // Briefing se regenera cuando hay nuevos hallazgos
            cache.briefing = undefined;
            writeCache(cache);
        }

        const ranked = rankInsights(cache.insights);

        // Generar briefing narrativo basado en hallazgos actuales
        if (!cache.briefing && ranked.length > 0) {
            cache.briefing = await generateNarrativeBriefing(ranked);
            cache.briefing_generated_at = new Date().toISOString();
            writeCache(cache);
        }

        return NextResponse.json({
            date: cache.date,
            briefing: cache.briefing || null,
            total_insights: cache.insights.length,
            executed_scanners: cache.executed_scanner_ids.length,
            total_scanners: INSIGHT_SCANNERS.length,
            insights: ranked.slice(0, limit),
            from_cache: false
        });

    } catch (error: any) {
        console.error('Error en daily-insights:', error);
        return NextResponse.json({
            error: error.message || 'Error generando hallazgos',
            insights: []
        }, { status: 500 });
    }
}

// POST para forzar regeneración o reset
export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => ({}));
        if (body.action === 'reset') {
            if (fs.existsSync(CACHE_FILE)) {
                fs.unlinkSync(CACHE_FILE);
            }
            return NextResponse.json({ success: true, message: 'Cache reseteado' });
        }
        return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
