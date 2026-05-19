import { NextResponse } from 'next/server';
import { anthropic } from '@/lib/anthropic';

interface PageControlRequest {
    prompt: string;
    currentFilters: {
        fechaInicio?: string;
        fechaFin?: string;
        storeIds?: string[];
        metric?: string;
        search?: string;
        groupBy?: string;
    };
    availableMetrics?: string[];
    availableStores?: Array<{ IdTienda: number | string; Tienda: string }>;
    dashboardType?: 'clients' | 'margins';
}

export async function POST(req: Request) {
    try {
        const body: PageControlRequest = await req.json();
        const { prompt, currentFilters, availableMetrics = [], availableStores = [], dashboardType = 'clients' } = body;

        if (!prompt || !prompt.trim()) {
            return NextResponse.json({ error: 'Prompt requerido' }, { status: 400 });
        }

        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
        const storesContext = availableStores.slice(0, 30).map(s => `${s.IdTienda}: ${s.Tienda}`).join('\n');
        const metricsList = availableMetrics.length > 0 ? availableMetrics.join(', ') : 'contado, credito, publico, notas';

        const isMargins = dashboardType === 'margins';
        let systemPrompt = '';

        if (isMargins) {
            systemPrompt = `Eres un asistente que traduce preguntas en español a comandos para reconfigurar un dashboard de Márgenes de Utilidad y Rentabilidad.

CONTEXTO DEL DASHBOARD:
- Fecha actual: ${today}
- Sucursales disponibles (IdTienda: nombre):
${storesContext}

FILTROS ACTUALES:
- Periodo: ${currentFilters.fechaInicio || '?'} a ${currentFilters.fechaFin || '?'}
- Sucursales seleccionadas: ${currentFilters.storeIds?.length ? currentFilters.storeIds.join(',') : 'todas'}
- Agrupación activa (groupBy): ${currentFilters.groupBy || 'sucursal'} (las opciones válidas son: 'sucursal', 'depto', 'categoria', 'marca', 'proveedor', 'articulo')
- Búsqueda activa (search): ${currentFilters.search || '(vacía)'}

REGLAS:
1. Interpreta el período del usuario:
   - "hoy" → fechaInicio = fechaFin = hoy
   - "ayer" → fechaInicio = fechaFin = ayer
   - "este mes" → fechaInicio = primer día del mes actual, fechaFin = hoy
   - "mes pasado" → fechaInicio = primer día mes anterior, fechaFin = último día mes anterior
   - "esta semana" → fechaInicio = lunes pasado, fechaFin = hoy
   - "últimos N días" → fechaInicio = hoy - N+1, fechaFin = hoy

2. Interpreta sucursales:
   - Si menciona nombres de sucursales, devuelve los IdTienda correspondientes
   - Si menciona "todas" o "todos", storeIds = []
   - Si no menciona sucursal, NO incluyas storeIds en updates

3. Interpreta agrupación (groupBy):
   - Si dice "agrupar por tienda", "por sucursal", "por local" → groupBy = 'sucursal'
   - Si dice "agrupar por depto", "por departamento" → groupBy = 'depto'
   - Si dice "agrupar por categoría" → groupBy = 'categoria'
   - Si dice "agrupar por marca", "por familia" → groupBy = 'marca'
   - Si dice "agrupar por proveedor" → groupBy = 'proveedor'
   - Si dice "agrupar por artículo", "por producto" → groupBy = 'articulo'
   - Si no menciona agrupación, NO incluyas groupBy en updates

4. Si menciona buscar un artículo, categoría o texto en específico → updates.search = "texto buscado"
5. Si la pregunta es ambigua o no aplica → action='noop'

ESTRUCTURA DE RESPUESTA (SOLO JSON, sin markdown):
{
  "action": "update_filters" | "noop",
  "updates": {
    "fechaInicio": "YYYY-MM-DD",       // omitir si no aplica
    "fechaFin": "YYYY-MM-DD",          // omitir si no aplica
    "storeIds": ["12", "15"],          // array de strings, omitir si no aplica
    "groupBy": "depto",                // 'sucursal'|'depto'|'categoria'|'marca'|'proveedor'|'articulo', omitir si no aplica
    "search": "Coca Cola"              // omitir si no aplica
  },
  "message": "Entendí: agrupar los márgenes por departamento para este mes",
  "confidence": "high" | "medium" | "low"
}

Pregunta del usuario: "${prompt}"

Responde SOLO con el JSON.`;
        } else {
            systemPrompt = `Eres un asistente que traduce preguntas en español a comandos para reconfigurar un dashboard de ventas a clientes.

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

Pregunta del usuario: "${prompt}"

Responde SOLO con el JSON.`;
        }

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
