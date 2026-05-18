import { NextResponse } from 'next/server';
import { openai } from '@/lib/ai';
import { anthropic } from '@/lib/anthropic';
import { query } from '@/lib/db';
import { findRelevantReports } from '@/lib/available-reports';
import { assertReadOnly } from '@/lib/sql-sandbox';
import fs from 'fs';
import path from 'path';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

const SECRET_KEY = new TextEncoder().encode(
    process.env.JWT_SECRET || 'your-secret-key-change-this-in-prod'
);

export async function POST(req: Request) {
    let prompt = 'Unknown Prompt';
    let lastSql: string | null = null;
    let selectedModel = 'gpt-4o';

    try {
        const body = await req.json();
        prompt = body.prompt;
        selectedModel = body.model || 'gpt-4o';

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

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
• Corchetes para columnas con espacios: [Fecha Venta], [Folio Venta]
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

        const isAnthropic = selectedModel.includes('claude');
        const anthropicModel = 'claude-opus-4-6'; // Use specific Opus model for the SDK

        let message: any;
        let toolCalls: any[] = [];

        if (isAnthropic) {
            const response = await anthropic.messages.create({
                model: anthropicModel,
                max_tokens: 4096,
                system: systemPrompt,
                messages: [{ role: 'user', content: prompt }],
                tools: [
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
                ],
                tool_choice: { type: 'auto' }
            });

            message = response.content.find(c => c.type === 'text') || { text: '' };
            toolCalls = response.content.filter(c => c.type === 'tool_use').map(t => ({
                id: (t as any).id,
                name: (t as any).name,
                args: (t as any).input
            }));
        } else {
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

        let finalResponse: any = null;

        if (toolCalls.length > 0) {
            const toolCall = toolCalls[0];
            const args = toolCall.args;

            if (toolCall.name === 'query_database') {
                // SANDBOX: validar que sea solo lectura antes de ejecutar
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
                    // SQL Auto-Correction Logic
                    console.log("SQL Error, attempting auto-correction...");
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

                    // SANDBOX: re-validar el SQL corregido
                    const safeCorrected = assertReadOnly(correctedSql);
                    lastSql = safeCorrected;
                    results = await query(safeCorrected);
                }

                // ANALYTICAL METADATA - SHORT RESPONSE + ON-DEMAND DEEP DIVE
                const metaSystem = `Eres Kesito, consultor senior conversacional. Acabas de ejecutar
una consulta y tienes los resultados. Tu trabajo: redactar una respuesta breve y
humana, y preparar contenido opcional para profundizar.

REGLAS DEL CAMPO 'summary' (lo que el usuario ve primero):
• Prosa fluida, 2-4 oraciones máximo
• Cifras INLINE con **negritas Markdown** (ej: "**$1.4M**", "**+12%**")
• Tono: consultor amigable, no robótico ni corporativo
• NO uses listas con bullets, NO uses encabezados, NO repitas la pregunta
• Si hay algo curioso/anómalo, mencionálo en una frase (no inventes alarmas)
• NO termines con "¿quieres profundizar?" — los botones aparecen en la UI

DETECCIÓN DE GRÁFICA RECOMENDADA:
• 'line'/'area' → series temporales, evolución
• 'bar' → comparativas entre categorías
• 'pie' → distribuciones porcentuales
• 'table' → datos de detalle multi-columna
• Si los datos no se prestan a gráfica, usa 'table'

key_insights: 3 hallazgos cortos (una oración cada uno), cada uno con un
dato concreto. Estos aparecen como contenido expandible bajo demanda.

recommendations: 2-3 acciones priorizadas y concretas. También expandibles.

suggested_questions: 3 preguntas de seguimiento naturales, en primera persona
o como continuación lógica del análisis.

EJEMPLO DE BUEN summary:
"Las ventas del día van en **$847K** consolidadas, **+6%** vs el mismo
día de la semana pasada. Centro y Norte van bien; Sur arrastra desde
temprano (**-18%** vs su promedio), vale la pena revisarlo."

RETORNA SOLO JSON VÁLIDO:
{
  "summary": "Respuesta conversacional con cifras en **negritas**",
  "key_insights": ["Insight 1 con dato", "Insight 2 con dato", "Insight 3"],
  "recommendations": ["Acción 1", "Acción 2"],
  "visualization": "table|bar|line|pie|area",
  "suggested_questions": ["Pregunta 1", "Pregunta 2", "Pregunta 3"]
}`;

                let meta: any;
                if (isAnthropic) {
                    const metaCompletion = await anthropic.messages.create({
                        model: anthropicModel,
                        max_tokens: 2048,
                        messages: [
                            { role: 'user', content: `${metaSystem}\n\nPregunta usuario: ${prompt}\nSQL: ${lastSql}\nResultados: ${JSON.stringify(results.slice(0, 10))}\n\nRETORNA SOLO JSON VÁLIDO.` }
                        ]
                    });
                    const content = (metaCompletion.content[0] as any).text;
                    try {
                        meta = JSON.parse(content.substring(content.indexOf('{'), content.lastIndexOf('}') + 1));
                    } catch { meta = {}; }
                } else {
                    const metaCompletion = await openai.chat.completions.create({
                        model: 'gpt-4o',
                        messages: [
                            { role: 'system', content: metaSystem },
                            { role: 'user', content: `Pregunta: ${prompt}\nSQL: ${lastSql}\nResultados: ${JSON.stringify(results.slice(0, 10))}` }
                        ],
                        response_format: { type: 'json_object' }
                    });
                    meta = JSON.parse(metaCompletion.choices[0].message.content || '{}');
                }

                const shortSummary = meta.summary || meta.analysis || "Análisis completado.";

                // Generar recomendaciones de reportes basado en la pregunta
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
                    message: `📊 RECOMENDACIÓN DE REPORTES\n\n${args.main_insight}\n\nReportes sugeridos para profundizar:`,
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
            // Sin tool call: respuesta conversacional directa (saludo, concepto, charla, etc.)
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

        // Log (Success)
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
                [prompt, JSON.stringify(finalResponse), userId, lastSql]
            );
        } catch { }

        return NextResponse.json(finalResponse);

    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({
            error: error.message || 'Error al procesar la analizar la consulta detallada.',
            sql: lastSql
        }, { status: 500 });
    }
}
