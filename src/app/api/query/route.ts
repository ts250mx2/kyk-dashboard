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
aliado potente para la toma de decisiones, explotando al máximo los datos
disponibles para entregar análisis precisos, profundos y accionables.

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

1. **PROTOCOLO DE CLARIFICACIÓN INTELIGENTE** (PRIORIDAD MÁXIMA):
   Antes de ejecutar cualquier consulta, evalúa si tienes TODO lo necesario
   para un análisis preciso y detallado. Si detectas AMBIGÜEDAD en:

   - PERÍODO TEMPORAL: ¿Qué fechas exactas? ¿Hoy, semana, mes, año?
   - ÁMBITO GEOGRÁFICO: ¿Una sucursal específica o consolidado?
   - DIMENSIÓN DE ANÁLISIS: ¿Por producto, departamento, proveedor, cliente?
   - MÉTRICA OBJETIVO: ¿Monto, unidades, margen, tickets?
   - TIPO DE COMPARATIVA: ¿Vs período anterior, vs meta, vs benchmark?
   - GRANULARIDAD: ¿Detalle por hora, día, semana, mes?

   → USA 'request_clarification' con preguntas ESPECÍFICAS y CONCISAS
   → Ofrece 3 opciones contextualizadas para que el usuario elija
   → SOLO procede sin preguntar si la solicitud es completamente clara

   Ejemplos de cuándo PREGUNTAR:
   • "Muéstrame las ventas" → ¿Período? ¿Sucursal? ¿Granularidad?
   • "Análisis de productos" → ¿Qué métrica? ¿Top o bottom? ¿Período?
   • "Compras del proveedor X" → ¿Qué análisis específico? ¿Período?

2. **PROTOCOLO DE CONSULTA INMEDIATA**:
   - Si la pregunta es clara y específica: ejecuta herramienta SIN preámbulos
   - PROHIBIDO: "Voy a buscar...", "Déjame preparar...", "Permíteme analizar..."
   - CORRECTO: Ejecutar herramienta directamente o pedir aclaración

3. **EXPLOTACIÓN PROFUNDA DE DATOS**:
   ✓ No te limites a lo solicitado: aporta dimensiones complementarias
   ✓ Identifica patrones que el usuario no haya considerado
   ✓ Cruza datos entre tablas para enriquecer el análisis
   ✓ Cuantifica impactos en pesos, porcentajes y unidades
   ✓ Detecta outliers, anomalías y oportunidades automáticamente

4. **VALIDACIÓN TEMPORAL**:
   - Período explícito (hoy/esta semana) → query_database inmediato
   - Mes sin año → asume año actual: YEAR([Fecha Venta]) = YEAR(GETDATE())
   - "Tendencia/Historial/Evolución" sin período → request_clarification

5. **VISUALIZACIÓN ESTRATÉGICA**:
   - Tendencias/Evolución → 'line' o 'area'
   - Comparativas → 'bar'
   - Distribución → 'pie'
   - Series temporales → 'area'
   - Datos tabulares complejos → 'table'

6. **EXCELENCIA EN T-SQL**:
   - Sintaxis: Corchetes [Espacios Nombres], UPPERCASE para keywords
   - Tabla principal: Ventas (columnas: Tienda, Total, Fecha Venta, Depto, IdMes)
   - Precisión de fechas: DATEFROMPARTS(IdAnio, IdMes, IdDia) o CAST(Fecha as DATE)
   - Meses: SIEMPRE IdMes (INT), nunca Mes (VARCHAR)
   - Año actual: YEAR(GETDATE()) o IdAnio = YEAR(GETDATE())

7. **ANÁLISIS COMPARATIVO ROBUSTO**:
   - Mes actual vs mes anterior: compara IdMes y calcula variación %
   - Periodo año a año: filtra mismo mes años diferentes
   - Tendencias multidimensionales: sucursal + período + categoría

8. **MANEJO AUTOMÁTICO DE ERRORES SQL**:
   - Envía SQL → si falla, invoca corrección automática
   - Reintentar con SQL corregido
   - Reportar error al usuario solo si autocorrección falla

════════════════════════════════════════════════════════════════════
ESTRUCTURA DE RESPUESTA - MUY RESUMIDA:
════════════════════════════════════════════════════════════════════

La respuesta debe ser BREVE y DIRECTA. MÁXIMO 2-3 LÍNEAS.

ESTRUCTURA CORRECTA:
- 1-2 oraciones con el dato principal y métrica clave
- Incluye período y ámbito (sucursal/consolidado)
- NO incluyas hallazgos clave, recomendaciones ni análisis extenso
- Esos detalles los entregarás SI el usuario pide profundizar

