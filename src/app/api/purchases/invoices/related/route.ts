import { NextResponse } from 'next/server';
import { mysqlQuery } from '@/lib/mysql';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const uuid = searchParams.get('uuid');

    if (!uuid) {
        return NextResponse.json({ error: 'UUID is required' }, { status: 400 });
    }

    try {
        const sql = `
            SELECT 
                A.UUID, 
                B.Serie, 
                B.Folio, 
                B.RFCEmisor, 
                C.EmisorReceptor AS Emisor, 
                B.RFCReceptor, 
                D.EmisorReceptor AS Receptor, 
                B.CondicionesPago, 
                B.Subtotal, 
                B.Descuento, 
                B.Total, 
                B.Moneda, 
                B.TipoComprobante, 
                B.MetodoPago, 
                B.LugarExpedicion, 
                B.UsoCFDI 
            FROM BDCFDV40.tblComprobantesRelacionados A 
            INNER JOIN BDCFDV40.tblComprobantes B ON A.UUID = B.UUID
            INNER JOIN BDCFDV40.tblEmisoresReceptores C ON B.RFCEmisor = C.RFC
            INNER JOIN BDCFDV40.tblEmisoresReceptores D ON B.RFCReceptor = D.RFC
            WHERE A.UUIDRelacionado = ?
        `;

        const results: any = await mysqlQuery(sql, [uuid]);
        return NextResponse.json(results || []);
    } catch (error: any) {
        console.error('[Related Invoices API] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
