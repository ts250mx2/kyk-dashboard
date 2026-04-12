import { NextResponse } from 'next/server';
import { mysqlQuery } from '@/lib/mysql';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const uuid = searchParams.get('uuid');

    if (!uuid) {
        return NextResponse.json({ error: 'UUID is required' }, { status: 400 });
    }

    try {
        // Querying from BDCFDV40.tblComprobantesXML
        const sql = `
            SELECT XMLTexto
            FROM BDCFDV40.tblComprobantesXML
            WHERE UUID = ?
        `;

        const results: any = await mysqlQuery(sql, [uuid]);

        if (!results || results.length === 0) {
            return NextResponse.json({ error: 'XML not found for this invoice' }, { status: 404 });
        }

        const xmlContent = results[0].XMLTexto;

        // Return a JSON with the XML content
        return NextResponse.json({ xml: xmlContent });
    } catch (error: any) {
        console.error('[Invoice XML API] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