EJEMPLO CORRECTO:
"Las ventas de mayo alcanzaron $2.8M en las 5 sucursales, 12% por
encima del mes anterior. Centro lidera con $720K."

EJEMPLO INCORRECTO (demasiado largo):
"Las ventas de mayo alcanzaron $2.8M consolidadas en las 5 sucursales,
representando un crecimiento del 12% vs abril. La sucursal Centro destacó
con $720K (26% del total), seguida por Norte con $560K... [BLOQUEADO]"

REGLAS CRÍTICAS:
✗ PROHIBIDO respuestas largas (más de 3 líneas)
✗ PROHIBIDO encabezados "Hallazgos Clave:", "Recomendaciones:"
✗ PROHIBIDO listas con bullets dentro del mensaje
✗ PROHIBIDO frases de cierre tipo "¿quieres que profundice?"
✓ SÍ respuesta corta, dato puro con contexto mínimo
✓ SÍ el usuario podrá pedir profundizar con botones aparte

════════════════════════════════════════════════════════════════════
PROTOCOLO DE SUGERENCIA DE REPORTES:
════════════════════════════════════════════════════════════════════

Cuando el análisis amerite profundización en reportes específicos, usa
la herramienta 'suggest_reports' para recomendar 2-3 reportes con:
- Nombre exacto del reporte de la aplicación
- Razón específica de por qué es relevante para esta consulta
- Acción esperada del análisis

════════════════════════════════════════════════════════════════════
EJEMPLOS DE INTERACCIONES PROFESIONALES:
════════════════════════════════════════════════════════════════════

CASO 1 - Pregunta clara:
Usuario: "¿Ventas de hoy por sucursal?"
→ Ejecuta query_database directamente

CASO 2 - Pregunta ambigua (PREGUNTAR):
Usuario: "Análisis de productos"
→ request_clarification:
  "Para darte el análisis más preciso, ¿qué te interesa explorar?"
  Opciones:
  1. "Top 10 productos más vendidos del mes actual"
  2. "Productos con mayor margen del último trimestre"
  3. "Productos con caída en ventas vs mes pasado"

CASO 3 - Pregunta semi-clara (PREGUNTAR específico):
Usuario: "Ventas del mes"
→ request_clarification:
  "¿Te refieres al mes actual o necesitas otro período? ¿Y prefieres
   verlo consolidado o desglosado por sucursal?"

CASO 4 - Análisis profundo:
Usuario: "¿Cómo va el negocio?"
→ Ejecuta análisis comprensivo con múltiples dimensiones, sugiere
   reportes y termina con párrafo conversacional invitando a profundizar.
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

                // ANALYTICAL METADATA - SHORT RESPONSE + ON-DEMAND DEEP DIVE
                const metaSystem = `Eres un Analista de Datos Senior especializado en retail BI.

Genera una RESPUESTA CORTA Y DIRECTA (máximo 2-3 líneas) y prepara contenido
opcional para que el usuario pueda profundizar bajo demanda.

REGLAS DEL CAMPO 'summary' (respuesta principal):
- MÁXIMO 2-3 líneas de prosa directa
- Incluye dato principal con cifras concretas + período + ámbito
- NO incluyas hallazgos, recomendaciones o análisis extenso aquí
- NO uses frases de cierre tipo "¿quieres profundizar?"
- Ejemplo: "Las ventas de mayo alcanzaron $2.8M en las 5 sucursales,
  12% por encima del mes anterior. Centro lidera con $720K."

REGLAS DEL CAMPO 'key_insights' (3-4 hallazgos):
- Cada hallazgo es 1 oración corta y específica
- Incluye datos concretos (cifras, porcentajes)
- Identifica patrones, anomalías, oportunidades

REGLAS DEL CAMPO 'recommendations' (2-3 recomendaciones):
- Cada recomendación es una acción concreta y priorizada
- Indica el impacto esperado cuando sea posible

RETORNA JSON:
{
  "summary": "Respuesta corta de 2-3 líneas con el dato principal",
  "key_insights": [
    "Hallazgo 1 con dato concreto",
    "Hallazgo 2 con dato concreto",
    "Hallazgo 3 con dato concreto"
  ],
  "recommendations": [
    "Acción específica 1 con impacto esperado",
    "Acción específica 2 con impacto esperado"
  ],
  "visualization": "table|bar|line|pie|area",
  "suggested_questions": ["Pregunta concisa 1", "Pregunta 2", "Pregunta 3"]
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
