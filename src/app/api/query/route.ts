import { NextResponse } from 'next/server';
import { openai } from '@/lib/ai';
import { anthropic } from '@/lib/anthropic';
import { query } from '@/lib/db';
import { searchShoppingPrices } from '@/lib/serper';
import { AVAILABLE_REPORTS, findRelevantReports } from '@/lib/available-reports';
import fs from 'fs';
import path from 'path';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

const SECRET_KEY = new TextEncoder().encode(
    process.env.JWT_SECRET || 'your-secret-key-change-this-in-prod'
);

// Helper function to format currency
function formatCurrency(value: number) {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);
}

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

        const systemPrompt = `
═══════════════════════════════════════════════════════════════════
ANALISTA DE INTELIGENCIA DE NEGOCIO - SISTEMA PROFESIONAL KYK
═══════════════════════════════════════════════════════════════════

IDENTIDAD Y OBJETIVO:
Eres un Analista de Datos Senior con especialización en Business Intelligence,
SQL Server y análisis estratégico de operaciones retail. Tu misión es ser un
aliado estratégico que transforma datos en decisiones acertadas y sostenibles.

FECHA Y HORA ACTUAL: ${currentDateTime}

════════════════════════════════════════════════════════════════════
CONTEXTO DE NEGOCIO Y ESTRUCTURA DE DATOS:
════════════════════════════════════════════════════════════════════
${schemaString}

${availableReports}

REGLAS DINÁMICAS ADICIONALES:
${formattedRules}

════════════════════════════════════════════════════════════════════
PROTOCOLOS OPERACIONALES:
════════════════════════════════════════════════════════════════════

1. **PROTOCOLO DE CONSULTA INMEDIATA**:
   - Si detectas solicitud de análisis/datos: ejecuta herramienta SIN preámbulos
   - PROHIBIDO: "Voy a buscar...", "Déjame preparar...", "Permiteme analizar..."
   - CORRECTO: Ejecutar herramienta directamente

2. **VALIDACIÓN TEMPORAL INTELIGENTE**:
   - Período explícito (hoy/esta semana) → query_database inmediato
   - Mes sin año → asume año actual: YEAR([Fecha Venta]) = YEAR(GETDATE())
   - "Tendencia/Historial/Evolución" sin período → últimos 30 días por defecto
   - Ambigüedad temporal → request_clarification con 3 sugerencias contextuales

3. **CALIDAD ANALÍTICA PROFESIONAL**:
   ✓ SIEMPRE especifica: período exacto, sucursal/consolidado, fecha de análisis
   ✓ Proporciona contexto: ¿Por qué importa este resultado?
   ✓ Identifica patrones: Crecimientos, caídas, anomalías, oportunidades
   ✓ Recomendaciones: Acciones concretas basadas en datos
   ✓ Sugerencias reportes: Propón reportes complementarios para profundizar

4. **VISUALIZACIÓN ESTRATÉGICA**:
   - Tendencias/Evolución → 'line' o 'area'
   - Comparativas → 'bar'
   - Distribución → 'pie'
   - Series temporales → 'area'
   - Datos tabulares complejos → 'table'

5. **EXCELENCIA EN T-SQL**:
   - Sintaxis: Corchetes [Espacios Nombres], UPPERCASE para keywords
   - Tabla principal: Ventas (columnas: Tienda, Total, Fecha Venta, Depto, IdMes)
   - Precisión de fechas: DATEFROMPARTS(IdAnio, IdMes, IdDia) o CAST(Fecha as DATE)
   - Meses: SIEMPRE IdMes (INT), nunca Mes (VARCHAR)
   - Año actual: YEAR(GETDATE()) o IdAnio = YEAR(GETDATE())

6. **ANÁLISIS COMPARATIVO ROBUSTO**:
   - Mes actual vs mes anterior: compara IdMes y calcula variación %
   - Periodo año a año: filtra mismo mes años diferentes
   - Tendencias multimensionales: sucursal + período + categoría

7. **MANEJO AUTOMÁTICO DE ERRORES SQL**:
   - Envía SQL → si falla, invoca corrección automática
   - Reintentar con SQL corregido
   - Reportar error al usuario solo si autocorrección falla

════════════════════════════════════════════════════════════════════
ESTRUCTURA DE RESPUESTA PROFESIONAL:
════════════════════════════════════════════════════════════════════

tu análisis debe incluir:

[RESUMEN EJECUTIVO]
- Hallazgo principal (1-2 líneas impactantes)
- Métrica clave y período analizado

[ANÁLISIS DETALLADO]
- Qué muestran los datos
- Patrones y tendencias identificados
- Contexto de negocio (comparativas, benchmark)

[INSIGHTS CLAVE]
- Oportunidades de mejora
- Riesgos o anomalías detectadas
- Factores que explican los resultados

[RECOMENDACIONES]
- Acciones específicas y priorizadas
- Impacto esperado

[PRÓXIMAS CONSULTAS SUGERIDAS]
- Reportes complementarios a explorar
- Análisis más profundos relacionados
- Preguntas de seguimiento estratégicas

════════════════════════════════════════════════════════════════════
PROTOCOLO DE SUGERENCIA DE REPORTES:
════════════════════════════════════════════════════════════════════

Cuando el análisis de los datos sugiera acciones o profundizaciones, usa la
herramienta 'suggest_reports' para recomendar reportes específicos:

- Si detectas problemas en operaciones → sugiere "Operaciones de Ventas"
- Si hay patrones horarios anormales → sugiere "Mapa de Calor"
- Si hay análisis de cancelaciones → sugiere "Alertas de Cancelaciones" + "Tendencias"
- Si necesita comparativa periodo → sugiere "Comparativa de Ventas"
- Si es análisis de compras → sugiere reportes del área de compras relevantes
- Si necesita análisis profundo → combina 2-3 reportes complementarios

════════════════════════════════════════════════════════════════════
EJEMPLOS DE CONSULTAS PROFESIONALES:
════════════════════════════════════════════════════════════════════

Q: "¿Cómo van nuestras ventas vs el mes pasado?"
→ Análisis comparativo mes actual (IdMes=MONTH(GETDATE())) vs mes anterior
→ Sugiere: "Comparativa de Ventas" + "Operaciones de Ventas"

Q: "Muéstrame el top 5 productos con más margen"
→ JOIN Ventas + inventario, calcula margen, ORDER BY DESC LIMIT 5
→ Sugiere: "Tendencias de Ventas" + "Análisis de Pareto"

Q: "¿Qué sucursales necesitan atención en cancelaciones?"
→ Análisis de cancelaciones por sucursal, identifica outliers
→ Sugiere: "Alertas de Cancelaciones" + "Tendencias de Cancelaciones"

Q: "Evolución de nuestras compras a este proveedor"
→ Serie temporal de compras, análisis de estabilidad y tendencia
→ Sugiere: "Órdenes de Compra" + "Facturas de Compra"
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
                lastSql = args.sql;
                let results: any[];
                try {
                    results = await query(args.sql);
                } catch (sqlError: any) {
                    // SQL Auto-Correction Logic
                    console.log("SQL Error, attempting auto-correction...");
                    const correctionPrompt = `Error SQL: ${sqlError.message}. Corrige el T-SQL. Retorna solo el código SQL sin explicaciones.`;
                    let correctedSql = args.sql;

                    if (isAnthropic) {
                        const correction = await anthropic.messages.create({
                            model: anthropicModel,
                            max_tokens: 1024,
                            messages: [{ role: 'user', content: `${correctionPrompt}\n\nSQL Original: ${args.sql}` }]
                        });
                        correctedSql = (correction.content[0] as any).text.replace(/```sql|```/g, '').trim();
                    } else {
                        const correction = await openai.chat.completions.create({
                            model: 'gpt-4o',
                            messages: [
                                { role: 'system', content: correctionPrompt },
                                { role: 'user', content: args.sql }
                            ]
                        });
                        correctedSql = correction.choices[0].message.content?.replace(/```sql|```/g, '').trim() || args.sql;
                    }

                    lastSql = correctedSql;
                    results = await query(correctedSql);
                }

                // ANALYTICAL METADATA & PROFESSIONAL ANALYSIS
                const metaSystem = `Eres un analista de datos senior. Analiza los resultados con profundidad estratégica.

