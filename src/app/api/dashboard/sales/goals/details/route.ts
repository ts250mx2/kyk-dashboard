import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const idMeta = searchParams.get('idMeta');

    if (!idMeta) {
        return NextResponse.json({ error: 'IdMeta is required' }, { status: 400 });
    }

    try {
        // Get Concepts
        const concepts = await query(`
            SELECT mc.*, d.Depto, a.Descripcion as Articulo
            FROM tblMetasConceptos mc
            LEFT JOIN tblDeptos d ON mc.IdDepto = d.IdDepto
            LEFT JOIN tblArticulos a ON mc.CodigoInterno = a.CodigoInterno
            WHERE mc.IdMeta = ?
        `, [idMeta]);

        // Get Stores
        const stores = await query(`
            SELECT mt.*, t.Tienda as Tienda
            FROM tblMetasTiendas mt
            JOIN tblTiendas t ON mt.IdTienda = t.IdTienda
            WHERE mt.IdMeta = ?
        `, [idMeta]);

        // Get Header
        const header = await query(`SELECT Meta, FechaInicio, FechaFin FROM tblMetas WHERE IdMeta = ?`, [idMeta]);

        return NextResponse.json({ 
            header: header && (header as any[]).length > 0 ? header[0] : null,
            concepts, 
            stores 
        });
    } catch (error) {
        console.error('Error fetching goal details:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
