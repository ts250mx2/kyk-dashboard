import 'dotenv/config';
import { openai } from '../src/lib/ai';
import { query, getSchema } from '../src/lib/db';

(async () => {
    try {
        // Obtener el esquema de la base de datos
        const schema = await getSchema();
        const schemaJson = JSON.stringify(schema, null, 2);

        // Prompt para que la IA genere una consulta SQL
        const prompt = `You are given a SQL Server database schema in JSON format:\n${schemaJson}\n\nGenerate a SQL query that returns the total sales (column Total) per store (table tblTiendas, column IdTienda) for the last month (assume column FechaVenta in tblVentas). Return only the query string, without any markdown formatting.`;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0,
        });

        const sqlQuery = completion.choices[0].message.content?.trim();
        console.log('Generated SQL query:\n', sqlQuery);

        if (sqlQuery) {
            // Ejecutar la consulta generada
            const rows = await query(sqlQuery);
            console.log('Query result (first 10 rows):', rows.slice(0, 10));
        }
    } catch (err) {
        console.error('Error during AI query test:', err);
    }
})();