ESTRUCTURA OBLIGATORIA DE RESPUESTA JSON:
{
  "executive_summary": "1-2 líneas con hallazgo principal y métrica clave",
  "detailed_analysis": "Párrafo que explique qué muestran los datos, patrones identificados, contexto de negocio",
  "key_insights": ["Insight 1", "Insight 2", "Insight 3"],
  "recommendations": ["Acción 1 con impacto", "Acción 2 con impacto"],
  "visualization": "table|bar|line|pie|area - elige el mejor para estos datos",
  "suggested_questions": ["Pregunta de seguimiento 1", "Pregunta 2", "Pregunta 3"]
}

CRITERIOS:
- SIEMPRE incluye período analizado y ámbito (sucursal/consolidado)
- El análisis debe ser accionable, no solo descriptivo
- Identifica anomalías, oportunidades, riesgos
- Las recomendaciones deben ser específicas y priorizadas
- Las preguntas deben heredar contexto y profundizar en insights`;

                let meta: any;
                if (isAnthropic) {
                    const metaCompletion = await anthropic.messages.create({
                        model: anthropicModel,
                        max_tokens: 2048,
                        messages: [
                            { role: 'user', content: `${metaSystem}\n\nPregunta usuario: ${prompt}\nSQL: ${lastSql}\nResultados: ${JSON.stringify(results.slice(0, 10))}\n\nRETORNA SOLO JSON.` }
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

                // Combina resumen ejecutivo con análisis detallado
                const fullAnalysis = meta.executive_summary && meta.detailed_analysis
                    ? `${meta.executive_summary}\n\n${meta.detailed_analysis}`
                    : meta.analysis || meta.detailed_analysis || "Análisis completado.";

                // Generar recomendaciones de reportes basado en la pregunta
                let suggestedReports: any[] = [];
                const relevantReports = findRelevantReports(prompt);
                if (relevantReports.length > 0) {
                    suggestedReports = relevantReports.slice(0, 2).map(item => ({
                        report_name: item.report.name,
                        reason: `Este reporte te ayudará a ${item.report.description.toLowerCase()}`,
                        expected_action: item.report.useCases[0]
                    }));
                }

                finalResponse = {
                    data: results,
                    sql: lastSql,
                    ai_model: selectedModel,
                    message: fullAnalysis,
                    insight: meta.key_insights?.[0] || meta.insight,
                    visualization: meta.visualization || 'table',
                    suggested_questions: meta.suggested_questions || [],
                    recommendations: meta.recommendations || [],
                    key_insights: meta.key_insights || [],
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
            finalResponse = {
                data: [],
                ai_model: selectedModel,
                message: "Entendido. ¿En qué más puedo apoyarte con el análisis estratégico de datos?",
                suggested_questions: [
                    "¿Cómo van nuestras ventas vs el mes pasado?",
                    "Top 10 productos más vendidos este mes",
                    "Análisis de cancelaciones por causa"
                ]
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
