import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CEDIS_ID = 64;
/** Días de venta usados para calcular la demanda diaria por tienda. */
const LOOKBACK_DAYS = 30;
const MAX_ROWS = 200;

interface RawRow {
    CodigoInterno: string;
    Descripcion: string;
    IdTienda: number;
    Tienda: string;
    Unidades30: number;
    Venta30: number;
    ExiTienda: number;
    ExiCedis: number;
    Costo: number;
}

/**
 * GET /api/inventory/cedis/replenishment?coverageThreshold=7&coverageTarget=14
 * Sugerencia de reparto: productos CON existencia en el CEDIS cuyas tiendas
 * traen cobertura baja (días de inventario vs su propia venta de 30 días).
 * Sugiere enviar lo necesario para llegar a la cobertura objetivo, repartiendo
 * el stock del CEDIS por prioridad de venta (mayor venta primero).
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const coverageThreshold = Math.max(1, Math.min(30, Number(searchParams.get('coverageThreshold') ?? 7)));
    const coverageTarget = Math.max(coverageThreshold, Math.min(60, Number(searchParams.get('coverageTarget') ?? 14)));

    try {
        const rows = (await query(`
            WITH CedisStock AS (
                SELECT CodigoInterno, Exi AS ExiCedis, ISNULL(Costo, 0) AS Costo
                FROM tblExistencias
                WHERE IdTienda = ${CEDIS_ID} AND Exi > 0
            ),
            Ventas AS (
                SELECT dv.CodigoInterno, v.IdTienda,
                       SUM(dv.Cantidad) AS Unidades30,
                       SUM(dv.PrecioVenta * dv.Cantidad) AS Venta30
                FROM tblVentas v
                JOIN tblDetalleVentas dv
                  ON v.IdVenta = dv.IdVenta AND v.IdTienda = dv.IdTienda AND v.IdComputadora = dv.IdComputadora
                WHERE v.FechaVenta >= DATEADD(day, -${LOOKBACK_DAYS}, GETDATE())
                  AND v.IdTienda <> ${CEDIS_ID}
                  AND dv.CodigoInterno IN (SELECT CodigoInterno FROM CedisStock)
                GROUP BY dv.CodigoInterno, v.IdTienda
            )
            SELECT va.CodigoInterno,
                   ISNULL(a.Descripcion, 'S/N') AS Descripcion,
                   va.IdTienda,
                   ISNULL(t.Tienda, CONCAT('Tienda ', va.IdTienda)) AS Tienda,
                   va.Unidades30,
                   va.Venta30,
                   ISNULL(e.Exi, 0) AS ExiTienda,
                   cs.ExiCedis,
                   cs.Costo
            FROM Ventas va
            JOIN CedisStock cs ON cs.CodigoInterno = va.CodigoInterno
            LEFT JOIN tblExistencias e ON e.CodigoInterno = va.CodigoInterno AND e.IdTienda = va.IdTienda
            LEFT JOIN tblArticulos a ON a.CodigoInterno = va.CodigoInterno
            LEFT JOIN tblTiendas t ON t.IdTienda = va.IdTienda
            WHERE va.Unidades30 > 0
        `)) as RawRow[];

        // Ordenar por venta (prioridad) y repartir el stock del CEDIS de forma greedy.
        const sorted = [...rows].sort((a, b) => Number(b.Venta30) - Number(a.Venta30));
        const cedisRemaining = new Map<string, number>();
        for (const r of sorted) {
            const key = String(r.CodigoInterno).trim();
            if (!cedisRemaining.has(key)) cedisRemaining.set(key, Number(r.ExiCedis) || 0);
        }

        const suggestions = [];
        for (const r of sorted) {
            const ventaDiaria = Number(r.Unidades30) / LOOKBACK_DAYS;
            if (ventaDiaria <= 0) continue;
            const exiTienda = Math.max(0, Number(r.ExiTienda) || 0);
            const cobertura = exiTienda / ventaDiaria;
            if (cobertura >= coverageThreshold) continue;

            const key = String(r.CodigoInterno).trim();
            const disponible = cedisRemaining.get(key) ?? 0;
            if (disponible <= 0) continue;

            const necesario = Math.ceil(ventaDiaria * coverageTarget - exiTienda);
            const sugerido = Math.min(necesario, Math.floor(disponible));
            if (sugerido <= 0) continue;
            cedisRemaining.set(key, disponible - sugerido);

            suggestions.push({
                codigoInterno: key,
                descripcion: r.Descripcion,
                idTienda: Number(r.IdTienda),
                tienda: r.Tienda,
                ventaDiaria: Math.round(ventaDiaria * 10) / 10,
                venta30: Number(r.Venta30) || 0,
                exiTienda,
                coberturaDias: Math.round(cobertura * 10) / 10,
                exiCedis: Number(r.ExiCedis) || 0,
                sugerido,
                valorSugerido: sugerido * (Number(r.Costo) || 0),
            });
        }

        suggestions.sort((a, b) => b.venta30 - a.venta30);
        return NextResponse.json({
            coverageThreshold,
            coverageTarget,
            lookbackDays: LOOKBACK_DAYS,
            count: suggestions.length,
            suggestions: suggestions.slice(0, MAX_ROWS),
        });
    } catch (error) {
        console.error('Error building CEDIS replenishment:', error);
        return NextResponse.json({ error: 'Error al calcular la sugerencia de reparto' }, { status: 500 });
    }
}
