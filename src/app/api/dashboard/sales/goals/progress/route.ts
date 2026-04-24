import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const idMeta = searchParams.get('idMeta');

    if (!idMeta) {
        return NextResponse.json({ error: 'IdMeta is required' }, { status: 400 });
    }

    try {
        // 1. Get Meta Info
        const metaResult = await query(`SELECT Meta, FechaInicio, FechaFin FROM tblMetas WHERE IdMeta = ?`, [idMeta]);
        if (!metaResult || metaResult.length === 0) {
            return NextResponse.json({ error: 'Meta not found' }, { status: 404 });
        }
        const meta = metaResult[0] as any;

        // 2. Get Concepts
        const concepts = await query(`SELECT * FROM tblMetasConceptos WHERE IdMeta = ?`, [idMeta]) as any[];

        // 3. Get Targets per Store
        const targets = await query(`
            SELECT mt.*, t.Tienda 
            FROM tblMetasTiendas mt
            JOIN tblTiendas t ON mt.IdTienda = t.IdTienda
            WHERE mt.IdMeta = ?
        `, [idMeta]) as any[];

        const startStr = `'${meta.FechaInicio.toISOString().split('T')[0]} 00:00:00'`;
        const endStr = `'${meta.FechaFin.toISOString().split('T')[0]} 23:59:59'`;

        let progressData: any[] = [];

        if (concepts.length === 0) {
            // Total Sales
            progressData = await query(`
                SELECT v.IdTienda, SUM(v.Total) as Actual
                FROM tblVentas v
                WHERE v.FechaVenta >= ${startStr} AND v.FechaVenta <= ${endStr} 
                GROUP BY v.IdTienda
            `) as any[];
        } else {
            // Filtered Sales by Concepts
            // Build sub-filters
            const deptoIds = concepts.filter(c => c.IdDepto > 0).map(c => c.IdDepto);
            const familias = concepts.filter(c => c.Familia !== '' && c.IdDepto === 0 && c.CodigoInterno === 0).map(c => c.Familia);
            const codigos = concepts.filter(c => c.CodigoInterno > 0).map(c => c.CodigoInterno);

            const filters: string[] = [];
            if (deptoIds.length > 0) filters.push(`a.IdDepto IN (${deptoIds.join(',')})`);
            if (familias.length > 0) filters.push(`a.Familia IN (${familias.map(f => `'${f}'`).join(',')})`);
            if (codigos.length > 0) filters.push(`dv.CodigoInterno IN (${codigos.join(',')})`);

            const filterQuery = filters.length > 0 ? `AND (${filters.join(' OR ')})` : '';

            progressData = await query(`
                SELECT v.IdTienda, SUM(dv.PrecioVenta * dv.Cantidad) as Actual
                FROM tblVentas v
                JOIN tblDetalleVentas dv ON v.IdVenta = dv.IdVenta AND v.IdTienda = dv.IdTienda AND v.IdComputadora = dv.IdComputadora
                JOIN tblArticulos a ON dv.CodigoInterno = a.CodigoInterno
                WHERE v.FechaVenta >= ${startStr} AND v.FechaVenta <= ${endStr}
                ${filterQuery}
                GROUP BY v.IdTienda
            `) as any[];
        }

        // Merge Progress with Targets
        const result = targets.map(t => {
            const progress = progressData.find(p => p.IdTienda === t.IdTienda);
            return {
                IdTienda: t.IdTienda,
                Tienda: t.Tienda,
                Target: t.MontoMeta || 0,
                Actual: progress ? progress.Actual : 0,
                Percent: (t.MontoMeta > 0) ? (progress ? (progress.Actual / t.MontoMeta * 100) : 0) : 0
            };
        });

        const totalActual = result.reduce((acc, curr) => acc + curr.Actual, 0);
        const totalTarget = result.reduce((acc, curr) => acc + curr.Target, 0);
        const totalPercent = totalTarget > 0 ? (totalActual / totalTarget * 100) : 0;

        return NextResponse.json({
            totalActual,
            totalTarget,
            totalPercent,
            fechaInicio: meta.FechaInicio,
            fechaFin: meta.FechaFin,
            details: result
        });
    } catch (error) {
        console.error('Error calculating progress:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
