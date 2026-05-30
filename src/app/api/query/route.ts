import { NextResponse } from 'next/server';
import { openai } from '@/lib/ai';
import { anthropic, ANTHROPIC_MODEL } from '@/lib/anthropic';
import { query } from '@/lib/db';
import { findRelevantReports } from '@/lib/available-reports';
import { assertReadOnly } from '@/lib/sql-sandbox';
import { createSseStream, SSE_HEADERS } from '@/lib/sse';
import { proposeFollowUp, FollowUpProposal } from '@/lib/investigator';
import {
    detectCausalIntent,
    generateHypotheses,
    executeHypotheses,
    generateDeepDive,
    formatHypothesesForPrompt,
    CausalHypothesisResult
} from '@/lib/causal-reasoner';
import { queryLimiter } from '@/lib/rate-limit';
import { getUserId } from '@/lib/conversations';
import { findRelevantPlaybookSteps } from '@/lib/playbooks';
import {
    detectForecastIntent,
    rowsToSeries,
    forecastSeries,
    formatForecastForPrompt,
    ForecastResult
} from '@/lib/forecasting';
import {
    runForecastForAgent,
    getProductRecommendationsForAgent,
    renderForecastSummaryForAgent,
    renderProductRecommendationsForAgent,
} from '@/lib/forecast/agent-tools';
import { saveMemory } from '@/lib/semantic-memory';
import { recordMetric } from '@/lib/metrics';
import fs from 'fs';
import path from 'path';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

const SECRET_KEY = new TextEncoder().encode(
    process.env.JWT_SECRET || 'your-secret-key-change-this-in-prod'
);

const META_MARKER = '---KESITO_META---';

const ANTHROPIC_TOOLS: any[] = [
    {
        name: 'query_database',
        description: 'Ejecuta análisis estratégico de datos en SQL Server para responder preguntas de negocio.',
        input_schema: {
            type: 'object',
            properties: {
                sql: {
                    type: 'string',
                    description: 'Consulta T-SQL optimizada para análisis de negocio. Incluye agregaciones, comparativas y KPIs.'
                }
            },
            required: ['sql']
        }
    },
    {
        name: 'suggest_reports',
        description: 'Recomienda reportes específicos del sistema para profundizar en el análisis.',
        input_schema: {
            type: 'object',
            properties: {
                main_insight: { type: 'string', description: 'El hallazgo principal que motivó las recomendaciones' },
                recommended_reports: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            report_name: { type: 'string', description: 'Nombre exacto del reporte' },
                            reason: { type: 'string', description: 'Por qué este reporte ayuda' },
                            expected_action: { type: 'string', description: 'Qué esperar del análisis' }
                        },
                        required: ['report_name', 'reason']
                    },
                    description: '2-3 reportes recomendados'
                }
            },
            required: ['main_insight', 'recommended_reports']
        }
    },
    {
        name: 'request_clarification',
        description: 'Solicita aclaración cuando hay ambigüedad temporal o de contexto.',
        input_schema: {
            type: 'object',
            properties: {
                message: { type: 'string', description: 'Pregunta clara y profesional para el usuario' },
                suggested_questions: {
                    type: 'array',
                    items: { type: 'string' },
                    description: '3 opciones contextuales que reflejan la pregunta original'
                }
            },
            required: ['message', 'suggested_questions']
        }
    },
    {
        name: 'get_sales_forecast',
        description: 'Devuelve la PROYECCIÓN DE VENTAS oficial del dashboard de Proyección de Ventas (promedio móvil estacional + ajuste por feriados mexicanos + proyección vs meta + tendencia + MAPE backtest). ÚSALA cuando la pregunta sea sobre el futuro: "¿cuánto vamos a vender la próxima semana?", "¿voy a llegar a la meta de mayo?", "¿proyección de Bodega 238 este mes?", "¿qué impacto tendrá Día de las Madres en la proyección?". NO la uses para datos históricos puros (eso es query_database).',
        input_schema: {
            type: 'object',
            properties: {
                horizonDays: {
                    type: 'number',
                    description: 'Días a proyectar hacia adelante (1-180). Default 30. Si el usuario dice "semana" usa 7, "quincena" usa 15, "mes" usa 30, "trimestre" usa 90.'
                },
                storeNames: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Nombres parciales de sucursales para filtrar (match LIKE %nombre%). Ej: ["Bodega 238", "Aramberri"]. Omite para considerar todas las sucursales.'
                }
            },
            required: []
        }
    },
    {
        name: 'get_product_recommendations',
        description: 'Devuelve los productos sugeridos a CARGAR/EMPUJAR/MONITOREAR/REDUCIR para los próximos N días, cruzando histórico reciente con mismo período del año pasado. Usa estacionalidad LY y crecimiento reciente para clasificar. ÚSALA cuando la pregunta sea: "¿qué productos cargar la próxima semana?", "¿qué empujar para Día de las Madres?", "¿en qué enfocarme la siguiente quincena?", "¿qué SKUs tienen oportunidad estacional ahora?".',
        input_schema: {
            type: 'object',
            properties: {
                horizonDays: { type: 'number', description: 'Días futuros a considerar para la oportunidad (1-180). Default 30.' },
                topN: { type: 'number', description: 'Cuántos productos devolver (5-30). Default 15.' },
                storeNames: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Nombres parciales de sucursales. Ej: ["Bodega 238"]. Omite para todas.'
                }
            },
            required: []
        }
    }
];

interface IncomingTurn {
    role: 'user' | 'assistant';
    content: string;
}

const MAX_HISTORY_TURNS = 8; // pares user/assistant que conservamos como contexto

function formatExecutedQueries(queries: Array<{ label: string; sql: string }>): string | null {
    if (queries.length === 0) return null;
    return queries
        .map(q => `-- ==========================================\n-- ${q.label.toUpperCase()}\n-- ==========================================\n${q.sql}`)
        .join('\n\n');
}

