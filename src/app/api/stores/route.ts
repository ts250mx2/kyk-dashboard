import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
    try {
        const results = await query('SELECT IdTienda, Tienda, Lat, Lng FROM tblTiendas WHERE Lat IS NOT NULL ORDER BY Tienda');
        return NextResponse.json(results);
    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
