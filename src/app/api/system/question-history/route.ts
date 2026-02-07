import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        let queryStr = `
            SELECT A.*, B.Usuario 
            FROM tblLogPreguntas A 
            INNER JOIN tblUsuarios B ON A.IdUsuario = B.IdUsuario 
        `;
        const params: any[] = [];

        if (startDate && endDate) {
            queryStr += ` WHERE FechaPregunta >= ? AND FechaPregunta <= ? `;
            params.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
        } else {
            queryStr += ` WHERE FechaPregunta > DATEADD(day, -7, GETDATE()) `;
        }

        queryStr += ` ORDER BY IdLogPregunta DESC `;

        const results = await query(queryStr, params);
        return NextResponse.json(results);
    } catch (error: any) {
        console.error('Error fetching question history:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
