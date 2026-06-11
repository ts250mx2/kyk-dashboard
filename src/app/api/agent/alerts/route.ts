import { NextResponse } from 'next/server';
import {
    listAlerts,
    createAlert,
    generateAlertId,
    CondicionTipo,
    Frecuencia
} from '@/lib/alerts';
import { getUserId } from '@/lib/conversations';

/** GET /api/agent/alerts → lista las alertas del usuario */
export async function GET() {
    try {
        const userId = await getUserId();
        const alerts = await listAlerts(userId);
        return NextResponse.json({ alerts });
    } catch (error: any) {
        console.error('listAlerts error:', error);
        return NextResponse.json(
            { error: error.message || 'Error listando alertas', alerts: [] },
            { status: 500 }
        );
    }
}

/** POST /api/agent/alerts → crea una nueva alerta */
export async function POST(req: Request) {
    try {
        const userId = await getUserId();
        const body = await req.json();
        const { name, description, sql, conditionType, conditionValue, targetColumn, frequency, telefono } = body;

        if (!name || !sql || !conditionType) {
            return NextResponse.json(
                { error: 'Faltan campos requeridos: name, sql, conditionType' },
                { status: 400 }
            );
        }

        const validConditions: CondicionTipo[] = ['gt', 'gte', 'lt', 'lte', 'eq', 'neq', 'has_rows'];
        if (!validConditions.includes(conditionType)) {
            return NextResponse.json({ error: 'conditionType inválido' }, { status: 400 });
        }

        const validFrequencies: Frecuencia[] = ['5min', 'hourly', 'daily', 'weekly'];
        const freq: Frecuencia = validFrequencies.includes(frequency) ? frequency : 'hourly';

        const id = generateAlertId();
        await createAlert({
            id,
            userId,
            name: String(name).slice(0, 200),
            description: description ? String(description).slice(0, 500) : null,
            sql: String(sql),
            conditionType,
            conditionValue: conditionType === 'has_rows' ? null : (typeof conditionValue === 'number' ? conditionValue : parseFloat(conditionValue)),
            targetColumn: targetColumn ? String(targetColumn).slice(0, 100) : null,
            frequency: freq,
            active: true,
            telefono: telefono ? String(telefono).slice(0, 40) : null
        });

        return NextResponse.json({ success: true, id });
    } catch (error: any) {
        console.error('createAlert error:', error);
        return NextResponse.json(
            { error: error.message || 'Error creando alerta' },
            { status: 500 }
        );
    }
}
