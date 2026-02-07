import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
    try {
        const sql = `
            SELECT IdTienda, Tienda 
            FROM SucursalesActivas 
            ORDER BY Tienda
        `;
        const result = await query(sql);
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Error fetching branches:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
