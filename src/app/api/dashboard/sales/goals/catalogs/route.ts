import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // depto, familia, producto

    try {
        let result: any[] = [];
        if (type === 'depto') {
            result = await query(`SELECT IdDepto, Depto FROM tblDeptos ORDER BY Depto`);
        } else if (type === 'familia') {
            result = await query(`SELECT DISTINCT Familia FROM tblArticulos WHERE Status = 0 AND Familia <> '' ORDER BY Familia`);
        } else if (type === 'producto') {
            result = await query(`SELECT CodigoInterno, CodigoBarras, Descripcion FROM tblArticulos WHERE Status = 0 ORDER BY Descripcion`);
        } else {
            return NextResponse.json({ error: 'Invalid catalog type' }, { status: 400 });
        }
        return NextResponse.json(result);
    } catch (error) {
        console.error('Error fetching catalog:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
