import { NextResponse } from 'next/server';
import { mysqlQuery } from '@/lib/mysql';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const uuid = searchParams.get('uuid');

    if (!uuid) {
        return NextResponse.json({ error: 'UUID is required' }, { status: 400 });
    }

    try {
        // Querying from BDCFDV40 database
        // Using exactly the table name and columns provided by the user
        const sql = `
            SELECT 
                UUID, 
                Serie, 
                Folio, 
                Fecha, 
                CondicionesPago, 
                Subtotal, 
                Descuento, 
                Total, 
                Moneda, 
                MetodoPago, 
                LugarExpedicion, 
                UsoCFDI, 
                RFCEmisor, 
                B.EmisorReceptor AS Emisor, 
                RFCReceptor, 
                C.EmisorReceptor AS Receptor, 
                TipoComprobante 
            FROM BDCFDV40.tblComprobantes A
            INNER JOIN BDCFDV40.tblEmisoresReceptores B ON A.RFCEmisor = B.RFC            
            INNER JOIN BDCFDV40.tblEmisoresReceptores C ON A.RFCReceptor = C.RFC            
            WHERE A.UUID = ?
        `;

        const results: any = await mysqlQuery(sql, [uuid]);

        if (!results || results.length === 0) {
            return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
        }

        return NextResponse.json(results[0]);
    } catch (error: any) {
        console.error('[Invoice Details API] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
