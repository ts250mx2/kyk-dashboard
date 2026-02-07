import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
    try {
        const results = await query('SELECT * FROM tblPalabrasClave WHERE Status != 2 ORDER BY Consecutivo');
        return NextResponse.json(results);
    } catch (error: any) {
        console.error('Error fetching keywords:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const { PalabraClave } = await req.json();
        console.log('AI-LEARNING POST: Requesting to add keyword:', PalabraClave);

        if (!PalabraClave) {
            console.warn('AI-LEARNING POST: Missing PalabraClave');
            return NextResponse.json({ error: 'Palabra Clave is required' }, { status: 400 });
        }

        // Get max consecutivo
        console.log('AI-LEARNING POST: Calculating next consecutive...');
        const maxResult = await query('SELECT ISNULL(MAX(Consecutivo), 0) as MaxCons FROM tblPalabrasClave');
        const nextCons = (maxResult[0] as any).MaxCons + 1;
        console.log('AI-LEARNING POST: Next consecutive is:', nextCons);

        console.log('AI-LEARNING POST: Executing INSERT query...');
        await query(
            'INSERT INTO tblPalabrasClave (PalabraClave, FechaAct, Status, Consecutivo) VALUES (?, GETDATE(), 0, ?)',
            [PalabraClave, nextCons]
        );
        console.log('AI-LEARNING POST: Keyword added successfully');

        return NextResponse.json({ message: 'Keyword added successfully' });
    } catch (error: any) {
        console.error('AI-LEARNING POST Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const { IdPalabraClave, PalabraClave, Consecutivo, Status } = await req.json();

        if (!IdPalabraClave) {
            return NextResponse.json({ error: 'IdPalabraClave is required' }, { status: 400 });
        }

        await query(
            'UPDATE tblPalabrasClave SET PalabraClave = ?, Consecutivo = ?, Status = ?, FechaAct = GETDATE() WHERE IdPalabraClave = ?',
            [PalabraClave, Consecutivo, Status ?? 0, IdPalabraClave]
        );

        return NextResponse.json({ message: 'Keyword updated successfully' });
    } catch (error: any) {
        console.error('Error updating keyword:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        const { id1, cons1, id2, cons2 } = await req.json();

        if (!id1 || !id2) {
            return NextResponse.json({ error: 'Both IDs are required' }, { status: 400 });
        }

        // Use a transaction or just two updates. For simplicity here:
        await query('UPDATE tblPalabrasClave SET Consecutivo = ?, FechaAct = GETDATE() WHERE IdPalabraClave = ?', [cons2, id1]);
        await query('UPDATE tblPalabrasClave SET Consecutivo = ?, FechaAct = GETDATE() WHERE IdPalabraClave = ?', [cons1, id2]);

        return NextResponse.json({ message: 'Order updated successfully' });
    } catch (error: any) {
        console.error('Error reordering keywords:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'ID is required' }, { status: 400 });
        }

        await query('UPDATE tblPalabrasClave SET Status = 2, FechaAct = GETDATE() WHERE IdPalabraClave = ?', [id]);

        return NextResponse.json({ message: 'Keyword deleted successfully' });
    } catch (error: any) {
        console.error('Error deleting keyword:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
