import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
    try {
        const topQuestions = await query(`
            SELECT TOP 5 Pregunta, COUNT(*) as Frecuencia
            FROM tblLogPreguntas
            WHERE FechaPregunta >= DATEADD(month, -1, GETDATE())
              AND Error = 0
            GROUP BY Pregunta
            ORDER BY Frecuencia DESC
        `);

        return NextResponse.json(topQuestions);
    } catch (error: any) {
        console.error('Error fetching top questions:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
