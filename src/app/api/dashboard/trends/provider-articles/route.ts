import { NextResponse } from 'next/server';
import { query, getPool } from '@/lib/db';
import sql from 'mssql';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const idProveedor = searchParams.get('idProveedor');

        if (!idProveedor) {
            return NextResponse.json({ error: 'Missing idProveedor' }, { status: 400 });
        }

        const sqlQuery = `
            SELECT ap.CodigoInterno, a.Descripcion, ap.Costo, ap.CodigoCompra, ap.DescripcionCompra
            FROM tblArticulosProveedor ap
            JOIN tblArticulos a ON ap.CodigoInterno = a.CodigoInterno
            WHERE ap.IdProveedor = @p0
            ORDER BY a.Descripcion
        `;

        const results = await query(sqlQuery, [idProveedor]);
        return NextResponse.json(results);
    } catch (error: any) {
        console.error('Error fetching provider articles:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { idProveedor } = body;

        if (!idProveedor) {
            return NextResponse.json({ error: 'Missing idProveedor' }, { status: 400 });
        }

        const pool = await getPool();
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            // 1. Delete existing mapping for this provider
            const deleteRequest = new sql.Request(transaction);
            deleteRequest.input('idProveedor', sql.Int, idProveedor);
            await deleteRequest.query('DELETE FROM tblArticulosProveedor WHERE IdProveedor = @idProveedor');

            // 2. Insert from tblArticulos where IdProveedorDefault matches
            const insertRequest = new sql.Request(transaction);
            insertRequest.input('idProveedor', sql.Int, idProveedor);
            await insertRequest.query(`
                INSERT INTO tblArticulosProveedor (
                    CodigoInterno, IdProveedor, Costo, DescripcionCompra, CantidadCompra, FechaAct
                )
                SELECT 
                    CodigoInterno, @idProveedor, UltimoCosto, DescripcionCompra, CantidadCompra, GETDATE()
                FROM tblArticulos
                WHERE IdProveedorDefault = @idProveedor
            `);

            await transaction.commit();
            
            // Return the updated list
            const updatedList = await query(`
                SELECT ap.CodigoInterno, a.Descripcion, ap.Costo, ap.CodigoCompra, ap.DescripcionCompra
                FROM tblArticulosProveedor ap
                JOIN tblArticulos a ON ap.CodigoInterno = a.CodigoInterno
                WHERE ap.IdProveedor = @p0
                ORDER BY a.Descripcion
            `, [idProveedor]);

            return NextResponse.json({ success: true, articles: updatedList });
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    } catch (error: any) {
        console.error('Error syncing provider articles:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
