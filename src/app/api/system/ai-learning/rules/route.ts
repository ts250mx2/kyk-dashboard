import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const idPalabraClave = searchParams.get('idPalabraClave');

        if (!idPalabraClave) {
            return NextResponse.json({ error: 'idPalabraClave is required' }, { status: 400 });
        }

        const results = await query(
            'SELECT * FROM tblReglasPalabrasClave WHERE IdPalabraClave = ? AND Status != 2 ORDER BY Consecutivo',
            [idPalabraClave]
        );
        return NextResponse.json(results);
    } catch (error: any) {
        console.error('Error fetching rules:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const { IdPalabraClave, Regla } = await req.json();

        if (!IdPalabraClave || !Regla) {
            return NextResponse.json({ error: 'IdPalabraClave and Regla are required' }, { status: 400 });
        }

        // Get max consecutivo for this keyword
        const maxResult = await query(
            'SELECT ISNULL(MAX(Consecutivo), 0) as MaxCons FROM tblReglasPalabrasClave WHERE IdPalabraClave = ?',
            [IdPalabraClave]
        );
        const nextCons = (maxResult[0] as any).MaxCons + 1;

        console.log('Consecutivo:', nextCons);
        await query(
            'INSERT INTO tblReglasPalabrasClave (IdPalabraClave, Regla, FechaAct, Status, Consecutivo) VALUES (?, ?, GETDATE(), 0, ?)',
            [IdPalabraClave, Regla, nextCons]
        );

        return NextResponse.json({ message: 'Rule added successfully' });
    } catch (error: any) {
        console.error('Error adding rule:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const { IdReglaPalabraClave, Regla, Consecutivo, Status } = await req.json();

        if (!IdReglaPalabraClave) {
            return NextResponse.json({ error: 'IdReglaPalabraClave is required' }, { status: 400 });
        }

        await query(
            'UPDATE tblReglasPalabrasClave SET Regla = ?, Consecutivo = ?, Status = ?, FechaAct = GETDATE() WHERE IdReglaPalabraClave = ?',
            [Regla, Consecutivo, Status ?? 0, IdReglaPalabraClave]
        );

        return NextResponse.json({ message: 'Rule updated successfully' });
    } catch (error: any) {
        console.error('Error updating rule:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        const { id1, cons1, id2, cons2 } = await req.json();

        if (!id1 || !id2) {
            return NextResponse.json({ error: 'Both IDs are required' }, { status: 400 });
        }

        await query('UPDATE tblReglasPalabrasClave SET Consecutivo = ?, FechaAct = GETDATE() WHERE IdReglaPalabraClave = ?', [cons2, id1]);
        await query('UPDATE tblReglasPalabrasClave SET Consecutivo = ?, FechaAct = GETDATE() WHERE IdReglaPalabraClave = ?', [cons1, id2]);

        return NextResponse.json({ message: 'Order updated successfully' });
    } catch (error: any) {
        console.error('Error reordering rules:', error);
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

        await query('UPDATE tblReglasPalabrasClave SET Status = 2, FechaAct = GETDATE() WHERE IdReglaPalabraClave = ?', [id]);

        return NextResponse.json({ message: 'Rule deleted successfully' });
    } catch (error: any) {
        console.error('Error deleting rule:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
