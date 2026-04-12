import { NextResponse } from 'next/server';
import { mysqlQuery } from '@/lib/mysql';
import fs from 'fs';
import path from 'path';

const LOG_FILE = path.join(process.cwd(), 'scratch/api_debug.log');

function debugLog(msg: string, data?: any) {
    const timestamp = new Date().toISOString();
    const content = `${timestamp} - ${msg} ${data ? JSON.stringify(data) : ''}\n`;
    try {
        fs.appendFileSync(LOG_FILE, content);
    } catch (e) {
        console.error('Failed to write to debug log:', e);
    }
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const idProveedor = searchParams.get('idProveedor');

    debugLog('[GET] Relations called', { idProveedor });
    if (!idProveedor) {
        debugLog('[GET] Error: idProveedor missing');
        return NextResponse.json({ error: 'idProveedor is required' }, { status: 400 });
    }

    try {
        const sql = `
            SELECT CodigoInterno, NoIdentificacion, Descripcion 
            FROM tblRelacionArticulosFacturas 
            WHERE IdProveedor = ?
        `;
        const results = await mysqlQuery(sql, [idProveedor]);
        debugLog('[GET] Results count:', (results as any[])?.length);
        return NextResponse.json(results || []);
    } catch (error: any) {
        debugLog('[GET] Exception:', error.message);
        console.error('[Invoice Relations GET] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { CodigoInterno, IdProveedor, Descripcion, NoIdentificacion } = body;

        debugLog('[POST] Saving relation', { CodigoInterno, IdProveedor, Descripcion, NoIdentificacion });

        // Requires IdProveedor and Descripcion at minimum (the new Primary Key)
        if (!CodigoInterno || !IdProveedor || !Descripcion) {
            debugLog('[POST] Error: Missing essential fields (CodigoInterno/IdProveedor/Descripcion)');
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const sql = `
            REPLACE INTO tblRelacionArticulosFacturas (CodigoInterno, IdProveedor, Descripcion, NoIdentificacion, FechaAct)
            VALUES (?, ?, ?, ?, NOW())
        `;

        const result = await mysqlQuery(sql, [CodigoInterno, IdProveedor, Descripcion, NoIdentificacion]);
        debugLog('[POST] Result:', result);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        debugLog('[POST] Exception:', error.message);
        console.error('[Invoice Relations POST] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const idProveedor = searchParams.get('idProveedor');
        const noIdentificacion = searchParams.get('noIdentificacion');
        const Descripcion = searchParams.get('Descripcion');

        if (!idProveedor || !Descripcion) {
            return NextResponse.json({ error: 'idProveedor and Descripcion are required' }, { status: 400 });
        }

        const sql = `
            DELETE FROM tblRelacionArticulosFacturas 
            WHERE IdProveedor = ? AND Descripcion = ?
        `;

        await mysqlQuery(sql, [idProveedor, Descripcion]);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[Invoice Relations DELETE] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
