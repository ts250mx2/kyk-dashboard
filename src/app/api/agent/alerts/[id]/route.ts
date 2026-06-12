import { NextResponse } from 'next/server';
import { updateAlertActive, updateAlert, updateAlertPhones, updateAlertHoraEnvio, deleteAlert, getAlert, splitPhones, normalizeHora, isEndOfDayClave, CondicionTipo, Frecuencia } from '@/lib/alerts';
import { getUserId } from '@/lib/conversations';
import { normalizePhone } from '@/lib/whatsapp/send';

/**
 * PATCH /api/agent/alerts/[id]
 *  - { active: boolean }                       → activa/desactiva
 *  - { telefono?, horaEnvio? }                 → números WhatsApp y/u hora de envío
 *                                                (lo único editable en alertas de sistema)
 *  - { name, sql, conditionType, ... }         → edición completa de la alerta
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const userId = await getUserId();
        const body = await req.json();

        // Solo toggle de estado
        if (typeof body.active === 'boolean' && body.name === undefined && body.sql === undefined) {
            await updateAlertActive(userId, id, body.active);
            return NextResponse.json({ success: true });
        }

        // Solo números y/u hora de envío (lo único editable de una alerta de sistema)
        const phonesOnly = typeof body.telefono === 'string';
        const horaOnly = typeof body.horaEnvio === 'string';
        if ((phonesOnly || horaOnly) && body.name === undefined && body.sql === undefined) {
            const existing = await getAlert(userId, id);
            if (!existing) {
                return NextResponse.json({ error: 'Alerta no encontrada' }, { status: 404 });
            }

            let telefono: string | undefined = undefined;
            if (phonesOnly) {
                const phones = Array.from(new Set(
                    splitPhones(body.telefono).map(normalizePhone).filter(Boolean)
                )).slice(0, 20);
                telefono = phones.join(',');
                await updateAlertPhones(userId, id, telefono);
            }

            let horaEnvio: string | undefined = undefined;
            if (horaOnly) {
                if (!isEndOfDayClave(existing.clave)) {
                    return NextResponse.json(
                        { error: 'Solo las alertas de hora fija permiten cambiar la hora de envío.' },
                        { status: 400 }
                    );
                }
                const hora = normalizeHora(body.horaEnvio);
                if (!hora) {
                    return NextResponse.json({ error: 'Hora inválida; usa formato HH:MM (ej. 19:30).' }, { status: 400 });
                }
                horaEnvio = hora;
                await updateAlertHoraEnvio(userId, id, hora);
            }

            return NextResponse.json({
                success: true,
                ...(telefono !== undefined ? { telefono } : {}),
                ...(horaEnvio !== undefined ? { horaEnvio } : {}),
            });
        }

        // Edición completa
        if (body.name && body.sql && body.conditionType) {
            const existing = await getAlert(userId, id);
            if (existing?.clave) {
                return NextResponse.json(
                    { error: 'Las alertas automáticas solo permiten editar los números de WhatsApp.' },
                    { status: 403 }
                );
            }
            const validConditions: CondicionTipo[] = ['gt', 'gte', 'lt', 'lte', 'eq', 'neq', 'has_rows'];
            if (!validConditions.includes(body.conditionType)) {
                return NextResponse.json({ error: 'conditionType inválido' }, { status: 400 });
            }
            const validFrequencies: Frecuencia[] = ['5min', 'hourly', 'daily', 'weekly'];
            const freq: Frecuencia = validFrequencies.includes(body.frequency) ? body.frequency : 'hourly';

            await updateAlert(userId, id, {
                name: String(body.name).slice(0, 200),
                description: body.description ? String(body.description).slice(0, 500) : null,
                sql: String(body.sql),
                conditionType: body.conditionType,
                conditionValue: body.conditionType === 'has_rows'
                    ? null
                    : (typeof body.conditionValue === 'number' ? body.conditionValue : parseFloat(body.conditionValue)),
                targetColumn: body.targetColumn ? String(body.targetColumn).slice(0, 100) : null,
                frequency: freq,
                telefono: body.telefono ? String(body.telefono).slice(0, 500) : null
            });
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Faltan campos: "active", o (name, sql, conditionType)' }, { status: 400 });
    } catch (error: any) {
        console.error('updateAlert error:', error);
        return NextResponse.json(
            { error: error.message || 'Error actualizando alerta' },
            { status: 500 }
        );
    }
}

/** DELETE /api/agent/alerts/[id] → elimina la alerta */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const userId = await getUserId();
        const existing = await getAlert(userId, id);
        if (existing?.clave) {
            return NextResponse.json(
                { error: 'Las alertas automáticas no se pueden eliminar.' },
                { status: 403 }
            );
        }
        await deleteAlert(userId, id);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('deleteAlert error:', error);
        return NextResponse.json(
            { error: error.message || 'Error eliminando alerta' },
            { status: 500 }
        );
    }
}
