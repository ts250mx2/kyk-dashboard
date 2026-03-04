import { NextResponse } from 'next/server';
import { openai } from '@/lib/ai';
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

// Helper function to extract grouping fields from rules
function extractGroupingFields(rules: any[]): string[] {
    const fields: string[] = [];
    rules.forEach(r => {
        if (r.Regla && r.Regla.toLowerCase().includes('campos para agrupar son')) {
            const colonIndex = r.Regla.indexOf(':');
            if (colonIndex !== -1) {
                const content = r.Regla.substring(colonIndex + 1);
                // Split by newline, comma, or "y"
                const lines = content.split(/\n|,|y/).map((s: string) => s.trim()).filter(Boolean);
                lines.forEach((line: string) => {
                    // "Label (ActualField)" -> "Label"
                    const clean = line.replace(/\s*\(.*\).*/, '').trim();
                    if (clean) fields.push(clean);
                });
            }
        }
    });
    return Array.from(new Set(fields)); // Unique fields
}

// Helper function to format simple results as text
function formatResultsAsText(results: any[], prompt: string): string {
    if (!results || results.length === 0) return '';
    const keys = Object.keys(results[0]);

    if (keys.length === 1) {
        const val = results[0][keys[0]];
        const formattedVal = typeof val === 'number' ? formatCurrency(val) : val;
        return `El resultado para **${prompt}** es: **${formattedVal}**`;
    }

    if (keys.length === 2) {
        let text = `He encontrado los siguientes resultados para **${prompt}**:\n\n`;
        results.slice(0, 10).forEach(row => {
            const val = row[keys[1]];
            const formattedVal = typeof val === 'number' ? formatCurrency(val) : val;
            text += `**${row[keys[0]]}**: ${formattedVal}\n`;
        });
        if (results.length > 10) text += `\n*(Mostrando los primeros 10 de ${results.length} resultados)*`;
        return text;
    }

    return '';
}

export async function POST(req: Request) {
    let prompt = 'Unknown Prompt';
    let lastSql: string | null = null;
    let matchedKeywords: string[] = [];
    let aiRules: any[] = [];

    try {
        const body = await req.json();
        prompt = body.prompt;

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

        aiRules = aiRulesResults as any[];
        matchedKeywords = Array.from(new Set(aiRules.filter(r => r.MatchedWord !== 'Reglas Generales').map(r => r.MatchedWord)));

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

        const tools: any[] = [
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
                            message: { type: 'string', description: 'Mensaje amable preguntando por el periodo (ej: "¿Para qué periodo de tiempo deseas el análisis?"). IMPORTANTE: NO incluyas ninguna opción o sugerencia dentro de este texto.' },
                            suggested_questions: {
                                type: 'array',
                                items: { type: 'string' },
                                description: '3 sugerencias con la pregunta original del usuario + el periodo de tiempo (ej: "[Pregunta original] de este mes"). El usuario hará clic en estos como botones. PROHIBIDO pedir todo el histórico.'
                            }
                        },
                        required: ['message', 'suggested_questions']
                    }
                }
            }
        ];

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt },
            ],
            tools,
            tool_choice: 'auto',
            temperature: 0,
            parallel_tool_calls: false
        });

        const message = completion.choices[0].message;
        let finalResponse: any = null;

        // If AI wants to use a tool
        if (message.tool_calls && message.tool_calls.length > 0) {
            const toolCall = message.tool_calls[0] as any;
            const args = JSON.parse(toolCall.function.arguments);

            if (toolCall.function.name === 'query_database') {
                lastSql = args.sql;
                let results: any[];
                try {
                    results = await query(args.sql);
                } catch (sqlError: any) {
                    // Pillar 1: SQL Auto-Correction Logic
                    console.log("SQL Error, attempting auto-correction...");
                    const correctionCompletion = await openai.chat.completions.create({
                        model: 'gpt-4o',
                        messages: [
                            { role: 'system', content: `Error SQL: ${sqlError.message}. Corrige el T-SQL.` },
                            { role: 'user', content: args.sql }
                        ]
                    });
                    const correctedSql = correctionCompletion.choices[0].message.content?.replace(/```sql|```/g, '').trim() || args.sql;
                    lastSql = correctedSql;
                    results = await query(correctedSql);
                }

                // ANALYTICAL METADATA & HUMAN ANALYSIS
                const metaCompletion = await openai.chat.completions.create({
                    model: 'gpt-4o',
                    messages: [
                        {
                            role: 'system',
                            content: `
                                Analiza los datos y genera una respuesta profesional y analítica.
                                REGLA OBLIGATORIA: En tu 'analysis' debes especificar siempre el periodo analizado (ej. "este mes", "marzo 2026", "histórico", sin usar formato de fechas exactas) y la sucursal (o "todas las sucursales" si aplica).
                                Retorna JSON:
                                1. visualization: "table", "bar", "line", "pie", "area".
                                2. analysis: Un párrafo humano (max 60 palabras) que explique los resultados, mencionando explícitamente el periodo y la sucursal.
                                3. suggested_questions: 3 preguntas de seguimiento COMPLETAS. REGLA: Si las sugerencias son para agrupar o cambiar el periodo, DEBEN HEREDAR la pregunta original (ej. si la pregunta fue "ventas hoy", la sugerencia debe ser "ventas hoy por Tienda", NUNCA solo "por Tienda"). Si los datos ya están agrupados, haz preguntas analíticas profundas e independientes.`
                        },
                        { role: 'user', content: `Prompt: ${prompt}\nSQL: ${lastSql}\nResultados: ${JSON.stringify(results.slice(0, 5))}` }
                    ],
                    response_format: { type: 'json_object' }
                });

                const meta = JSON.parse(metaCompletion.choices[0].message.content || '{}');

                finalResponse = {
                    data: results,
                    sql: lastSql,
                    message: meta.analysis || "Aquí tienes el análisis solicitado.",
                    insight: meta.insight,
                    visualization: meta.visualization || 'table',
                    suggested_questions: meta.suggested_questions || [],
                };
            }

            if (toolCall.function.name === 'search_shopping_prices') {
                lastSql = `SEARCH SHOPPING: ${args.product_name}`;
                const results = await searchShoppingPrices(args.product_name);
                finalResponse = {
                    data: results,
                    sql: `SEARCH SHOPPING: ${args.product_name}`,
                    visualization: 'table',
                    suggested_questions: [`¿Cuál es el precio más bajo de ${args.product_name}?`],
                };
            }

            if (toolCall.function.name === 'request_clarification') {
                finalResponse = {
                    data: [],
                    sql: null,
                    message: args.message,
                    visualization: 'table',
                    suggested_questions: args.suggested_questions,
                };
            }
        } else {
            // Fallback for non-tool calls
            finalResponse = {
                data: [],
                message: message.content || "Entendido. ¿En qué más puedo apoyarte con el análisis de datos?",
                suggested_questions: ["Ventas de hoy por tienda", "Top 5 productos del mes"]
            };
        }

        // --- Log (Success) ---
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
        } catch (logError) { }

        return NextResponse.json(finalResponse);

    } catch (error: any) {
        console.error('API Error:', error);

        let errorMessage = 'Error al procesar la analizar la consulta detallada.';
        if (error instanceof Error) {
            errorMessage = error.message;
        }

        return NextResponse.json({
            error: errorMessage,
            sql: lastSql
        }, { status: 500 });
    }
}
