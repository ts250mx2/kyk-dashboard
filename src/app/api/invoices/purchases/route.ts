import { NextResponse } from 'next/server';
import { mysqlQuery } from '@/lib/mysql';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
        return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
    }

    try {
        const sql = `
            SELECT A.UUID, A.Serie, A.Folio, A.Fecha, A.RFCEmisor, B.EmisorReceptor, A.RFCReceptor, A.CondicionesPago, A.Subtotal, A.Descuento, A.Total, A.UsoCFDI 
            FROM BDCFDV40.tblComprobantes A
            INNER JOIN BDCFDV40.tblEmisoresReceptores B ON A.RFCEmisor = B.RFC
            WHERE A.Fecha >= ? AND A.Fecha <= ? 
            ORDER BY A.Fecha
        `;

        const results = await mysqlQuery(sql, [startDate, endDate + ' 23:59:59']);
        return NextResponse.json(results);
    } catch (error: any) {
        console.error('[Purchases Invoices List API] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
