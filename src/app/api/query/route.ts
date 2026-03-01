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

export async function POST(req: Request) {
    let prompt = 'Unknown Prompt';
    let lastSql: string | null = null;
    try {
        const body = await req.json();
        prompt = body.prompt;

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        const schemaPath = path.join(process.cwd(), 'database-schema.md');
        const schemaString = fs.readFileSync(schemaPath, 'utf-8');

        // Fetch dynamic AI rules from the database
        const aiRulesResults = await query(`
            SELECT 
                CONVERT(varchar(3),B.Consecutivo) + '.' + CONVERT(varchar(3),CASE WHEN A.Consecutivo IS NULL THEN 0 ELSE A.Consecutivo END) as RuleId, 
                Regla 
            FROM tblReglasPalabrasClave A 
            INNER JOIN tblPalabrasClave B ON A.IdPalabraClave = B.IdPalabraClave 
            WHERE A.Status = 0 AND B.Status = 0 AND A.IdPalabraClave = 1 OR (
                EXISTS (
                    SELECT 1 
                    FROM STRING_SPLIT(B.PalabraClave, ',') 
                    WHERE ? LIKE '%' + LTRIM(RTRIM(value)) + '%'
                    AND LTRIM(RTRIM(value)) <> ''
                )
                AND A.IdPalabraClave > 1
            )
            ORDER BY B.Consecutivo, A.Consecutivo
        `, [prompt]);

        const formattedRules = (aiRulesResults as any[]).map(r => `- ${r.RuleId} ${r.Regla}`).join('\n');

        const currentDateTime = new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });
        const systemPrompt = `
      Eres un Analista de Datos experto en SQL Server (T-SQL) y un Asistente de Compras.
      Tu objetivo es ayudar al usuario a obtener información de su base de datos local o precios de productos en otras tiendas (Shopping).
      
      FECHA Y HORA ACTUAL: ${currentDateTime}
      (Usa esta fecha para entender referencias temporales como "hoy", "ayer", "este mes", "el mes pasado", etc.)

      REGLAS PARA LA BASE DE DATOS (query_database):
      ${schemaString}
      
      Reglas adicionales de SQL y Comportamiento (Dinámicas):
        - Las columnas con espacios corporativos (ej. [Folio Venta]) DEBEN ir siempre entre corchetes [].
        - La comparativa de fechas y periodos debe ser con el formato YYYY-MM-DD. Ejemplo: WHERE  CONVERT(date, FechaVenta ) >= '2026-02-22' AND CONVERT(date, FechaVenta) <= '2026-03-01'.
        - IMPORTANTE: El año 2026 NO es bisiesto. Febrero tiene 28 días. Si hoy es 01/03/2026, ayer fue 28/02/2026.
        - Para consultas de datos, SIEMPRE devuelve el campo "visualization" como 'table' por defecto, pero asegúrate de que los datos sean compatibles con gráficas si el usuario lo solicita después.
        - SIEMPRE devuelve exactamente 3 preguntas sugeridas en el campo "suggested_questions".
        ${formattedRules}
    `;

        console.log('System Prompt:', systemPrompt);

        const tools: any[] = [
            {
                type: 'function',
                function: {
                    name: 'query_database',
                    description: 'Busca información en la base de datos local del inventario, ventas, compras y precios internos usando SQL.',
                    parameters: {
                        type: 'object',
                        properties: {
                            sql: { type: 'string', description: 'La consulta SQL Server (T-SQL) a ejecutar.' }
                        },
                        required: ['sql']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'search_shopping_prices',
                    description: 'Busca precios de productos en páginas de shopping de internet (otras tiendas).',
                    parameters: {
                        type: 'object',
                        properties: {
                            product_name: { type: 'string', description: 'El nombre del producto a buscar.' }
                        },
                        required: ['product_name']
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
        });

        const message = completion.choices[0].message;
        let finalResponse: any = null;

        // If AI wants to use a tool
        if (message.tool_calls && message.tool_calls.length > 0) {
            const toolCall = message.tool_calls[0] as any;
            const args = JSON.parse(toolCall.function.arguments);

            if (toolCall.function.name === 'query_database') {
                lastSql = args.sql;
                const results = await query(args.sql);

                // Get metadata from a second AI call to keep the consistency with the previous structure
                const metaCompletion = await openai.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: [
                        {
                            role: 'system',
                            content: `
                                Analiza la consulta SQL y el prompt original del usuario.
                                Extrae:
                                1. visualization: "table", "bar", "line", "pie", "area".
                                2. suggested_questions: EXACTAMENTE 3 preguntas relacionadas (SIEMPRE EN ESPAÑOL).
                                3. related_page: (opcional, ej: "/dashboard").
                                4. isPeriodProvided: true si el usuario menciono un periodo (hoy, ayer, este mes, etc), false si no hay referencia temporal.
                                5. startDate: Si el usuario pide un rango, ponlo en YYYY-MM-DD.
                                6. endDate: Si el usuario pide un rango, ponlo en YYYY-MM-DD.
                                
                                IMPORTANTE: Usa la fecha actual (${currentDateTime}) como referencia.
                                Retorna solo JSON.`
                        },
                        { role: 'user', content: `Prompt: ${prompt}\nSQL: ${args.sql}` }
                    ],
                    response_format: { type: 'json_object' }
                });

                const meta = JSON.parse(metaCompletion.choices[0].message.content || '{}');

                if (meta.isPeriodProvided === false) {
                    finalResponse = {
                        data: [],
                        message: "Para poder ayudarte mejor, ¿podrías indicarme el periodo de tiempo que te gustaría consultar? (ej. hoy, ayer, este mes, del 1 al 15 de marzo, etc.)",
                        visualization: 'table',
                        suggested_questions: [
                            "Ventas de hoy",
                            "Ventas de ayer",
                            "Ventas de este mes"
                        ]
                    };
                } else {
                    finalResponse = {
                        data: results,
                        sql: args.sql,
                        visualization: meta.visualization || 'table',
                        suggested_questions: (meta.suggested_questions || []).slice(0, 3),
                        related_page: meta.related_page || null,
                        startDate: meta.startDate || null,
                        endDate: meta.endDate || null
                    };
                }
            }

            if (toolCall.function.name === 'search_shopping_prices') {
                lastSql = `SEARCH SHOPPING: ${args.product_name}`;
                const results = await searchShoppingPrices(args.product_name);

                finalResponse = {
                    data: results,
                    sql: `SEARCH SHOPPING: ${args.product_name}`,
                    visualization: 'table',
                    suggested_questions: [
                        `¿Cuál es el precio más bajo de ${args.product_name}?`,
                        `Ver precios de ${args.product_name} en mi base de datos`,
                        `Comparar ${args.product_name} con otras tiendas`
                    ],
                    related_page: null
                };
            }
        } else {
            // Fallback for simple chats without tool calls or if AI doesn't understand
            // If the message contains keywords like "ayuda", "opciones", "no entiendo", or if it's just a fallback
            const keywordsResults = await query(`SELECT PalabraClave FROM tblPalabrasClave WHERE IdPalabraClave > 1`);
            const keywords = (keywordsResults as any[]).map(r => r.PalabraClave).join('\n');

            finalResponse = {
                data: [],
                message: message.content || "No estoy seguro de cómo procesar esa solicitud. Aquí tienes algunas palabras clave que puedes usar para hacerme consultas:",
                options: keywords,
                visualization: 'table',
                suggested_questions: [
                    "¿Qué puedo preguntarte?",
                    "Ver ejemplos de consultas",
                    "Ayuda con el periodo"
                ]
            };
        }

        // --- Log the completion (Success) ---
        try {
            const cookieStore = await cookies();
            const token = cookieStore.get('session');
            let userId = 'unknown';

            if (token) {
                const { payload } = await jwtVerify(token.value, SECRET_KEY);
                userId = (payload as any).id || 'unknown';
            }

            const isQuestionEmpty = finalResponse.data && Array.isArray(finalResponse.data) && finalResponse.data.length === 0;

            await query(
                'INSERT INTO tblLogPreguntas (Pregunta, Resultado, FechaPregunta, IdUsuario, Error, ConsultaSQL, MensajeError) VALUES (?, ?, GETDATE(), ?, ?, ?, ?)',
                [prompt, JSON.stringify(finalResponse), userId, isQuestionEmpty ? 1 : 0, lastSql, null]
            );
        } catch (logError) {
            console.error('Error logging question:', logError);
        }

        return NextResponse.json(finalResponse);

    } catch (error: any) {
        console.error('API Error:', error);

        // --- Log the error (Failure) ---
        try {
            const cookieStore = await cookies();
            const token = cookieStore.get('session');
            let userId = 'unknown';

            if (token) {
                const { payload } = await jwtVerify(token.value, SECRET_KEY);
                userId = (payload as any).id || 'unknown';
            }

            await query(
                'INSERT INTO tblLogPreguntas (Pregunta, Resultado, FechaPregunta, IdUsuario, Error, ConsultaSQL, MensajeError) VALUES (?, ?, GETDATE(), ?, 1, ?, ?)',
                [prompt, 'ERROR', userId, lastSql, error.message || 'Internal Server Error']
            );
        } catch (logError) {
            console.error('Error logging failed question:', logError);
        }

        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
