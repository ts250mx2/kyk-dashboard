import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

/**
 * Slot-Compare API
 * ----------------
 * Compara N "slots" independientes. Cada slot define:
 *   - dimension: sucursal | depto | categoria | marca | proveedor | articulo | todos
 *   - values: ids/strings que matchean la dimensión (vacío = todos los valores)
 *   - fechaInicio / fechaFin
 *   - groupBy: dia | semana | mes (granularidad de la serie temporal)
 *
 * Devuelve por cada slot:
 *   - KPIs: venta, tickets, ticketProm, utilidad, margenPct, unidades
 *   - series: array { fecha, venta, tickets, dayIndex } — dayIndex permite
 *     superponer slots de periodos distintos en un solo eje normalizado
 *
 * Diseñada para soportar comparativas cruzadas (sucursal vs producto, periodo A vs B).
 */

type Dimension = 'sucursal' | 'depto' | 'categoria' | 'marca' | 'proveedor' | 'articulo' | 'todos';
type GroupBy = 'dia' | 'semana' | 'mes';

interface SlotInput {
    id: string;
    label?: string;
    dimension: Dimension;
    values: (string | number)[];
    fechaInicio: string;
    fechaFin: string;
    groupBy?: GroupBy;
}

const DIM_CONFIG: Record<Exclude<Dimension, 'todos'>, {
    filterExpr: (values: string) => string;
    needsArticulos: boolean;
    needsProveedores: boolean;
}> = {
    sucursal: {
        filterExpr: (v) => `V.IdTienda IN (${v})`,
        needsArticulos: false,
        needsProveedores: false
    },
    depto: {
        filterExpr: (v) => `A.IdDepto IN (${v})`,
        needsArticulos: true,
        needsProveedores: false
    },
    categoria: {
        filterExpr: (v) => `A.Categoria IN (${v})`,
        needsArticulos: true,
        needsProveedores: false
    },
    marca: {
        filterExpr: (v) => `A.Familia IN (${v})`,
        needsArticulos: true,
        needsProveedores: false
    },
    proveedor: {
        filterExpr: (v) => `A.IdProveedorDefault IN (${v})`,
        needsArticulos: true,
        needsProveedores: false
    },
    articulo: {
        filterExpr: (v) => `DV.CodigoInterno IN (${v})`,
        needsArticulos: false,
        needsProveedores: false
    }
};

function quoteValue(v: string | number, isNumeric: boolean): string {
    if (isNumeric) {
        const n = Number(v);
        return isNaN(n) ? "''" : String(n);
    }
    return `'${String(v).replace(/'/g, "''").trim()}'`;
}

function isNumericDimension(d: Dimension): boolean {
    return d === 'sucursal' || d === 'depto' || d === 'proveedor' || d === 'articulo';
}

function buildSlotSql(slot: SlotInput, dateSelector: string): { kpisSql: string; seriesSql: string } {
    const startStr = `'${slot.fechaInicio} 00:00:00'`;
    const endStr = `'${slot.fechaFin} 23:59:59'`;

    const needsArticulos = slot.dimension !== 'sucursal' && slot.dimension !== 'todos';

    const joinArticulos = needsArticulos
        ? 'INNER JOIN tblArticulos A ON DV.CodigoInterno = A.CodigoInterno'
        : '';

    let dimFilter = '';
    if (slot.dimension !== 'todos' && slot.values.length > 0) {
        const cfg = DIM_CONFIG[slot.dimension];
        const isNum = isNumericDimension(slot.dimension);
        const valuesSql = slot.values.map(v => quoteValue(v, isNum)).join(',');
        dimFilter = cfg.filterExpr(valuesSql);
    }

    const whereClauses = [
        `V.FechaVenta >= ${startStr}`,
        `V.FechaVenta <= ${endStr}`,
        dimFilter
    ].filter(Boolean).join(' AND ');

    // KPIs: usamos costo desde A.UltimoCosto (mismo patrón que margins)
    const kpisSql = `
        SELECT
            ISNULL(SUM(DV.PrecioVenta * DV.Cantidad), 0) AS Venta,
            ISNULL(SUM(DV.Cantidad * A.UltimoCosto), 0) AS Costo,
            ISNULL(SUM(DV.Cantidad), 0) AS Unidades,
            COUNT(DISTINCT V.IdVenta) AS Tickets
        FROM tblDetalleVentas DV
        INNER JOIN tblVentas V ON DV.IdVenta = V.IdVenta AND DV.IdTienda = V.IdTienda AND DV.IdComputadora = V.IdComputadora
        INNER JOIN tblArticulos A ON DV.CodigoInterno = A.CodigoInterno
        WHERE ${whereClauses}
    `;

    // Serie temporal: misma base pero agrupada por fecha
    const seriesSql = `
        SELECT
            ${dateSelector} AS Fecha,
            ISNULL(SUM(DV.PrecioVenta * DV.Cantidad), 0) AS Venta,
            COUNT(DISTINCT V.IdVenta) AS Tickets
        FROM tblDetalleVentas DV
        INNER JOIN tblVentas V ON DV.IdVenta = V.IdVenta AND DV.IdTienda = V.IdTienda AND DV.IdComputadora = V.IdComputadora
        ${joinArticulos || 'INNER JOIN tblArticulos A ON DV.CodigoInterno = A.CodigoInterno'}
        WHERE ${whereClauses}
        GROUP BY ${dateSelector}
        ORDER BY ${dateSelector}
    `;

    return { kpisSql, seriesSql };
}

