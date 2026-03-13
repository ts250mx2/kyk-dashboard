import { NextResponse } from 'next/server';
import { mysqlQuery } from '@/lib/mysql';

export async function GET() {
    try {
        const results = await mysqlQuery('SELECT IdTienda, Tienda FROM tblTiendas WHERE Status = 0 AND IdRazonSocial IN (3,8,10) ORDER BY Tienda');
        return NextResponse.json(results);
    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
