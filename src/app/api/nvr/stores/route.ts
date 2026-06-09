import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * GET /api/nvr/stores
 * Tiendas activas para el selector de NVR's.
 */
export async function GET() {
    try {
        const rows = await query(
            'SELECT IdTienda, Tienda FROM dbo.tblTiendas WHERE Status = 0 ORDER BY Tienda'
        );
        return NextResponse.json(rows);
    } catch (error: any) {
        console.error('Error fetching stores:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
