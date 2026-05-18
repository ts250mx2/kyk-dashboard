import { NextResponse } from 'next/server';
import { openai } from '@/lib/ai';
import { anthropic } from '@/lib/anthropic';
import { query } from '@/lib/db';
import { findRelevantReports } from '@/lib/available-reports';
import { assertReadOnly } from '@/lib/sql-sandbox';
import { createSseStream, SSE_HEADERS } from '@/lib/sse';
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
    }
];

interface IncomingTurn {
    role: 'user' | 'assistant';
    content: string;
}

const MAX_HISTORY_TURNS = 8; // pares user/assistant que conservamos como contexto

export async function POST(req: Request) {
    let prompt = 'Unknown Prompt';
    let lastSql: string | null = null;
    let selectedModel = 'gpt-4o';

    try {
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
• Pide datos concretos del negocio ("ventas de hoy", "top productos")
• Quiere comparativas reales con números
• Necesita análisis cuantitativo de operación

USA suggest_reports cuando puedas guiar al usuario a un reporte preexistente
en vez de generar análisis desde cero.

USA request_clarification SOLO si la consulta de datos es genuinamente
ambigua (sin período, sin alcance) Y no puedes inferir razonablemente.

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
• Tendencia/evolución sin período → últimos 30 días

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
        const anthropicModel = 'claude-opus-4-6'; // Use specific Opus model for the SDK

        let message: any;
        let toolCalls: any[] = [];

        if (isAnthropic) {
            try {
                const response = await anthropic.messages.create({
                    model: anthropicModel,
                    max_tokens: 4096,
                    system: systemPrompt,
                    messages: [{ role: 'user', content: prompt }],
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
                    { role: 'user', content: prompt },
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
            const stream = createSseStream(async (emit) => {
                emit({ event: 'status', data: { phase: 'thinking' } });

                // 1) Decisión de tool (no streamed, es rápido)
                const decision = await anthropic.messages.create({
                    model: anthropicModel,
                    max_tokens: 4096,
                    system: systemPrompt,
                    messages: [{ role: 'user', content: prompt }],
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
                    emit({ event: 'status', data: { phase: 'querying' } });

                    let results: any[] = [];
                    try {
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
                        results = await query(safeCorrected);
                    }

                    // Stream del análisis
                    emit({ event: 'status', data: { phase: 'analyzing' } });

                    const metaPrompt = buildMetaPrompt(prompt, lastSql, results);

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
                    }, lastSql);

                    emit({ event: 'done', data: {} });
                    return;
                }

                emit({ event: 'error', data: { message: 'Tool desconocido' } });
                emit({ event: 'done', data: {} });
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
                let results: any[];
                try {
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

        await logRequest(prompt, finalResponse, lastSql);
        return NextResponse.json(finalResponse);

    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({
            error: error.message || 'Error al procesar la consulta detallada.',
            sql: lastSql
        }, { status: 500 });
    }
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function buildMetaPrompt(prompt: string, sql: string | null, results: any[]): string {
    return `Eres Kesito, consultor senior conversacional. Acabas de ejecutar una consulta
y tienes los resultados. Vas a responder en DOS partes separadas por un marcador.

PARTE 1 — Texto en prosa fluida (lo primero que verá el usuario):
• 2-4 oraciones máximo
• Cifras INLINE con **negritas Markdown** (ej: "**$1.4M**", "**+12%**")
• Tono: consultor amigable, no robótico
• NO bullets, NO encabezados, NO repitas la pregunta
• NO digas "¿quieres profundizar?" — los botones ya aparecen en la UI

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
Resultados (primeros 10): ${JSON.stringify(results.slice(0, 10))}
──────────────────────────────────────────────

Empieza la respuesta directamente, sin preámbulos.`;
}

async function logRequest(prompt: string, response: any, sql: string | null) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('session');
        let userId = 'unknown';
        if (token) {
            const { payload } = await jwtVerify(token.value, SECRET_KEY);
            userId = (payload as any).id || 'unknown';
        }
        await query(
            'INSERT INTO tblLogPreguntas (Pregunta, Resultado, FechaPregunta, IdUsuario, Error, ConsultaSQL) VALUES (?, ?, GETDATE(), ?, 0, ?)',
            [prompt, JSON.stringify(response).slice(0, 4000), userId, sql]
        );
    } catch (e) {
        console.error('logRequest failed:', e);
    }
}
