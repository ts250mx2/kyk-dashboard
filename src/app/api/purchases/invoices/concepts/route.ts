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
                C.Cantidad, 
                C.Unidad, 
                C.ClaveProdServ, 
                C.NoIdentificacion, 
                C.Descripcion, 
                C.ValorUnitario, 
                (C.Importe + IFNULL((
                    SELECT SUM(Importe) 
                    FROM BDCFDV40.tblComprobantesConceptosImpuestos I 
                    WHERE I.UUID = C.UUID AND I.IdRenglon = C.IdRenglon
                ), 0)) AS Importe,
                C.Descuento
            FROM BDCFDV40.tblComprobantesConceptos C
            WHERE C.UUID = ?
        `;

        const results: any = await mysqlQuery(sql, [uuid]);
        return NextResponse.json(results || []);
    } catch (error: any) {
        console.error('[Invoice Concepts API] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
