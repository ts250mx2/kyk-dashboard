import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { IdMetaTienda, MontoMeta } = body;

        if (!IdMetaTienda) {
            return NextResponse.json({ error: 'IdMetaTienda is required' }, { status: 400 });
        }

        await query(
            `UPDATE tblMetasTiendas SET MontoMeta = ? WHERE IdMetaTienda = ?`,
            [MontoMeta, IdMetaTienda]
        );
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating store goal:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
