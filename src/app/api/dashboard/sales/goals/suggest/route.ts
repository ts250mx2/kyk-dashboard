import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const idMeta = searchParams.get('idMeta');
    const fechaInicio = searchParams.get('fechaInicio');
    const fechaFin = searchParams.get('fechaFin');

    if (!idMeta || !fechaInicio || !fechaFin) {
        return NextResponse.json({ error: 'idMeta, fechaInicio and fechaFin are required' }, { status: 400 });
    }

    try {
        // 1. Get Concepts
        const concepts = await query(`SELECT * FROM tblMetasConceptos WHERE IdMeta = ?`, [idMeta]) as any[];

        const startStr = `'${fechaInicio} 00:00:00'`;
        const endStr = `'${fechaFin} 23:59:59'`;

        let salesData: any[] = [];

        if (concepts.length === 0) {
            // Total Sales
            salesData = await query(`
                SELECT v.IdTienda, SUM(v.Total) as Sales
                FROM tblVentas v
                WHERE v.FechaVenta >= ${startStr} AND v.FechaVenta <= ${endStr} 
                GROUP BY v.IdTienda
            `) as any[];
        } else {
            // Filtered Sales by Concepts
            const deptoIds = concepts.filter(c => c.IdDepto > 0).map(c => c.IdDepto);
            const familias = concepts.filter(c => c.Familia !== '' && c.IdDepto === 0 && c.CodigoInterno === 0).map(c => c.Familia);
            const codigos = concepts.filter(c => c.CodigoInterno > 0).map(c => c.CodigoInterno);

            const filters: string[] = [];
            if (deptoIds.length > 0) filters.push(`a.IdDepto IN (${deptoIds.join(',')})`);
            if (familias.length > 0) filters.push(`a.Familia IN (${familias.map(f => `'${f}'`).join(',')})`);
            if (codigos.length > 0) filters.push(`dv.CodigoInterno IN (${codigos.join(',')})`);

            const filterQuery = filters.length > 0 ? `AND (${filters.join(' OR ')})` : '';

            salesData = await query(`
                SELECT v.IdTienda, SUM(dv.PrecioVenta * dv.Cantidad) as Sales
                FROM tblVentas v
                JOIN tblDetalleVentas dv ON v.IdVenta = dv.IdVenta AND v.IdTienda = dv.IdTienda AND v.IdComputadora = dv.IdComputadora
                JOIN tblArticulos a ON dv.CodigoInterno = a.CodigoInterno
                WHERE v.FechaVenta >= ${startStr} AND v.FechaVenta <= ${endStr}
                ${filterQuery}
                GROUP BY v.IdTienda
            `) as any[];
        }

        // Get all stores to ensure we return 0 for those without sales
        const stores = await query(`SELECT IdTienda, Tienda FROM tblTiendas WHERE IdRazonSocial IN (3, 8)`) as any[];

        const result = stores.map(s => {
            const sale = salesData.find(sd => sd.IdTienda === s.IdTienda);
            return {
                IdTienda: s.IdTienda,
                Tienda: s.Tienda,
                Sales: sale ? sale.Sales : 0
            };
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error('Error calculating suggested goals:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
