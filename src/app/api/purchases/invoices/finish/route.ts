import { NextResponse } from 'next/server';
import { mysqlQuery } from '@/lib/mysql';

export async function POST(request: Request) {
    try {
        const { idReciboMovil, idTienda, uuid } = await request.json();

        if (!idReciboMovil || !idTienda || !uuid) {
            return NextResponse.json({ error: 'idReciboMovil, idTienda and uuid are required' }, { status: 400 });
        }

        // Using exactly the table name and columns verified from schema
        const sql = `
            UPDATE tblReciboMovil 
            SET UUID = ?, ModificadoUUID = 1 
            WHERE IdReciboMovil = ? AND IdTienda = ?
        `;

        await mysqlQuery(sql, [uuid, idReciboMovil, idTienda]);

        return NextResponse.json({ 
            success: true, 
            message: 'Reconciliation finalized and UUID linked' 
        });
    } catch (error: any) {
        console.error('[Finish Reconciliation API] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
