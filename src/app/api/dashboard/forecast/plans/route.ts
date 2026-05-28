import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

type PlanRow = {
    IdPlan: number;
    Nombre: string;
    StoreIdsJson: string;
    HorizonDays: number;
    OverridesJson: string;
    FechaAct: Date;
};

function parseJsonSafe<T>(s: string, fallback: T): T {
    try {
        return JSON.parse(s) as T;
    } catch {
        return fallback;
    }
}

export async function GET() {
    try {
        const rows = await query(
            `SELECT IdPlan, Nombre, StoreIdsJson, HorizonDays, OverridesJson, FechaAct
             FROM tblForecastPlans
             WHERE Status = 0
             ORDER BY FechaAct DESC`
        ) as PlanRow[];

        const plans = rows.map(r => {
            const storeIds = parseJsonSafe<number[]>(r.StoreIdsJson, []);
            const overrides = parseJsonSafe<Record<string, number>>(r.OverridesJson, {});
            return {
                idPlan: r.IdPlan,
                nombre: r.Nombre,
                storeIds,
                horizonDays: r.HorizonDays,
                overrides,
                overridesCount: Object.keys(overrides).length,
                fechaAct: r.FechaAct,
            };
        });

        return NextResponse.json(plans);
    } catch (error) {
        console.error('Error listing forecast plans:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const idPlan = body.idPlan ? Number(body.idPlan) : null;
        const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : '';
        const storeIds = Array.isArray(body.storeIds)
            ? body.storeIds.map((n: unknown) => Number(n)).filter((n: number) => Number.isFinite(n))
            : [];
        const horizonDays = Math.max(1, Math.min(180, Number(body.horizonDays) || 30));
        const overrides = (body.overrides && typeof body.overrides === 'object' && !Array.isArray(body.overrides))
            ? body.overrides as Record<string, number>
            : {};

        if (!nombre) {
            return NextResponse.json({ error: 'Nombre es requerido' }, { status: 400 });
        }

        const storeIdsJson = JSON.stringify(storeIds);
        const overridesJson = JSON.stringify(overrides);

        if (idPlan) {
            await query(
                `UPDATE tblForecastPlans
                 SET Nombre = ?, StoreIdsJson = ?, HorizonDays = ?, OverridesJson = ?, FechaAct = GETDATE()
                 WHERE IdPlan = ? AND Status = 0`,
                [nombre, storeIdsJson, horizonDays, overridesJson, idPlan]
            );
            return NextResponse.json({ success: true, idPlan });
        }

        const result = await query(
            `INSERT INTO tblForecastPlans (Nombre, StoreIdsJson, HorizonDays, OverridesJson, FechaAct, Status)
             VALUES (?, ?, ?, ?, GETDATE(), 0);
             SELECT CAST(SCOPE_IDENTITY() AS INT) AS IdPlan;`,
            [nombre, storeIdsJson, horizonDays, overridesJson]
        ) as Array<{ IdPlan: number }>;
        const newId = result[0]?.IdPlan;
        return NextResponse.json({ success: true, idPlan: newId });
    } catch (error) {
        console.error('Error saving forecast plan:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 });
        }
        await query(
            `UPDATE tblForecastPlans SET Status = 1, FechaAct = GETDATE() WHERE IdPlan = ?`,
            [Number(id)]
        );
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting forecast plan:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
