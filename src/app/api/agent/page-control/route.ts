import { NextResponse } from 'next/server';
import { anthropic } from '@/lib/anthropic';

/**
 * POST /api/agent/page-control
 *
 * Traduce una pregunta en lenguaje natural a una mutación del estado del
 * dashboard. NO ejecuta SQL ni cambia datos — solo decide qué filtros y
 * vista debe mostrar el dashboard, y opcionalmente devuelve un comentario
 * corto que explique qué entendió.
 *
 * Body: {
 *   prompt: string,                    // pregunta del usuario
 *   currentFilters: {                  // estado actual del dashboard
 *     fechaInicio: string,
 *     fechaFin: string,
 *     storeIds: string[],
 *     metric: 'contado'|'credito'|'publico'|'notas',
 *     search?: string
 *   },
 *   availableMetrics: string[],        // métricas que se pueden seleccionar
 *   availableStores: Array<{IdTienda, Tienda}>  // catálogo de tiendas
 * }
 *
 * Respuesta: {
 *   action: 'update_filters' | 'noop',
 *   updates: { fechaInicio?, fechaFin?, storeIds?, metric?, search? },
 *   message: string,                   // qué entendió, máx 1 oración
 *   confidence: 'high' | 'medium' | 'low'
 * }
 */

interface PageControlRequest {
    prompt: string;
    currentFilters: {
        fechaInicio?: string;
        fechaFin?: string;
        storeIds?: string[];
        metric?: string;
        search?: string;
    };
    availableMetrics?: string[];
    availableStores?: Array<{ IdTienda: number | string; Tienda: string }>;
}

export async function POST(req: Request) {
    try {
        const body: PageControlRequest = await req.json();
        const { prompt, currentFilters, availableMetrics = [], availableStores = [] } = body;

        if (!prompt || !prompt.trim()) {
            return NextResponse.json({ error: 'Prompt requerido' }, { status: 400 });
        }

        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
        const storesContext = availableStores.slice(0, 30).map(s => `${s.IdTienda}: ${s.Tienda}`).join('\n');
        const metricsList = availableMetrics.length > 0 ? availableMetrics.join(', ') : 'contado, credito, publico, notas';

        const systemPrompt = `Eres un asistente que traduce preguntas en español a comandos para reconfigurar
un dashboard de ventas a clientes.

CONTEXTO DEL DASHBOARD:
- Fecha actual: ${today}
- Métricas disponibles: ${metricsList}
- Sucursales (IdTienda: nombre):
${storesContext}

FILTROS ACTUALES:
- Periodo: ${currentFilters.fechaInicio || '?'} a ${currentFilters.fechaFin || '?'}
- Sucursales seleccionadas: ${currentFilters.storeIds?.length ? currentFilters.storeIds.join(',') : 'todas'}
- Métrica activa: ${currentFilters.metric || 'contado'}
- Búsqueda: ${currentFilters.search || '(vacía)'}

REGLAS:
1. Interpreta el período del usuario:
   - "hoy" → fechaInicio = fechaFin = hoy
   - "ayer" → fechaInicio = fechaFin = ayer
   - "este mes" → fechaInicio = primer día del mes actual, fechaFin = hoy
   - "mes pasado" → fechaInicio = primer día mes anterior, fechaFin = último día mes anterior
   - "esta semana" → fechaInicio = lunes pasado (o domingo según convención), fechaFin = hoy
   - "últimos N días" → fechaInicio = hoy - N+1, fechaFin = hoy
   - "ventas de mayo" → mes actual de ese mes, año actual si no se especifica

2. Interpreta sucursales:
   - Si menciona nombres de sucursales, devuelve los IdTienda correspondientes
   - Si menciona "todas" o "todos", storeIds = []
   - Si no menciona sucursal, NO incluyas storeIds en updates

3. Interpreta métrica:
   - "contado" o "efectivo" → 'contado'
   - "crédito" → 'credito'
   - "público general" o "público" → 'publico'
   - "notas de crédito" o "devoluciones" → 'notas'
   - Si no menciona métrica, NO incluyas metric en updates

4. Si la pregunta es ambigua (no se puede traducir confiablemente) → action='noop'
5. Si menciona buscar cliente o RFC específico → incluir en updates.search

ESTRUCTURA DE RESPUESTA (SOLO JSON, sin markdown):
{
  "action": "update_filters" | "noop",
  "updates": {
    "fechaInicio": "YYYY-MM-DD",       // omitir si no aplica
    "fechaFin": "YYYY-MM-DD",          // omitir si no aplica
    "storeIds": ["12", "15"],          // array de strings, omitir si no aplica
    "metric": "contado",               // omitir si no aplica
    "search": "ALPHA SRL"              // omitir si no aplica
  },
  "message": "Entendí: ventas a crédito de Centro y Norte este mes",
  "confidence": "high" | "medium" | "low"
}

EJEMPLOS:
- "ventas de centro este mes" → metric: queda igual, storeIds del Centro, fechas del mes
- "público general de hoy" → metric: publico, fechas hoy, sin tocar storeIds
- "compárame contado vs crédito" → action: noop, message: "Esta vista no soporta comparativas, prueba cambiar la métrica activa"

Pregunta del usuario: "${prompt}"

Responde SOLO con el JSON.`;

        const response = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1024,
            messages: [{ role: 'user', content: systemPrompt }]
        });

        const text = (response.content[0] as any)?.text || '';
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start < 0 || end <= start) {
            return NextResponse.json({
                action: 'noop',
                updates: {},
                message: 'No pude interpretar la pregunta. Intenta ser más específico con período y sucursal.',
                confidence: 'low'
            });
        }

        let parsed: any;
        try {
            parsed = JSON.parse(text.substring(start, end + 1));
        } catch {
            return NextResponse.json({
                action: 'noop',
                updates: {},
                message: 'Error interpretando la respuesta del modelo.',
                confidence: 'low'
            });
        }

        return NextResponse.json({
            action: parsed.action || 'noop',
            updates: parsed.updates || {},
            message: parsed.message || '',
            confidence: parsed.confidence || 'medium'
        });
    } catch (error: any) {
        console.error('page-control error:', error);
        return NextResponse.json(
            { error: error.message || 'Error procesando comando' },
            { status: 500 }
        );
    }
}
