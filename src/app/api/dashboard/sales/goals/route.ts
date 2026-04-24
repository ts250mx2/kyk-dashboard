import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
    try {
        const goals = await query(`
            SELECT IdMeta, Meta, FechaInicio, FechaFin, FechaAct, Status 
            FROM tblMetas 
            WHERE Status = 0 
            ORDER BY FechaAct DESC
        `);
        return NextResponse.json(goals);
    } catch (error) {
        console.error('Error fetching goals:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { IdMeta, Meta, FechaInicio, FechaFin } = body;
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

        if (IdMeta) {
            // Update
            await query(
                `UPDATE tblMetas SET Meta = ?, FechaInicio = ?, FechaFin = ? WHERE IdMeta = ?`,
                [Meta, FechaInicio, FechaFin, IdMeta]
            );
            return NextResponse.json({ success: true, IdMeta });
        } else {
            // Insert
            const result = await query(
                `INSERT INTO tblMetas (Meta, FechaInicio, FechaFin, FechaAct, Status) 
                 VALUES (?, ?, ?, ?, 0);
                 SELECT SCOPE_IDENTITY() as IdMeta;`,
                [Meta, FechaInicio, FechaFin, now]
            );
            const newIdMeta = (result as any)[0].IdMeta;

            // When new, auto-insert stores
            // SELECT IdTienda FROM tblTiendas WHERE IdRazonSocial IN (3,8) AND Status = 0
            const stores = await query(`SELECT IdTienda FROM tblTiendas WHERE IdRazonSocial IN (3,8) AND Status = 0`);
            
            for (const store of stores as any[]) {
                await query(
                    `INSERT INTO tblMetasTiendas (IdMeta, IdTienda, MontoMeta) VALUES (?, ?, 0)`,
                    [newIdMeta, store.IdTienda]
                );
            }

            return NextResponse.json({ success: true, IdMeta: newIdMeta });
        }
    } catch (error) {
        console.error('Error saving goal:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
