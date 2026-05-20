import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

/**
 * Tendencia de ventas de un producto específico.
 *  - codigoInterno (requerido)
 *  - fechaInicio / fechaFin (requerido)
 *  - groupBy: dia | semana | mes (default: mes)
 *  - idTienda: opcional para filtrar por sucursal
 *
 * Devuelve serie temporal {fecha, venta, cantidad, tickets} + KPIs totales.
 */

type GroupBy = 'dia' | 'semana' | 'mes';

function dateSelectorFor(groupBy: GroupBy): string {
    if (groupBy === 'semana') return 'DATEADD(WEEK, DATEDIFF(WEEK, 0, V.FechaVenta), 0)';
    if (groupBy === 'mes') return 'DATEFROMPARTS(YEAR(V.FechaVenta), MONTH(V.FechaVenta), 1)';
    return 'CAST(V.FechaVenta AS DATE)';
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const codigoInterno = searchParams.get('codigoInterno');
        const fechaInicio = searchParams.get('fechaInicio');
        const fechaFin = searchParams.get('fechaFin');
        const groupBy = (searchParams.get('groupBy') as GroupBy) || 'mes';
        const idTienda = searchParams.get('idTienda');

        if (!codigoInterno) {
            return NextResponse.json({ error: 'Falta codigoInterno' }, { status: 400 });
        }
        if (!fechaInicio || !fechaFin) {
            return NextResponse.json({ error: 'Faltan fechas' }, { status: 400 });
        }

        const codigoNum = Number(codigoInterno);
        if (isNaN(codigoNum)) {
            return NextResponse.json({ error: 'codigoInterno inválido' }, { status: 400 });
        }

        const startStr = `'${fechaInicio} 00:00:00'`;
        const endStr = `'${fechaFin} 23:59:59'`;

        let storeFilter = '';
        if (idTienda && idTienda !== 'all') {
            const ids = idTienda.split(',').map(Number).filter(n => !isNaN(n));
            if (ids.length > 0) storeFilter = `AND V.IdTienda IN (${ids.join(',')})`;
        }

        const dateSel = dateSelectorFor(groupBy);

        // Serie temporal
        const seriesSql = `
            SELECT
                ${dateSel} AS Fecha,
                ISNULL(SUM(DV.PrecioVenta * DV.Cantidad), 0) AS Venta,
                ISNULL(SUM(DV.Cantidad), 0) AS Cantidad,
                COUNT(DISTINCT V.IdVenta) AS Tickets
            FROM tblDetalleVentas DV
            INNER JOIN tblVentas V
                ON DV.IdVenta = V.IdVenta
                AND DV.IdTienda = V.IdTienda
                AND DV.IdComputadora = V.IdComputadora
            WHERE V.FechaVenta >= ${startStr} AND V.FechaVenta <= ${endStr}
            AND DV.CodigoInterno = ${codigoNum}
            ${storeFilter}
            GROUP BY ${dateSel}
            ORDER BY ${dateSel}
        `;

        // Totales
        const totalsSql = `
            SELECT
                ISNULL(SUM(DV.PrecioVenta * DV.Cantidad), 0) AS Venta,
                ISNULL(SUM(DV.Cantidad), 0) AS Cantidad,
                COUNT(DISTINCT V.IdVenta) AS Tickets,
                AVG(DV.PrecioVenta) AS PrecioPromedio
            FROM tblDetalleVentas DV
            INNER JOIN tblVentas V
                ON DV.IdVenta = V.IdVenta
                AND DV.IdTienda = V.IdTienda
                AND DV.IdComputadora = V.IdComputadora
            WHERE V.FechaVenta >= ${startStr} AND V.FechaVenta <= ${endStr}
            AND DV.CodigoInterno = ${codigoNum}
            ${storeFilter}
        `;

        const [seriesRows, totalsRows] = await Promise.all([
            query(seriesSql),
            query(totalsSql)
        ]);

        const series = (seriesRows as any[]).map(r => {
            const fechaStr = r.Fecha instanceof Date
                ? r.Fecha.toISOString().slice(0, 10)
                : String(r.Fecha).slice(0, 10);
            return {
                fecha: fechaStr,
                venta: Number(r.Venta) || 0,
                cantidad: Number(r.Cantidad) || 0,
                tickets: Number(r.Tickets) || 0
            };
        });

        const t = (totalsRows as any[])[0] || {};
        return NextResponse.json({
            success: true,
            groupBy,
            totals: {
                venta: Number(t.Venta) || 0,
                cantidad: Number(t.Cantidad) || 0,
                tickets: Number(t.Tickets) || 0,
                precioPromedio: Number(t.PrecioPromedio) || 0
            },
            series
        });
    } catch (error: any) {
        console.error('[Product-Trend API] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