function dateSelectorFor(groupBy: GroupBy): string {
    if (groupBy === 'semana') return 'DATEADD(WEEK, DATEDIFF(WEEK, 0, V.FechaVenta), 0)';
    if (groupBy === 'mes') return 'DATEFROMPARTS(YEAR(V.FechaVenta), MONTH(V.FechaVenta), 1)';
    return 'CAST(V.FechaVenta AS DATE)';
}

function diffDays(a: string, b: string): number {
    const ms = new Date(a).getTime() - new Date(b).getTime();
    return Math.round(ms / 86400000);
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const slots: SlotInput[] = body.slots || [];

        if (!Array.isArray(slots) || slots.length === 0) {
            return NextResponse.json({ success: false, error: 'Debes enviar al menos un slot' }, { status: 400 });
        }
        if (slots.length > 4) {
            return NextResponse.json({ success: false, error: 'Máximo 4 slots por comparación' }, { status: 400 });
        }

        // Validación mínima
        for (const s of slots) {
            if (!s.id || !s.dimension || !s.fechaInicio || !s.fechaFin) {
                return NextResponse.json({ success: false, error: `Slot incompleto: ${JSON.stringify(s)}` }, { status: 400 });
            }
        }

        const results = await Promise.all(slots.map(async (slot) => {
            const groupBy: GroupBy = slot.groupBy || 'dia';
            const { kpisSql, seriesSql } = buildSlotSql(slot, dateSelectorFor(groupBy));

            console.log(`\n\x1b[36m[SLOT-COMPARE: ${slot.label || slot.id}]\x1b[0m\n${kpisSql}\n\n${seriesSql}\n`);

            const [kpisRows, seriesRows] = await Promise.all([
                query(kpisSql),
                query(seriesSql)
            ]);

            const k = (kpisRows as any[])[0] || {};
            const venta = Number(k.Venta) || 0;
            const costo = Number(k.Costo) || 0;
            const tickets = Number(k.Tickets) || 0;
            const utilidad = venta - costo;
            const ticketProm = tickets > 0 ? venta / tickets : 0;
            const margenPct = venta > 0 ? (utilidad / venta) * 100 : 0;

            const series = (seriesRows as any[]).map(r => {
                const fechaStr = r.Fecha instanceof Date
                    ? r.Fecha.toISOString().slice(0, 10)
                    : String(r.Fecha).slice(0, 10);
                return {
                    fecha: fechaStr,
                    venta: Number(r.Venta) || 0,
                    tickets: Number(r.Tickets) || 0,
                    // dayIndex = días desde fechaInicio del slot → permite superponer
                    // slots de periodos distintos en un eje normalizado.
                    dayIndex: diffDays(fechaStr, slot.fechaInicio)
                };
            });

            return {
                id: slot.id,
                label: slot.label || slot.id,
                dimension: slot.dimension,
                values: slot.values,
                fechaInicio: slot.fechaInicio,
                fechaFin: slot.fechaFin,
                kpis: {
                    venta,
                    costo,
                    utilidad,
                    margenPct,
                    tickets,
                    ticketProm,
                    unidades: Number(k.Unidades) || 0
                },
                series
            };
        }));

        return NextResponse.json({ success: true, slots: results });
    } catch (error: any) {
        console.error('Slot-compare API error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
