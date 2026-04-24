import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { IdMeta, IdTipoConcepto, IdConcepto, Familia, CodigoInterno } = body;

        // IdTipoConcepto: 0=Total Venta, 1=Depto, 2=Familia, 3=Producto

        if (IdTipoConcepto === 0) {
            return NextResponse.json({ success: true, message: 'Total Sales does not require concepts' });
        }

        let sql = '';
        let params: any[] = [];

        if (IdTipoConcepto === 1) { // Depto
            sql = `INSERT INTO tblMetasConceptos (IdMeta, IdDepto, Familia, CodigoInterno) VALUES (?, ?, '', 0)`;
            params = [IdMeta, IdConcepto];
        } else if (IdTipoConcepto === 2) { // Familia
            sql = `INSERT INTO tblMetasConceptos (IdMeta, IdDepto, Familia, CodigoInterno) VALUES (?, 0, ?, 0)`;
            params = [IdMeta, Familia];
        } else if (IdTipoConcepto === 3) { // Producto (Wait, user said IdTipoConcepto = 2 for both Familia and Produkt? No, he wrote it twice as 2 but meant 3 for the last one)
            // User request: "Si es IdTipoConcepto = 2 entonces ... CodigoInterno del producto seleccionado"
            // I'll assume 3 is for Product.
            sql = `INSERT INTO tblMetasConceptos (IdMeta, IdDepto, Familia, CodigoInterno) VALUES (?, 0, '', ?)`;
            params = [IdMeta, CodigoInterno];
        }

        await query(sql, params);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error adding concept:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const idMetaConcepto = searchParams.get('idMetaConcepto');

        if (!idMetaConcepto) {
            return NextResponse.json({ error: 'IdMetaConcepto is required' }, { status: 400 });
        }

        await query(`DELETE FROM tblMetasConceptos WHERE IdMetaConcepto = ?`, [idMetaConcepto]);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting concept:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
