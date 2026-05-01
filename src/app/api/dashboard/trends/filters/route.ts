import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
    try {
        const [deptos, familias, proveedores, articulos] = await Promise.all([
            query('SELECT IdDepto, Depto FROM tblDeptos ORDER BY Depto'),
            query("SELECT DISTINCT Familia FROM tblArticulos WHERE Familia IS NOT NULL AND Familia <> '' ORDER BY Familia"),
            query('SELECT IdProveedor, Proveedor FROM tblProveedores ORDER BY Proveedor'),
            query('SELECT CodigoInterno, Descripcion FROM tblArticulos ORDER BY Descripcion')
        ]);

        return NextResponse.json({
            deptos,
            familias,
            proveedores,
            articulos
        });
    } catch (error: any) {
        console.error('Error fetching trend filters:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
