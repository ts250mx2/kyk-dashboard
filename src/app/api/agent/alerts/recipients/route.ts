import { NextResponse } from 'next/server';
import { getUserId } from '@/lib/conversations';
import { getSystemRecipients, setSystemRecipients, getSystemAlertModel, setSystemAlertModel } from '@/lib/alerts';
import { normalizePhone } from '@/lib/whatsapp/send';
import { MODEL_REGISTRY } from '@/lib/advanced-reports/models';

/**
 * Configuración COMPARTIDA de las alertas automáticas. Los DESTINATARIOS ahora
 * viven por alerta (PATCH /api/agent/alerts/[id] { telefono }); aquí queda el
 * modelo de IA y la lista legacy (solo para migración).
 *
 *   GET  → { phones: string[], model: string|null, models: [{id,label,provider}] }
 *   PUT  → body { phones?: string[], model?: string|null }
 *          (cada campo se actualiza solo si viene; model debe estar en el registro)
 */

const AVAILABLE_MODELS = MODEL_REGISTRY.map((m) => ({ id: m.id, label: m.label, provider: m.provider }));

export async function GET() {
    try {
        const userId = await getUserId();
        const [phones, model] = await Promise.all([
            getSystemRecipients(userId),
            getSystemAlertModel(userId),
        ]);
        return NextResponse.json({ phones, model, models: AVAILABLE_MODELS });
    } catch (error: any) {
        console.error('recipients GET error:', error);
        return NextResponse.json({ error: error.message || 'Error', phones: [] }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const userId = await getUserId();
        const body = await req.json();
        let phones: string[] | undefined = undefined;
        if (Array.isArray(body.phones)) {
            phones = Array.from(new Set(
                body.phones.map((p: any) => normalizePhone(String(p))).filter(Boolean)
            )).slice(0, 20) as string[];
            await setSystemRecipients(userId, phones);
        }

        let model: string | null | undefined = undefined;
        if ('model' in body) {
            model = body.model ? String(body.model) : null;
            if (model && !MODEL_REGISTRY.some((m) => m.id === model)) {
                return NextResponse.json({ error: 'Modelo no válido' }, { status: 400 });
            }
            await setSystemAlertModel(userId, model);
        }

        return NextResponse.json({
            success: true,
            ...(phones !== undefined ? { phones } : {}),
            ...(model !== undefined ? { model } : {}),
        });
    } catch (error: any) {
        console.error('recipients PUT error:', error);
        return NextResponse.json({ error: error.message || 'Error guardando configuración' }, { status: 500 });
    }
}