export async function POST(req: Request) {
    let prompt = 'Unknown Prompt';
    let lastSql: string | null = null;
    const executedQueries: Array<{ label: string; sql: string }> = [];
    let selectedModel = 'gpt-4o';
    const startTime = Date.now();
    const requestId = `req_${startTime.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    try {
        // Rate limit: 30 req/min por usuario para evitar abuso/runaway costs
        const userIdForLimit = await getUserId().catch(() => 'anonymous');
        const limit = queryLimiter.check(`query:${userIdForLimit}`);
        if (!limit.allowed) {
            void recordMetric({
                userId: userIdForLimit,
                endpoint: '/api/query',
                status: 'rate_limited',
                latencyMs: Date.now() - startTime,
                errorMsg: `Bloqueado por rate limit (${Math.ceil(limit.retryAfterMs / 1000)}s)`,
                extra: { requestId }
            });
            console.warn(`[${requestId}] rate-limited user=${userIdForLimit}`);
            return NextResponse.json({
                error: `Demasiadas consultas. Intenta de nuevo en ${Math.ceil(limit.retryAfterMs / 1000)}s.`,
                retry_after_ms: limit.retryAfterMs
            }, {
                status: 429,
                headers: {
                    'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)),
                    'X-RateLimit-Remaining': '0'
                }
            });
        }

        const body = await req.json();
        prompt = body.prompt;
        selectedModel = body.model || 'gpt-4o';
        const rawHistory: IncomingTurn[] = Array.isArray(body.history) ? body.history : [];

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        // Construir el array de mensajes para el modelo:
        // - Conservamos los últimos MAX_HISTORY_TURNS turnos previos (sin el user actual)
        // - Filtramos contenido vacío o ruido
        // - Truncamos cada turno a 4000 chars para evitar overflow
        const conversationHistory = rawHistory
            .filter(t => t && (t.role === 'user' || t.role === 'assistant') && typeof t.content === 'string' && t.content.trim())
            .slice(-MAX_HISTORY_TURNS * 2)
            .map(t => ({
                role: t.role,
                content: t.content.length > 4000 ? t.content.slice(0, 4000) + '…' : t.content
            }));

        // Asegurar que el primer mensaje sea de user (Anthropic lo requiere)
        while (conversationHistory.length > 0 && conversationHistory[0].role !== 'user') {
            conversationHistory.shift();
        }

        // Mensaje del turno actual (siempre se agrega al final)
        const messagesForModel = [...conversationHistory, { role: 'user' as const, content: prompt }];

        const schemaPath = path.join(process.cwd(), 'database-schema-ia.md');
        const schemaString = fs.readFileSync(schemaPath, 'utf-8');

        // Fetch dynamic AI rules from the database
        const aiRulesResults = await query(`
            SELECT 
                CONVERT(varchar(3),B.Consecutivo) + '.' + CONVERT(varchar(3),CASE WHEN A.Consecutivo IS NULL THEN 0 ELSE A.Consecutivo END) as RuleId, 
                Regla,
                B.PalabraClave as MatchedWord
            FROM tblReglasPalabrasClave A 
            INNER JOIN tblPalabrasClave B ON A.IdPalabraClave = B.IdPalabraClave 
            WHERE A.Status = 0 AND B.Status = 0 AND (B.Consecutivo = 1 OR (
                EXISTS (
                    SELECT 1 
                    FROM STRING_SPLIT(B.PalabraClave, ',') 
                    WHERE @p0 LIKE '%' + LTRIM(RTRIM(value)) + '%'
                    AND LTRIM(RTRIM(value)) <> ''
                )
                AND B.Consecutivo > 1
            ))
            ORDER BY B.Consecutivo, A.Consecutivo
        `, [prompt]);

        const aiRules = aiRulesResults as any[];
        const formattedRules = aiRules.map(r => `- ${r.RuleId} ${r.Regla}`).join('\n');

        const currentDateTime = new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });

        const availableReports = `
REPORTES DISPONIBLES EN LA APLICACIÓN:
================================

📊 VENTAS Y OPERACIONES:
- Overview General: Resumen integral de ventas, tickets, cancelaciones y métricas clave
- Operaciones de Ventas: Desglose por sucursal, tendencias horarias, ticket promedio
- Mapa de Calor: Análisis de horas pico, patrones de tráfico por hora del día
- Tendencias de Ventas: Evolución de productos, análisis de departamentos y familias
- Comparativa de Ventas: Comparación período actual vs período anterior (semanal, mensual)
- Cancelaciones por Tendencia: Análisis de cancelaciones por tipo, causa y evolución
- Alertas de Cancelaciones: Detección de cancelaciones anormales por sucursal y hora

💰 COMPRAS E INVENTARIO:
- Dashboard de Compras: Resumen de órdenes, recibos y distribución
- Órdenes de Compra: Estado de órdenes, proveedores, recibos programados
- Recibos y Consolidación: Desglose de recibos, comparativa compras vs devoluciones
- Distribución de Mercancía: Estatus de envíos a sucursales, eficiencia de surtido
- Rutas de Entrega: Eficiencia de rutas, retrasos, transportes y cumplimiento
- Facturas de Compra: Relaciones de facturas, conceptos, detalles por proveedor
- Dispersión de Compras: Análisis geográfico y de dispersión

🎯 METAS Y ANÁLISIS:
- Metas de Ventas: Seguimiento contra objetivos por concepto, sucursal y período
- Pareto de Productos: Análisis ABC/Pareto de productos más vendidos
- Análisis de Departamentos: Performance por departamento y familia de productos

⚙️ SISTEMA:
- Historial de Preguntas: Auditoría de consultas, usuarios activos, patrones de uso
- Aprendizaje IA: Reglas dinámicas para mejora continua del agente

INSTRUCCIONES DE RECOMENDACIÓN DE REPORTES:
- Cuando el usuario pregunte por análisis complejos, sugiere reportes específicos
- Relaciona la pregunta del usuario con el reporte más apropiado
- Proporciona nombres exactos de reportes para navegación rápida
- Combina múltiples reportes para análisis más profundos
`;

        const systemPrompt = `Eres Kesito, un consultor senior conversacional creado para KYK.
Tienes acceso de SOLO LECTURA a la base de datos del negocio y puedes ejecutar
consultas SQL para analizar ventas, compras, cancelaciones, productos y operación.

Pero ante todo eres un agente versátil al estilo Claude: puedes responder cualquier
pregunta (técnica, conceptual, de cultura general, código, ideas), no estás
limitado a temas del negocio. Cuando la pregunta involucra datos del negocio,
activas tus herramientas analíticas; cuando no, conversas normalmente.

FECHA Y HORA ACTUAL: ${currentDateTime}

──────────────────────────────────────────────────────────────
MEMORIA CONVERSACIONAL
──────────────────────────────────────────────────────────────
Recibes el historial reciente de la conversación. Úsalo para:
• Refinamientos cortos ("¿y por sucursal?", "ahora del mes pasado") →
  hereda el contexto del turno previo sin pedir aclaración
• Mantener consistencia de período/ámbito a lo largo de la charla
• No repetir información que ya diste recientemente
• Si el usuario corrige algo, ajusta tu enfoque desde ese momento

──────────────────────────────────────────────────────────────
SEGURIDAD ABSOLUTA (no negociable)
──────────────────────────────────────────────────────────────
NUNCA generes SQL que modifique datos. Está PROHIBIDO usar:
INSERT, UPDATE, DELETE, MERGE, TRUNCATE, DROP, CREATE, ALTER, EXEC,
GRANT, REVOKE, sp_*, xp_*, o múltiples statements separados por ';'.
Si el usuario pide modificar algo, responde con texto explicando que
solo puedes consultar datos, nunca cambiarlos.

──────────────────────────────────────────────────────────────
CUÁNDO USAR HERRAMIENTAS vs RESPONDER DIRECTO
──────────────────────────────────────────────────────────────

NO uses herramientas (responde directo con texto) cuando:
• El usuario te saluda o conversa casualmente
• Pregunta conceptos generales ("¿qué es un ticket promedio?")
• Pide explicaciones, definiciones, ayuda con código
• Hace preguntas filosóficas, opiniones, brainstorming
• Pregunta sobre la app/cómo navegar/qué reportes existen
• Solo necesita aclaración o tu opinión profesional

SÍ usa query_database cuando:
• Pide datos HISTÓRICOS concretos del negocio ("ventas de hoy", "top productos del mes pasado")
• Quiere comparativas reales con números de períodos cerrados
• Necesita análisis cuantitativo de operación

SÍ usa get_sales_forecast cuando la pregunta sea sobre el FUTURO:
• "¿cuánto vamos a vender la próxima semana/mes?"
• "¿voy a llegar a la meta de mayo?"
• "proyección de Bodega 238 / Aramberri / Lincoln este mes"
• "¿cómo viene el cierre?"
• "¿qué impacto tiene Día de las Madres en la proyección?"
• Acepta storeNames (parciales: ["Bodega 238"]) y horizonDays (semana=7, mes=30, trimestre=90).
• NO uses query_database para preguntas de proyección — el dashboard tiene
  un modelo más sofisticado (SMA estacional + holiday boosts + meta).

SÍ usa get_product_recommendations cuando la pregunta sea sobre PLANEAR PRODUCTOS:
• "¿qué productos cargar la próxima semana?"
• "¿qué empujar para Día de las Madres / Buen Fin / 15 de septiembre?"
• "¿en qué SKUs enfocarme la siguiente quincena en Bodega 238?"
• "productos con oportunidad estacional ahora"
• Cruza venta reciente con mismo período LY → acción sugerida por producto.

USA suggest_reports cuando puedas guiar al usuario a un reporte preexistente
en vez de generar análisis desde cero.

USA request_clarification (OBLIGATORIO) cuando la pregunta involucra una
tabla con columna de fecha (Ventas, Cancelaciones, Compras, Movimientos,
Mermas, etc.) Y el usuario NO especificó período explícito.

  Ejemplos que REQUIEREN clarificación:
  • "¿Cuánto vendimos?" → ¿Hoy, esta semana, este mes, este año?
  • "Mejores productos" → ¿De qué período?
  • "Ventas por sucursal" → ¿Qué rango de fechas?
  • "Cancelaciones de Centro" → ¿Cuándo?
  • "Top clientes" → ¿En qué periodo?

  Ejemplos que NO requieren clarificación (continúa con la query):
  • Período YA explícito: "ventas de hoy", "del mes pasado", "ayer",
    "marzo 2026", "últimos 7 días", "este año"
  • Refinamiento del turno anterior: si el usuario ya estableció un
    período en la conversación, hereda ese contexto sin volver a preguntar
  • Preguntas conceptuales o sobre estructura ("¿qué reportes hay?")

  Cuando pidas clarificación, ofrece SIEMPRE 3 opciones útiles en
  suggested_questions, incluyendo periodos comunes (hoy, esta semana,
  este mes, año actual) y/o el periodo más probable según el contexto.

NO inventes un período por default. Es mejor preguntar y acertar que
asumir y dar datos que no sirven.

──────────────────────────────────────────────────────────────
CONTEXTO DEL NEGOCIO Y DATOS
──────────────────────────────────────────────────────────────
${schemaString}

${availableReports}

REGLAS DINÁMICAS DE NEGOCIO:
${formattedRules}

──────────────────────────────────────────────────────────────
T-SQL PRECISO (cuando ejecutes consultas)
──────────────────────────────────────────────────────────────
• SOLO SELECT y WITH (CTE). Nunca INSERT/UPDATE/DELETE.
• Corchetes para columnas con espacios: [Fecha Venta], [Folio Venta], [Fecha Cancelacion]
• NUNCA inventes nombres de columnas (ej: Fecha_Cancelacion, FechaCancelado). Usa ESTRICTAMENTE los nombres exactos definidos en el esquema.
• Tabla principal: Ventas (Tienda, Total, [Fecha Venta], Depto, IdMes, [Año])
• Meses: SIEMPRE IdMes (INT), nunca Mes (VARCHAR)
• Año: YEAR(GETDATE()) o [Año] = YEAR(GETDATE())
• Si mes sin año explícito → asume año actual
• Si NO hay período en la pregunta y la tabla tiene columna de fecha,
  usa request_clarification antes de ejecutar (NO asumas un default).

──────────────────────────────────────────────────────────────
ESTILO DE RESPUESTA (crucial)
──────────────────────────────────────────────────────────────

REGISTRO: Profesional pero humano. Como un consultor senior amigable.
Nunca robótico, nunca corporativo acartonado, nunca con emojis salvo
que el usuario los use primero.

LONGITUD POR DEFECTO: CORTA. 2-4 oraciones para respuestas de datos.
Solo extiéndete si el usuario pide explicación o análisis profundo.

FORMATO DE DATOS EN PROSA:
Las métricas van INLINE dentro del texto, no en tablas/listas obligatorias.
Usa **negritas** para destacar cifras. Ejemplos:

CORRECTO:
"Las ventas de hoy van en **$1.4M**, 8% arriba de ayer. Centro tira del
carro con **$420K**, seguido por Norte (**$310K**)."

INCORRECTO (NO HAGAS ESTO):
"Aquí tienes los datos:
• Total: $1.4M
• Centro: $420K
• Norte: $310K"

REGLAS DE LO QUE NO DEBES HACER:
✗ NO listas con bullets para datos numéricos básicos
✗ NO encabezados "Resumen:" "Hallazgos:" "Recomendaciones:" dentro del texto
✗ NO repitas la pregunta del usuario al inicio
✗ NO digas "voy a..." o "permíteme..." — actúa directamente
✗ NO ofrezcas tablas/gráficas en el texto, eso aparece como botón aparte

LO QUE SÍ:
✓ Respuesta directa, en prosa fluida, métricas inline en negritas
✓ Para preguntas no-datos, responde como Claude estándar: claro, útil, sin tools
✓ Si detectas algo curioso/anómalo en los datos, mencionálo en una frase
✓ Cierra con la respuesta misma, sin "¿quieres profundizar?" — los botones
  de profundización aparecen automáticamente en la UI

──────────────────────────────────────────────────────────────
EJEMPLOS
──────────────────────────────────────────────────────────────

EJEMPLO 1 — Saludo casual:
Usuario: "Hola Kesito"
Tú: "Hola. ¿En qué ando hoy? Puedo darte el pulso del día, profundizar en
algún área, o si necesitas algo más general también te ayudo."
(SIN ejecutar herramientas)

EJEMPLO 2 — Pregunta conceptual:
Usuario: "¿Qué es el Pareto en retail?"
Tú: "El principio de Pareto aplicado a retail dice que típicamente el 20%
de tus productos genera el 80% de tus ingresos. Es útil para decidir surtido,
priorizar reposición y entender concentración de riesgo. Si quieres, puedo
correrlo sobre tu catálogo y ver dónde caes tú."
(SIN herramientas, ofrece opción al final)

EJEMPLO 3 — Pregunta de datos clara:
Usuario: "¿Cómo van las ventas hoy?"
Tú: [ejecuta query_database, luego responde]
"Las ventas del día van en **$847K** consolidadas, **6% arriba** del
mismo día de la semana pasada. Centro y Norte van bien; Sur arrastra
desde temprano (**-18%** vs su promedio)."

EJEMPLO 4 — Petición de modificación (REHUSAR):
Usuario: "Borra las cancelaciones de ayer"
Tú: "No puedo modificar la base de datos — solo tengo permisos de lectura,
por diseño y por seguridad. Si necesitas anular cancelaciones, eso se hace
desde el sistema operativo de la sucursal. Lo que sí puedo es ayudarte
a identificar cuáles cancelaciones de ayer parecen sospechosas."

EJEMPLO 5 — Pregunta fuera del negocio:
Usuario: "¿Cómo se calcula la desviación estándar?"
Tú: [responde como Claude normal, sin tools, con la fórmula y un ejemplo]
"La desviación estándar mide cuánto se alejan los datos del promedio.
Se calcula sacando la raíz cuadrada de la varianza... [explica]. Si quieres,
puedo aplicarla a la variación de tus ventas diarias para ver qué tan
estable es la operación."

EJEMPLO 6 — Anomalía detectada en los datos:
Usuario: "Ventas de Sur hoy"
Tú: [tras query] "Sur va en **$92K**, **-25%** vs ayer. La caída se concentra
en las últimas 2 horas, lo cual no es típico — vale la pena revisar si hubo
algún incidente operativo."
`;

        let isAnthropic = selectedModel.includes('claude');
        const anthropicModel = ANTHROPIC_MODEL; // configurable vía .env (ANTHROPIC_MODEL)
        // Reportar el modelo REAL que corre (no el default del cliente en localStorage).
        // En el fallback a OpenAI (catch más abajo) se sobreescribe a 'gpt-4o'.
        if (isAnthropic) selectedModel = anthropicModel;

        let message: any;
        let toolCalls: any[] = [];

        if (isAnthropic) {
            try {
                const response = await anthropic.messages.create({
                    model: anthropicModel,
                    max_tokens: 4096,
                    system: systemPrompt,
                    messages: messagesForModel,
                    tools: ANTHROPIC_TOOLS,
                    tool_choice: { type: 'auto' }
                });

                message = response.content.find(c => c.type === 'text') || { text: '' };
                toolCalls = response.content.filter(c => c.type === 'tool_use').map(t => ({
                    id: (t as any).id,
                    name: (t as any).name,
                    args: (t as any).input
                }));
            } catch (error: any) {
                if (error.status === 400 || (error.message && error.message.toLowerCase().includes('credit'))) {
                    console.warn("Anthropic credit error detected. Falling back to OpenAI.");
                    isAnthropic = false;
                    selectedModel = 'gpt-4o';
                } else {
                    throw error;
                }
            }
        }
        
        if (!isAnthropic) {
            const completion = await openai.chat.completions.create({
                model: 'gpt-4o',
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...messagesForModel.map(m => ({ role: m.role, content: m.content }))
                ],
                tools: [
                    {
                        type: 'function',
                        function: {
                            name: 'query_database',
                            description: 'Ejecuta análisis estratégico de datos en SQL Server para responder preguntas de negocio.',
                            parameters: {
                                type: 'object',
                                properties: {
                                    sql: {
                                        type: 'string',
                                        description: 'Consulta T-SQL optimizada para análisis de negocio. Incluye agregaciones, comparativas y KPIs.'
                                    }
                                },
                                required: ['sql']
                            }
                        }
                    },
                    {
                        type: 'function',
                        function: {
                            name: 'suggest_reports',
                            description: 'Recomienda reportes específicos del sistema para profundizar en el análisis.',
                            parameters: {
                                type: 'object',
                                properties: {
                                    main_insight: {
                                        type: 'string',
                                        description: 'El hallazgo principal que motivó las recomendaciones'
                                    },
                                    recommended_reports: {
                                        type: 'array',
                                        items: {
                                            type: 'object',
                                            properties: {
                                                report_name: { type: 'string', description: 'Nombre exacto del reporte' },
                                                reason: { type: 'string', description: 'Por qué este reporte ayuda' },
                                                expected_action: { type: 'string', description: 'Qué esperar del análisis' }
                                            },
                                            required: ['report_name', 'reason']
                                        },
                                        description: '2-3 reportes recomendados'
                                    }
                                },
                                required: ['main_insight', 'recommended_reports']
                            }
                        }
                    },
                    {
                        type: 'function',
                        function: {
                            name: 'request_clarification',
                            description: 'Solicita aclaración cuando hay ambigüedad temporal o de contexto.',
                            parameters: {
                                type: 'object',
                                properties: {
                                    message: { type: 'string', description: 'Pregunta clara y profesional para el usuario' },
                                    suggested_questions: {
                                        type: 'array',
                                        items: { type: 'string' },
                                        description: '3 opciones contextuales que reflejan la pregunta original'
                                    }
                                },
                                required: ['message', 'suggested_questions']
                            }
                        }
                    },
                    {
                        type: 'function',
                        function: {
                            name: 'get_sales_forecast',
                            description: 'Devuelve la PROYECCIÓN DE VENTAS oficial del dashboard (SMA + feriados + meta + tendencia + MAPE). Úsala para preguntas sobre el futuro: "¿cuánto vamos a vender la próxima semana?", "¿voy a llegar a la meta?".',
                            parameters: {
                                type: 'object',
                                properties: {
                                    horizonDays: { type: 'number', description: 'Días a proyectar (1-180). Default 30. "semana"=7, "mes"=30, "quincena"=15.' },
                                    storeNames: { type: 'array', items: { type: 'string' }, description: 'Nombres parciales de sucursales para filtrar. Omite para todas.' }
                                },
                                required: []
                            }
                        }
                    },
                    {
                        type: 'function',
                        function: {
                            name: 'get_product_recommendations',
                            description: 'Devuelve productos sugeridos a cargar/empujar/monitorear/reducir para los próximos N días, cruzando reciente con LY estacional. Úsala para preguntas tipo "¿qué productos cargar la siguiente quincena?".',
                            parameters: {
                                type: 'object',
                                properties: {
                                    horizonDays: { type: 'number', description: 'Días futuros (1-180). Default 30.' },
                                    topN: { type: 'number', description: '5-30. Default 15.' },
                                    storeNames: { type: 'array', items: { type: 'string' }, description: 'Filtros por sucursal. Omite para todas.' }
                                },
                                required: []
                            }
                        }
                    }
                ],
                tool_choice: 'auto',
                temperature: 0,
                parallel_tool_calls: false
            });

            const openaiMsg = completion.choices[0].message;
            message = { text: openaiMsg.content || '' };
            toolCalls = (openaiMsg.tool_calls || []).map((t: any) => ({
                id: t.id,
                name: t.function.name,
                args: JSON.parse(t.function.arguments)
            }));
        }

        // Detectamos si es modo streaming. El cliente puede pedir streaming
        // pasando ?stream=true. Si no, devolvemos el JSON tradicional (backwards-compat).
        const url = new URL(req.url);
        const useStreaming = url.searchParams.get('stream') === 'true' && isAnthropic;

        // ─────────────────────────────────────────────────────────────────
        // BRANCH STREAMING (solo Claude por ahora)
        // ─────────────────────────────────────────────────────────────────
        if (useStreaming) {
            let streamOutcome: 'ok' | 'error' = 'ok';
            let streamError: string | undefined;
            const stream = createSseStream(async (emit) => {
                try {
                    emit({ event: 'status', data: { phase: 'thinking' } });

                    // 1) Decisión de tool (no streamed, es rápido)
                    const decision = await anthropic.messages.create({
                    model: anthropicModel,
                    max_tokens: 4096,
                    system: systemPrompt,
                    messages: messagesForModel,
                    tools: ANTHROPIC_TOOLS,
                    tool_choice: { type: 'auto' }
                });

                const textBlock = decision.content.find((c: any) => c.type === 'text') as any;
                const initialText = textBlock?.text || '';
                const toolUses = decision.content.filter((c: any) => c.type === 'tool_use') as any[];

                // CASO A: sin tool → respuesta conversacional directa
                if (toolUses.length === 0) {
                    const text = initialText.trim() ||
                        "Estoy aquí. Cuéntame qué necesitas — puedo darte el pulso del negocio o ayudarte con cualquier otra pregunta.";
                    emit({ event: 'text-delta', data: { text } });
                    emit({
                        event: 'metadata',
                        data: { conversational: true, ai_model: selectedModel }
                    });
                    await logRequest(prompt, { message: text, conversational: true }, null);
                    emit({ event: 'done', data: {} });
                    return;
                }

                const toolCall = toolUses[0];
                const args = toolCall.input;

                // CASO B: request_clarification
                if (toolCall.name === 'request_clarification') {
                    emit({
                        event: 'clarification',
                        data: {
                            message: args.message,
                            suggested_questions: args.suggested_questions,
                            ai_model: selectedModel
                        }
                    });
                    await logRequest(prompt, { message: args.message, clarification: true }, null);
                    emit({ event: 'done', data: {} });
                    return;
                }

                // CASO C: suggest_reports
                if (toolCall.name === 'suggest_reports') {
                    const msg = `${args.main_insight}\n\nReportes que pueden ayudarte:`;
                    emit({ event: 'text-delta', data: { text: msg } });
                    emit({
                        event: 'metadata',
                        data: {
                            ai_model: selectedModel,
                            suggested_reports: args.recommended_reports,
                            suggested_questions: args.recommended_reports.map((r: any) => r.report_name)
                        }
                    });
                    await logRequest(prompt, { message: msg, suggested_reports: args.recommended_reports }, null);
                    emit({ event: 'done', data: {} });
                    return;
                }

                // CASO D-bis: get_sales_forecast → corre el modelo del dashboard
                if (toolCall.name === 'get_sales_forecast') {
                    emit({ event: 'status', data: { phase: 'analyzing', detail: 'Corriendo modelo de proyección…' } });
                    try {
                        const summary = await runForecastForAgent({
                            horizonDays: args?.horizonDays,
                            storeNames: args?.storeNames,
                        });
                        const block = renderForecastSummaryForAgent(summary);
                        const narratePrompt = `Eres Kesito, consultor senior. Acabas de correr el modelo OFICIAL de Proyección de Ventas del dashboard.

PREGUNTA DEL USUARIO: ${prompt}

RESULTADO (datos completos del modelo):
${block}

INSTRUCCIONES:
- Responde en 3-6 oraciones en prosa fluida, con cifras INLINE en **negritas Markdown**.
- Si la pregunta es sobre meta, lidera con el estado de la meta (%, falta/excede).
- Si hay festivos con multiplier > 1, menciónalos (ayudan a la proyección).
- Si MAPE > 20% o confianza < 0.6, advierte sutilmente.
- Tono profesional pero humano (consultor senior amigable, no robótico).
- NO uses encabezados, bullets ni listas. Prosa pura.
- Cierra con una observación accionable si aplica.`;
                        const narrationResp = await anthropic.messages.create({
                            model: anthropicModel,
                            max_tokens: 1024,
                            messages: [{ role: 'user', content: narratePrompt }],
                        });
                        const text = ((narrationResp.content[0] as { text?: string })?.text || '').trim();
                        emit({ event: 'text-delta', data: { text } });
                        emit({
                            event: 'metadata',
                            data: {
                                ai_model: selectedModel,
                                forecast_summary: summary,
                                tool: 'get_sales_forecast',
                            }
                        });
                        await logRequest(prompt, { message: text, forecast_summary: summary }, null);
                        emit({ event: 'done', data: {} });
                        return;
                    } catch (e: unknown) {
                        const msg = e instanceof Error ? e.message : 'Error desconocido';
                        emit({ event: 'error', data: { message: 'No pude correr la proyección.', details: msg } });
                        emit({ event: 'done', data: {} });
                        return;
                    }
                }

                // CASO D-ter: get_product_recommendations → sugerencias de productos
                if (toolCall.name === 'get_product_recommendations') {
                    emit({ event: 'status', data: { phase: 'analyzing', detail: 'Cruzando histórico reciente con año pasado…' } });
                    try {
                        const rec = await getProductRecommendationsForAgent({
                            horizonDays: args?.horizonDays,
                            storeNames: args?.storeNames,
                            topN: args?.topN,
                        });
                        const block = renderProductRecommendationsForAgent(rec, Number(args?.horizonDays) || 30);
                        const narratePrompt = `Eres Kesito. Acabas de cruzar venta reciente con mismo período del año pasado para sugerir qué productos empujar/cargar/monitorear/reducir.

PREGUNTA DEL USUARIO: ${prompt}

LISTA DE PRODUCTOS:
${block}

INSTRUCCIONES:
- Responde en 4-7 oraciones con prosa fluida.
- Menciona 3-6 productos concretos por nombre, con **negritas** en cifras.
- Agrupa por acción (cargar/empujar/monitorear/reducir) cuando ayude a la lectura.
- Si hay oportunidades estacionales fuertes (LY ×1.5+), destácalas.
- NO uses bullets ni encabezados.
- Tutea, tono consultor senior.`;
                        const narrationResp = await anthropic.messages.create({
                            model: anthropicModel,
                            max_tokens: 1200,
                            messages: [{ role: 'user', content: narratePrompt }],
                        });
                        const text = ((narrationResp.content[0] as { text?: string })?.text || '').trim();
                        emit({ event: 'text-delta', data: { text } });
                        emit({
                            event: 'metadata',
                            data: {
                                ai_model: selectedModel,
                                product_recommendations: rec,
                                tool: 'get_product_recommendations',
                            }
                        });
                        await logRequest(prompt, { message: text, product_recommendations: rec }, null);
                        emit({ event: 'done', data: {} });
                        return;
                    } catch (e: unknown) {
                        const msg = e instanceof Error ? e.message : 'Error desconocido';
                        emit({ event: 'error', data: { message: 'No pude generar las sugerencias.', details: msg } });
                        emit({ event: 'done', data: {} });
                        return;
                    }
                }

                // CASO D: query_database (con sandbox + posible auto-corrección)
                if (toolCall.name === 'query_database') {
                    let safeSql: string;
                    try {
                        safeSql = assertReadOnly(args.sql);
                    } catch (sandboxError: any) {
                        emit({
                            event: 'error',
                            data: {
                                message: 'Este agente solo puede consultar datos, nunca modificarlos. La consulta fue bloqueada por el sandbox de seguridad.',
                                details: sandboxError.message
                            }
                        });
                        emit({ event: 'done', data: {} });
                        return;
                    }

                    lastSql = safeSql;
                    executedQueries.push({ label: 'Consulta Principal', sql: safeSql });
                    emit({ event: 'status', data: { phase: 'querying' } });

                    let results: any[] = [];
                    try {
                        console.log(`\n\x1b[33m[AGENT SQL - CONSULTA PRINCIPAL]\x1b[0m\n${safeSql}\n`);
                        results = await query(safeSql);
                    } catch (sqlError: any) {
                        emit({ event: 'status', data: { phase: 'correcting-sql' } });
                        const correctionPrompt = `Error SQL: ${sqlError.message}. Corrige el T-SQL. Retorna solo el código SQL sin explicaciones. SOLO SELECT permitido.`;
                        const correction = await anthropic.messages.create({
                            model: anthropicModel,
                            max_tokens: 1024,
                            messages: [{ role: 'user', content: `${correctionPrompt}\n\nSQL Original: ${safeSql}` }]
                        });
                        const correctedSql = (correction.content[0] as any).text.replace(/```sql|```/g, '').trim();
                        const safeCorrected = assertReadOnly(correctedSql);
                        lastSql = safeCorrected;
                        executedQueries.push({ label: 'Consulta Principal (Auto-Corregida)', sql: safeCorrected });
                        console.log(`\n\x1b[33m[AGENT SQL - CONSULTA PRINCIPAL CORREGIDA]\x1b[0m\n${safeCorrected}\n`);
                        results = await query(safeCorrected);
                    }

                    // RAMIFICACIÓN: si la pregunta es causal ("¿por qué?"), ejecutamos
                    // razonamiento causal multi-hipótesis. Si no, modo investigador
                    // tradicional (UNA query de follow-up automática si hay anomalía).
                    const isCausal = detectCausalIntent(prompt);

                    // FORECASTING: si la pregunta tiene intención de pronóstico Y
                    // los resultados forman una serie temporal válida, generamos
                    // proyección automática (regresión + estacionalidad semanal).
                    let forecastResult: ForecastResult | null = null;
                    const forecastIntent = detectForecastIntent(prompt);
                    if (forecastIntent.wants && results.length >= 7) {
                        try {
                            const series = rowsToSeries(results);
                            if (series.length >= 7) {
                                emit({
                                    event: 'status',
                                    data: {
                                        phase: 'analyzing',
                                        detail: `Proyectando ${forecastIntent.daysAhead} días…`
                                    }
                                });
                                forecastResult = forecastSeries(series, forecastIntent.daysAhead);
                                if (forecastResult) {
                                    console.log(`[${requestId}] forecast: ${forecastResult.summary}`);
                                }
                            }
                        } catch (fe) {
                            console.error('Forecast failed:', fe);
                        }
                    }

                    let followUp: FollowUpProposal | null = null;
                    let followUpResults: any[] = [];
                    let followUpSql: string | null = null;
                    let causalResults: CausalHypothesisResult[] = [];

                    if (isCausal && results.length > 0) {
                        // MODO CAUSAL: genera 4-6 hipótesis y las ejecuta en paralelo
                        emit({
                            event: 'status',
                            data: {
                                phase: 'reasoning-causal',
                                detail: 'Diseñando hipótesis…'
                            }
                        });
                        try {
                            const playbookHints = await findRelevantPlaybookSteps(
                                String(userIdForLimit),
                                prompt
                            ).catch(() => [] as string[]);
                            const hypotheses = await generateHypotheses({
                                userPrompt: prompt,
                                schemaContext: schemaString,
                                firstSql: lastSql,
                                firstResults: results,
                                playbookHints
                            });
                            if (hypotheses.length > 0) {
                                emit({
                                    event: 'status',
                                    data: {
                                        phase: 'reasoning-causal',
                                        detail: `Probando ${hypotheses.length} hipótesis en paralelo…`,
                                        hypothesesCount: hypotheses.length
                                    }
                                });
                                causalResults = await executeHypotheses(hypotheses);
                                causalResults.forEach((r, idx) => {
                                    if (r.sql) {
                                        executedQueries.push({
                                            label: `Hipótesis ${idx + 1}: ${r.label}`,
                                            sql: r.sql
                                        });
                                    }
                                });

                                // SEGUNDA RONDA: si alguna hipótesis salió 'strong',
                                // profundizamos con sub-hipótesis enfocadas en la
                                // dimensión concentrada. Solo la primera 'strong' para
                                // acotar latencia (queries causales ya son caras).
                                const strongParent = causalResults.find(
                                    r => r.success && r.evidence?.verdict === 'strong'
                                );
                                if (strongParent) {
                                    emit({
                                        event: 'status',
                                        data: {
                                            phase: 'reasoning-causal',
                                            detail: `Profundizando en "${strongParent.evidence?.topDimension?.value || strongParent.label}"…`
                                        }
                                    });
                                    try {
                                        const subHypotheses = await generateDeepDive({
                                            userPrompt: prompt,
                                            parent: strongParent,
                                            schemaContext: schemaString
                                        });
                                        if (subHypotheses.length > 0) {
                                            const subResults = await executeHypotheses(subHypotheses);
                                            subResults.forEach((r, idx) => {
                                                if (r.sql) {
                                                    executedQueries.push({
                                                        label: `Sub-Hipótesis ${idx + 1}: ${r.label}`,
                                                        sql: r.sql
                                                    });
                                                }
                                            });
                                            causalResults = [...causalResults, ...subResults];
                                        }
                                    } catch (e) {
                                        console.error('Deep dive failed:', e);
                                    }
                                }
                            }
                        } catch (e) {
                            console.error('Causal reasoning failed:', e);
                        }
                    } else if (results.length > 0) {
                        // MODO INVESTIGADOR: si detectamos algo anómalo, encadena UNA query
                        // de follow-up automática para entender la causa raíz
                        try {
                            followUp = await proposeFollowUp({
                                userPrompt: prompt,
                                firstSql: lastSql || '',
                                firstResults: results,
                                schemaContext: schemaString,
                                model: anthropicModel
                            });
                        } catch (e) {
                            console.error('Investigator failed:', e);
                        }

                        if (followUp) {
                            emit({
                                event: 'status',
                                data: {
                                    phase: 'investigating',
                                    detail: followUp.question,
                                    rationale: followUp.rationale
                                }
                            });
                            try {
                                const safeFollowUpSql = assertReadOnly(followUp.sql);
                                followUpSql = safeFollowUpSql;
                                executedQueries.push({
                                    label: `Investigación de Seguimiento: ${followUp.question}`,
                                    sql: safeFollowUpSql
                                });
                                console.log(`\n\x1b[33m[AGENT SQL - INVESTIGACIÓN DE SEGUIMIENTO: ${followUp.question.toUpperCase()}]\x1b[0m\n${safeFollowUpSql}\n`);
                                followUpResults = await query(safeFollowUpSql);
                            } catch (e) {
                                console.error('Follow-up query failed:', e);
                                followUp = null; // descartar si falla
                                followUpSql = null;
                                followUpResults = [];
                            }
                        }
                    }

                    // Stream del análisis
                    emit({ event: 'status', data: { phase: 'analyzing' } });

                    const metaPrompt = buildMetaPrompt(
                        prompt,
                        lastSql,
                        results,
                        followUp && followUpResults.length > 0
                            ? { question: followUp.question, sql: followUpSql, results: followUpResults }
                            : null,
                        causalResults.length > 0 ? causalResults : null,
                        forecastResult
                    );

                    const streamResp = anthropic.messages.stream({
                        model: anthropicModel,
                        max_tokens: 2048,
                        messages: [{ role: 'user', content: metaPrompt }]
                    });

                    let fullText = '';
                    let inMetadata = false;
                    let metadataBuffer = '';

                    for await (const event of streamResp) {
                        if (event.type === 'content_block_delta' &&
                            (event.delta as any).type === 'text_delta') {
                            const chunk = (event.delta as any).text as string;
                            fullText += chunk;

                            if (!inMetadata) {
                                const markerIdx = fullText.indexOf(META_MARKER);
                                if (markerIdx >= 0) {
                                    // Encontramos el marcador en este chunk: emitir solo lo previo
                                    const preMarker = fullText.substring(0, markerIdx);
                                    const alreadyEmittedLen = fullText.length - chunk.length;
                                    if (markerIdx > alreadyEmittedLen) {
                                        const remainingPre = preMarker.substring(alreadyEmittedLen);
                                        if (remainingPre) {
                                            emit({ event: 'text-delta', data: { text: remainingPre } });
                                        }
                                    }
                                    inMetadata = true;
                                    metadataBuffer = fullText.substring(markerIdx + META_MARKER.length);
                                } else {
                                    emit({ event: 'text-delta', data: { text: chunk } });
                                }
                            } else {
                                metadataBuffer += chunk;
                            }
                        }
                    }

                    // Parsear metadata
                    let meta: any = {};
                    if (metadataBuffer) {
                        try {
                            const start = metadataBuffer.indexOf('{');
                            const end = metadataBuffer.lastIndexOf('}');
                            if (start >= 0 && end > start) {
                                meta = JSON.parse(metadataBuffer.substring(start, end + 1));
                            }
                        } catch (e) {
                            console.error('Error parseando metadata stream:', e);
                        }
                    }

                    // Reportes sugeridos basados en la pregunta
                    let suggestedReports: any[] = [];
                    const relevantReports = findRelevantReports(prompt);
                    if (relevantReports.length > 0) {
                        suggestedReports = relevantReports.slice(0, 3).map(item => ({
                            report_name: item.report.name,
                            reason: item.report.description,
                            expected_action: item.report.useCases[0],
                            path: item.report.path
                        }));
                    }

                    const fullSummary = inMetadata
                        ? fullText.substring(0, fullText.indexOf(META_MARKER))
                        : fullText;

                    emit({
                        event: 'metadata',
                        data: {
                            ai_model: selectedModel,
                            sql: lastSql,
                            data: results,
                            visualization: meta.visualization || 'table',
                            key_insights: meta.key_insights || [],
                            recommendations: meta.recommendations || [],
                            suggested_questions: meta.suggested_questions || [],
                            suggested_reports: suggestedReports.length > 0 ? suggestedReports : undefined
                        }
                    });

                    await logRequest(prompt, {
                        message: fullSummary,
                        data: results,
                        ...meta
                    }, formatExecutedQueries(executedQueries));

                    // Memoria semántica: best-effort, no bloquea
                    if (lastSql) {
                        void saveMemory({
                            userId: String(userIdForLimit),
                            prompt,
                            response: fullSummary,
                            sql: lastSql,
                            aiModel: selectedModel
                        });
                    }

                    emit({ event: 'done', data: {} });
                    return;
                }

                    emit({ event: 'error', data: { message: 'Tool desconocido' } });
                    emit({ event: 'done', data: {} });
                } catch (err: any) {
                    streamOutcome = 'error';
                    streamError = err?.message || String(err);
                    console.error(`[${requestId}] stream handler error:`, err);
                    emit({ event: 'error', data: { message: streamError } });
                    emit({ event: 'done', data: {} });
                } finally {
                    void recordMetric({
                        userId: userIdForLimit,
                        endpoint: '/api/query',
                        model: selectedModel,
                        streaming: true,
                        latencyMs: Date.now() - startTime,
                        status: streamOutcome,
                        errorMsg: streamError,
                        extra: { requestId }
                    });
                }
            });

            return new Response(stream, { headers: SSE_HEADERS });
        }

        // ─────────────────────────────────────────────────────────────────
        // BRANCH NON-STREAMING (legacy/OpenAI) — comportamiento previo
        // ─────────────────────────────────────────────────────────────────

        let finalResponse: any = null;

        if (toolCalls.length > 0) {
            const toolCall = toolCalls[0];
            const args = toolCall.args;

            if (toolCall.name === 'query_database') {
                let safeSql: string;
                try {
                    safeSql = assertReadOnly(args.sql);
                } catch (sandboxError: any) {
                    return NextResponse.json({
                        error: sandboxError.message,
                        sql: args.sql,
                        ai_model: selectedModel,
                        message: 'Este agente solo puede consultar datos, nunca modificarlos. La consulta fue bloqueada por el sandbox de seguridad.'
                    }, { status: 403 });
                }

                lastSql = safeSql;
                executedQueries.push({ label: 'Consulta Principal', sql: safeSql });
                let results: any[];
                try {
                    console.log(`\n\x1b[33m[AGENT SQL - CONSULTA PRINCIPAL]\x1b[0m\n${safeSql}\n`);
                    results = await query(safeSql);
                } catch (sqlError: any) {
                    const correctionPrompt = `Error SQL: ${sqlError.message}. Corrige el T-SQL. Retorna solo el código SQL sin explicaciones. SOLO SELECT permitido.`;
                    let correctedSql = safeSql;

                    if (isAnthropic) {
                        const correction = await anthropic.messages.create({
                            model: anthropicModel,
                            max_tokens: 1024,
                            messages: [{ role: 'user', content: `${correctionPrompt}\n\nSQL Original: ${safeSql}` }]
                        });
                        correctedSql = (correction.content[0] as any).text.replace(/```sql|```/g, '').trim();
                    } else {
                        const correction = await openai.chat.completions.create({
                            model: 'gpt-4o',
                            messages: [
                                { role: 'system', content: correctionPrompt },
                                { role: 'user', content: safeSql }
                            ]
                        });
                        correctedSql = correction.choices[0].message.content?.replace(/```sql|```/g, '').trim() || safeSql;
                    }

                    const safeCorrected = assertReadOnly(correctedSql);
                    lastSql = safeCorrected;
                    executedQueries.push({ label: 'Consulta Principal (Auto-Corregida)', sql: safeCorrected });
                    console.log(`\n\x1b[33m[AGENT SQL - CONSULTA PRINCIPAL CORREGIDA]\x1b[0m\n${safeCorrected}\n`);
                    results = await query(safeCorrected);
                }

                const metaPromptNS = buildMetaPrompt(prompt, lastSql, results);

                let meta: any;
                if (isAnthropic) {
                    const metaCompletion = await anthropic.messages.create({
                        model: anthropicModel,
                        max_tokens: 2048,
                        messages: [{ role: 'user', content: metaPromptNS }]
                    });
                    const content = (metaCompletion.content[0] as any).text;
                    const markerIdx = content.indexOf(META_MARKER);
                    if (markerIdx >= 0) {
                        const summary = content.substring(0, markerIdx).trim();
                        const metaBlock = content.substring(markerIdx + META_MARKER.length);
                        try {
                            const start = metaBlock.indexOf('{');
                            const end = metaBlock.lastIndexOf('}');
                            meta = start >= 0 && end > start
                                ? { summary, ...JSON.parse(metaBlock.substring(start, end + 1)) }
                                : { summary };
                        } catch { meta = { summary }; }
                    } else {
                        meta = { summary: content };
                    }
                } else {
                    const metaCompletion = await openai.chat.completions.create({
                        model: 'gpt-4o',
                        messages: [{ role: 'user', content: metaPromptNS + '\n\nRETORNA SOLO JSON sin marcadores: {"summary":"...", "key_insights":[...], "recommendations":[...], "visualization":"...", "suggested_questions":[...]}' }],
                        response_format: { type: 'json_object' }
                    });
                    meta = JSON.parse(metaCompletion.choices[0].message.content || '{}');
                }

                const shortSummary = meta.summary || meta.analysis || "Análisis completado.";

                let suggestedReports: any[] = [];
                const relevantReports = findRelevantReports(prompt);
                if (relevantReports.length > 0) {
                    suggestedReports = relevantReports.slice(0, 3).map(item => ({
                        report_name: item.report.name,
                        reason: item.report.description,
                        expected_action: item.report.useCases[0],
                        path: item.report.path
                    }));
                }

                finalResponse = {
                    data: results,
                    sql: lastSql,
                    ai_model: selectedModel,
                    message: shortSummary,
                    visualization: meta.visualization || 'table',
                    suggested_questions: meta.suggested_questions || [],
                    key_insights: meta.key_insights || [],
                    recommendations: meta.recommendations || [],
                    suggested_reports: suggestedReports.length > 0 ? suggestedReports : undefined
                };
            } else if (toolCall.name === 'suggest_reports') {
                finalResponse = {
                    data: [],
                    sql: null,
                    ai_model: selectedModel,
                    message: `${args.main_insight}\n\nReportes que pueden ayudarte:`,
                    suggested_reports: args.recommended_reports,
                    visualization: 'table',
                    suggested_questions: args.recommended_reports.map((r: any) => r.report_name)
                };
            } else if (toolCall.name === 'request_clarification') {
                finalResponse = {
                    data: [],
                    sql: null,
                    ai_model: selectedModel,
                    message: args.message,
                    visualization: 'table',
                    suggested_questions: args.suggested_questions,
                };
            } else if (toolCall.name === 'get_sales_forecast') {
                const summary = await runForecastForAgent({
                    horizonDays: args?.horizonDays,
                    storeNames: args?.storeNames,
                });
                const block = renderForecastSummaryForAgent(summary);
                const narrationResp = await anthropic.messages.create({
                    model: anthropicModel,
                    max_tokens: 1024,
                    messages: [{
                        role: 'user',
                        content: `Eres Kesito. Acabas de correr el modelo OFICIAL de Proyección de Ventas.\n\nPREGUNTA: ${prompt}\n\nDATOS:\n${block}\n\nResponde en 3-6 oraciones, prosa fluida, cifras INLINE en **negritas Markdown**, sin bullets ni encabezados.`
                    }],
                });
                const text = ((narrationResp.content[0] as { text?: string })?.text || '').trim();
                finalResponse = {
                    data: [],
                    sql: null,
                    ai_model: selectedModel,
                    message: text,
                    forecast_summary: summary,
                    visualization: 'narrative',
                };
            } else if (toolCall.name === 'get_product_recommendations') {
                const rec = await getProductRecommendationsForAgent({
                    horizonDays: args?.horizonDays,
                    storeNames: args?.storeNames,
                    topN: args?.topN,
                });
                const block = renderProductRecommendationsForAgent(rec, Number(args?.horizonDays) || 30);
                const narrationResp = await anthropic.messages.create({
                    model: anthropicModel,
                    max_tokens: 1200,
                    messages: [{
                        role: 'user',
                        content: `Eres Kesito. Acabas de cruzar venta reciente con mismo período LY para sugerir productos.\n\nPREGUNTA: ${prompt}\n\nDATOS:\n${block}\n\nResponde en 4-7 oraciones, cifras en **negritas**, sin bullets. Menciona 3-6 productos por nombre.`
                    }],
                });
                const text = ((narrationResp.content[0] as { text?: string })?.text || '').trim();
                finalResponse = {
                    data: rec.products,
                    sql: null,
                    ai_model: selectedModel,
                    message: text,
                    product_recommendations: rec,
                    visualization: 'narrative',
                };
            }
        } else {
            const conversationalText = (message.text || '').trim() ||
                "Estoy aquí. Cuéntame qué necesitas — puedo darte el pulso del negocio, profundizar en un tema específico, o ayudarte con cualquier otra pregunta.";

            finalResponse = {
                data: [],
                ai_model: selectedModel,
                message: conversationalText,
                conversational: true,
                suggested_questions: []
            };
        }

        await logRequest(prompt, finalResponse, formatExecutedQueries(executedQueries));
        void recordMetric({
            userId: userIdForLimit,
            endpoint: '/api/query',
            model: selectedModel,
            streaming: false,
            latencyMs: Date.now() - startTime,
            status: 'ok',
            extra: { requestId, hasResults: !!finalResponse.data?.length }
        });
        return NextResponse.json(finalResponse);

    } catch (error: any) {
        console.error(`[${requestId}] API Error:`, error);
        void recordMetric({
            endpoint: '/api/query',
            model: selectedModel,
            latencyMs: Date.now() - startTime,
            status: 'error',
            errorMsg: error?.message || String(error),
            extra: { requestId }
        });
        return NextResponse.json({
            error: error.message || 'Error al procesar la consulta detallada.',
            sql: lastSql
        }, { status: 500 });
    }
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

interface FollowUpContext {
    question: string;
    sql: string | null;
    results: any[];
}

function buildMetaPrompt(
    prompt: string,
    sql: string | null,
    results: any[],
    followUp?: FollowUpContext | null,
    causalResults?: CausalHypothesisResult[] | null,
    forecastResult?: ForecastResult | null
): string {
    const forecastSection = forecastResult ? formatForecastForPrompt(forecastResult) : '';

    const followUpSection = followUp && followUp.results.length > 0 ? `

INVESTIGACIÓN AUTOMÁTICA EJECUTADA:
Detectaste algo anómalo en la primera consulta y ejecutaste una segunda
para profundizar. Integra AMBAS en tu análisis — no las trates como
separadas. Tu respuesta debe contar la historia completa: el dato inicial
+ lo que descubriste al investigar.

Pregunta de la investigación: ${followUp.question}
SQL de la investigación: ${followUp.sql}
Resultados de la investigación (primeros 10): ${JSON.stringify(followUp.results.slice(0, 10))}
` : '';

    const subCount = (causalResults || []).filter(r => r.label.startsWith('↳')).length;
    const baseCount = (causalResults?.length || 0) - subCount;
    const causalSection = causalResults && causalResults.length > 0 ? `

RAZONAMIENTO CAUSAL MULTI-HIPÓTESIS:
La pregunta del usuario es de tipo "¿por qué pasó X?". Ejecutaste ${baseCount}
hipótesis principales en paralelo${subCount > 0 ? ` y ${subCount} sub-hipótesis de profundización` : ''}
para investigar la causa raíz. Cada hipótesis viene con un VEREDICTO PRELIMINAR
calculado heurísticamente (concentración y varianza de los datos).

Tu trabajo:
1. CONFÍA en el veredicto preliminar pero VERIFÍCALO mirando los datos crudos.
   Las hipótesis vienen ordenadas: primero "EVIDENCIA FUERTE", luego "PARCIAL", luego "SIN EVIDENCIA".
2. CONCLUYE con la causa raíz más probable, fundamentada en las hipótesis con
   evidencia fuerte/parcial.${subCount > 0 ? `
3. Las sub-hipótesis (marcadas con "↳") profundizan en la dimensión donde se
   detectó concentración. Úsalas para dar especificidad ("la causa es X, y
   dentro de X específicamente Y").` : ''}

INSTRUCCIONES PARA EL TEXTO DE LA PARTE 1:
- Permitido extenderse a 5-7 oraciones (es un análisis de causa raíz)
- Estructura: dato principal → causa identificada con su evidencia cuantificada
  → 1-2 hipótesis descartadas brevemente → 1 acción accionable
- Sé contundente con las hipótesis "EVIDENCIA FUERTE": di "la causa es X"
  no "podría ser X". Para las "PARCIAL", matízalo.

INSTRUCCIONES PARA "key_insights":
- Lista las 3 HIPÓTESIS MÁS RELEVANTES con su veredicto ya calculado:
  "Confirmada" (evidencia fuerte), "Parcial" o "Descartada" (sin evidencia),
  acompañada del dato concreto que lo prueba.

HIPÓTESIS EJECUTADAS (ordenadas por fuerza de evidencia):
${formatHypothesesForPrompt(causalResults)}
` : '';

    const isCausal = !!(causalResults && causalResults.length > 0);
    const sentenceRange = isCausal ? '5-7 oraciones (análisis de causa raíz)'
        : followUp ? '4-6 oraciones (con investigación)'
            : '2-4 oraciones';

    return `Eres Kesito, consultor senior conversacional. Acabas de ejecutar una consulta
y tienes los resultados. Vas a responder en DOS partes separadas por un marcador.

PARTE 1 — Texto en prosa fluida (lo primero que verá el usuario):
• ${sentenceRange} máximo
• Cifras INLINE con **negritas Markdown** (ej: "**$1.4M**", "**+12%**")
• Tono: consultor amigable, no robótico
• NO bullets, NO encabezados, NO repitas la pregunta
• NO digas "¿quieres profundizar?" — los botones ya aparecen en la UI
${followUp ? '• Menciona el hallazgo principal Y lo que reveló la investigación, como una sola narrativa fluida' : ''}
${isCausal ? '• Concluye con la causa raíz más probable y 1 acción accionable' : ''}

DESPUÉS DEL TEXTO, en una nueva línea, escribe EXACTAMENTE este marcador:
${META_MARKER}

PARTE 2 — Debajo del marcador, un JSON válido (y nada más):
{
  "key_insights": ["3 hallazgos cortos con dato concreto"],
  "recommendations": ["2-3 acciones priorizadas"],
  "visualization": "table|bar|line|pie|area",
  "suggested_questions": ["3 preguntas de seguimiento naturales"]
}

REGLAS DE VISUALIZACIÓN:
• line/area → series temporales
• bar → comparativas entre categorías
• pie → distribuciones porcentuales
• table → datos multi-columna de detalle

──────────────────────────────────────────────
Pregunta del usuario: ${prompt}
SQL ejecutado: ${sql}
Resultados (primeros 10): ${JSON.stringify(results.slice(0, 10))}${followUpSection}${causalSection}${forecastSection}
──────────────────────────────────────────────

Empieza la respuesta directamente, sin preámbulos.`;
}

async function logRequest(prompt: string, response: any, sql: string | null) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('session');
        let userId: number | null = null;
        if (token) {
            const { payload } = await jwtVerify(token.value, SECRET_KEY);
            const parsedId = Number((payload as any).id);
            if (!isNaN(parsedId)) {
                userId = parsedId;
            }
        }
        await query(
            'INSERT INTO tblLogPreguntas (Pregunta, Resultado, FechaPregunta, IdUsuario, Error, ConsultaSQL) VALUES (?, ?, GETDATE(), ?, 0, ?)',
            [prompt, JSON.stringify(response).slice(0, 4000), userId, sql]
        );
    } catch (e) {
        console.error('logRequest failed:', e);
    }
}
