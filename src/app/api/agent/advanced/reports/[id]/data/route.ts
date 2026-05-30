import { NextResponse } from 'next/server';
import { getUserId } from '@/lib/conversations';
import { getReportById } from '@/lib/advanced-reports/reports-store';
import { substituteParams } from '@/lib/advanced-reports/params';
import { assertReadOnly } from '@/lib/sql-sandbox';
import { query } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * GET /api/agent/advanced/reports/[id]/data
 *
 * Re-ejecuta el SQL guardado (read-only) y devuelve filas + definición para
 * que el visor lo renderice dinámicamente. El reporte es "vivo": refleja datos
 * actuales en cada visita (no es un snapshot). Crear reportes NO requiere deploy.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const idReporte = Number(id);
    if (!Number.isFinite(idReporte) || idReporte <= 0) {
        return NextResponse.json({ error: 'id inválido' }, { status: 400 });
    }

    const userId = await getUserId().catch(() => 'anonymous');
    const report = await getReportById(userId, idReporte);
    if (!report || !report.definition) {
        return NextResponse.json({ error: 'Reporte no encontrado' }, { status: 404 });
    }

    const def = report.definition;
    try {
        // Sustituye los tokens {{...}} con los valores del usuario (o defaults).
        const url = new URL(req.url);
        const values: Record<string, string> = {};
        if (Array.isArray(def.params)) {
            for (const p of def.params) {
                const v = url.searchParams.get(p.token);
                if (v !== null) values[p.token] = v;
            }
        }
        const sql = assertReadOnly(substituteParams(def.sql, def.params, values));
        const rows = (await query(sql)) as any[];
        const rowLimit = typeof def.rowLimit === 'number' ? def.rowLimit : 500;
        const limited = rows.slice(0, rowLimit);

        return NextResponse.json({
            definition: def,
            rows: limited,
            rowCount: rows.length,
            title: report.titulo,
            descripcion: report.descripcion,
            modelo: report.modelo,
            cost: {
                realCostoUsd: report.realCostoUsd,
                realCostoMxn: report.realCostoMxn,
                estCostoMxn: report.estCostoMxn,
                tokensInput: report.realTokensInput,
                tokensOutput: report.realTokensOutput,
            },
            fechaCreacion: report.fechaCreacion,
        });
    } catch (e: any) {
        return NextResponse.json(
            { error: e?.message || 'Error ejecutando el reporte', definition: def },
            { status: 500 }
        );
    }
}
