/**
 * maybeBuildShare — decide si una respuesta de WhatsApp "amerita" un link con
 * gráfica/tabla y, en ese caso, congela el snapshot y devuelve la URL pública.
 *
 * Regla de "amerita": al menos 2 filas y alguna columna numérica (algo que se
 * pueda graficar/tabular con valor). Un escalar suelto ("vendiste $14,820 ayer")
 * NO genera link: el texto basta. Nunca lanza: si algo falla, regresa null y la
 * respuesta de WhatsApp sigue normal.
 */

import { createShare } from './shares-store';

function hasNumericColumn(rows: Record<string, any>[]): boolean {
    if (!rows.length) return false;
    const sample = rows[0];
    return Object.keys(sample).some((k) => {
        const v = sample[k];
        if (typeof v === 'number') return true;
        if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim())) return true;
        return false;
    });
}

export interface MaybeShareInput {
    question: string;
    answer: string;
    tool: string;
    rows: Record<string, any>[];
    viz?: string | null;
    sql?: string;
    insights?: string[];
    fromPhone?: string;
    tenantId?: string;
    baseUrl: string;          // base absoluta para el link (PUBLIC_BASE_URL o el origin del request)
}

export async function maybeBuildShare(input: MaybeShareInput): Promise<{ uuid: string; url: string } | null> {
    const rows = Array.isArray(input.rows) ? input.rows : [];
    if (rows.length < 2 || !hasNumericColumn(rows)) return null;
    try {
        const uuid = await createShare({
            question: input.question,
            answer: input.answer,
            tool: input.tool,
            viz: input.viz ?? null,
            sql: input.sql ?? null,
            rows: rows.slice(0, 500),
            insights: input.insights,
            fromPhone: input.fromPhone,
            tenantId: input.tenantId,
        });
        const base = (input.baseUrl || '').replace(/\/$/, '');
        return { uuid, url: `${base}/r/${uuid}` };
    } catch (e) {
        console.error('maybeBuildShare error:', e);
        return null; // jamás rompe la respuesta de WhatsApp
    }
}
