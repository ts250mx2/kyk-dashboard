import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const idTienda = searchParams.get('idTienda');
        const idCaja = searchParams.get('idCaja');
        const idApertura = searchParams.get('idApertura');

        if (!idTienda || !idCaja || !idApertura) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        const sql = `
            SELECT TicketCorte
            FROM tblAperturasCierres
            WHERE IdTienda = ${idTienda} AND IdComputadora = ${idCaja} AND IdApertura = ${idApertura}
        `;

        const results = await query(sql);
        const ticket = (results as any[])[0]?.TicketCorte || 'SÍMBOLOS O TEXTO DE CORTE NO DISPONIBLES';

        return NextResponse.json({ ticket });

    } catch (error: any) {
        console.error('Error fetching closing ticket:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
