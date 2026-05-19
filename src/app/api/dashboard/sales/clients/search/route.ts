import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const q = searchParams.get('q') || '';
        if (q.length < 2) {
            return NextResponse.json({ clients: [] });
        }

        // Clean query to avoid SQL injection issues
        const cleanQ = q.replace(/'/g, "''");

        const sql = `
            SELECT DISTINCT TOP 20 RFC, ClienteConcepto
            FROM tblFacturas
            WHERE (ClienteConcepto LIKE '%${cleanQ}%' OR RFC LIKE '%${cleanQ}%')
              AND ClienteConcepto IS NOT NULL
            ORDER BY ClienteConcepto
        `;
        const clients = await query(sql);
        return NextResponse.json({ clients });
    } catch (error: any) {
        console.error('[Clients Incremental Search API] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
