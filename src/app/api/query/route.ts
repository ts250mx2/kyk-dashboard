import { NextResponse } from 'next/server';
import { openai } from '@/lib/ai';
import { anthropic } from '@/lib/anthropic';
import { query } from '@/lib/db';
import { searchShoppingPrices } from '@/lib/serper';
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
        const systemPrompt = `
      Eres un Analista de Datos Senior especializado en Business Intelligence y SQL Server.
      Tu objetivo es transformar datos crudos en hallazgos estratégicos para el usuario.
      
      FECHA Y HORA ACTUAL: ${currentDateTime}
      
      CONTEXTO DE NEGOCIO:
      ${schemaString}
      
      REGLAS DINÁMICAS:
      ${formattedRules}

      DIRECTIVAS ANALÍTICAS:
      0. **POLÍTICA DE CERO EXPLICACIÓN**: ESTÁ TERMINANTEMENTE PROHIBIDO responder con texto antes o en lugar de una herramienta si hay intención de consulta. NO digas "Voy a preparar la consulta", "Permíteme buscar", ni nada similar. Si el usuario pide datos, tu PRIMERA Y ÚNICA acción debe ser invocar la herramienta adecuada.
      1. **Validación de Periodo Dinámica**: 
         - Si el usuario específica un periodo (ej: "hoy", "este mes"): Ejecuta \`query_database\` inmediatamente.
         - Si el usuario menciona un mes (ej: "enero", "febrero", "el mes pasado") sin especificar año: Asume SIEMPRE el año actual contenido en "FECHA Y HORA ACTUAL".
         - Si NO especifica periodo pero habla de "tendencia", "historial" o "evolución": Asume POR DEFECTO el último mes (usando \`[Fecha Venta] >= DATEADD(month, -1, GETDATE())\`).
         - Si NO especifica periodo y NO es tendencia: INVOCAR \`request_clarification\`.
      2. **Autonomía**: Nunca preguntes "cómo quieres agrupar". Analiza la intención.
      3. **Insights**: Explica *qué significan* los datos y SIEMPRE especifica el periodo y la sucursal (o "todas") en el análisis.
      4. **Visualización**: Selecciona siempre la mejor herramienta (table, bar, line, pie, area). Recomendado: 'line' o 'area' para tendencias.
      5. **T-SQL Preciso y Estricto**: Usa corchetes [Nombres con Espacios]. Tabla: "Ventas". Columnas Clave: "Depto", "Tienda", "Total", "Fecha Venta".
      6. **Regla de Meses**: SIEMPRE que compares el mes actual usando \`MONTH(GETDATE())\`, debes hacerlo contra la columna \`IdMes\` (INT). NUNCA contra \`Mes\` (VARCHAR).
      7. **Filtro de Año por Defecto**: Si el usuario pregunta por un mes específico sin decir el año, agrega siempre el filtro de año actual (ej: \`IdAnio = YEAR(GETDATE())\` o \`YEAR([Fecha Venta]) = YEAR(GETDATE())\`).
  
      EJEMPLOS:
      - "Ventas": SELECT Tienda, SUM(Total) as VentaNeta FROM Ventas WHERE IdMes = MONTH(GETDATE()) GROUP BY Tienda
      - "Evolución": SELECT [Fecha Venta], SUM(Total) as Venta FROM Ventas WHERE [Fecha Venta] >= DATEADD(month, -1, GETDATE()) GROUP BY [Fecha Venta] ORDER BY [Fecha Venta]
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
                        description: 'Ejecuta análisis de datos en la base de datos local usando T-SQL.',
                        input_schema: {
                            type: 'object',
                            properties: {
                                sql: { type: 'string', description: 'La consulta SQL Server.' }
                            },
                            required: ['sql']
                        }
                    },
                    {
                        name: 'request_clarification',
                        description: 'Pide al usuario que aclare el periodo de tiempo si no lo especificó.',
                        input_schema: {
                            type: 'object',
                            properties: {
                                message: { type: 'string', description: 'Mensaje amable preguntando por el periodo.' },
                                suggested_questions: {
                                    type: 'array',
                                    items: { type: 'string' },
                                    description: '3 sugerencias con la pregunta original del usuario + el periodo de tiempo.'
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
                            description: 'Ejecuta análisis de datos en la base de datos local usando T-SQL.',
                            parameters: {
                                type: 'object',
                                properties: {
                                    sql: { type: 'string', description: 'La consulta SQL Server.' }
                                },
                                required: ['sql']
                            }
                        }
                    },
                    {
                        type: 'function',
                        function: {
                            name: 'request_clarification',
                            description: 'Pide al usuario que aclare el periodo de tiempo si no lo especificó.',
                            parameters: {
                                type: 'object',
                                properties: {
                                    message: { type: 'string', description: 'Mensaje amable preguntando por el periodo.' },
                                    suggested_questions: {
                                        type: 'array',
                                        items: { type: 'string' },
                                        description: '3 sugerencias con la pregunta original del usuario + el periodo de tiempo.'
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

                // ANALYTICAL METADATA & HUMAN ANALYSIS
                const metaSystem = `
                    Analiza los datos y genera una respuesta profesional y analítica.
                    REGLA OBLIGATORIA: En tu 'analysis' debes especificar siempre el periodo analizado y la sucursal.
                    REGLA ADICIONAL: Menciona sutilmente que el análisis fue realizado con el modelo ${selectedModel}.
                    Retorna JSON:
                    1. visualization: "table", "bar", "line", "pie", "area".
                    2. analysis: Un párrafo humano que explique los resultados.
                    3. suggested_questions: 3 preguntas de seguimiento que hereden contexto.`;

                let meta: any;
                if (isAnthropic) {
                    const metaCompletion = await anthropic.messages.create({
                        model: anthropicModel,
                        max_tokens: 1024,
                        messages: [
                            { role: 'user', content: `${metaSystem}\n\nPrompt: ${prompt}\nSQL: ${lastSql}\nResultados (resumen): ${JSON.stringify(results.slice(0, 5))}\n\nIMPORTANTE: RETORNA SOLO EL JSON.` }
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
                            { role: 'user', content: `Prompt: ${prompt}\nSQL: ${lastSql}\nResultados: ${JSON.stringify(results.slice(0, 5))}` }
                        ],
                        response_format: { type: 'json_object' }
                    });
                    meta = JSON.parse(metaCompletion.choices[0].message.content || '{}');
                }

                finalResponse = {
                    data: results,
                    sql: lastSql,
                    ai_model: selectedModel,
                    message: meta.analysis || "Aquí tienes el análisis solicitado.",
                    insight: meta.insight,
                    visualization: meta.visualization || 'table',
                    suggested_questions: meta.suggested_questions || [],
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
                message: message.text || "Entendido. ¿En qué más puedo apoyarte con el análisis de datos?",
                suggested_questions: ["Ventas de hoy por tienda", "Top 5 productos del mes"]
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
