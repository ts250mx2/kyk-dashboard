import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const runtime = 'nodejs';

let cache: { stores: Array<{ id: number; name: string }>; departments: string[] } | null = null;

/**
 * GET /api/agent/advanced/catalog
 * Valores reales para los filtros (sucursales y departamentos). Cacheado en memoria.
 * Producto/proveedor/cliente usan filtro de texto, no requieren catálogo.
 */
export async function GET() {
    if (cache) return NextResponse.json(cache);
    try {
        const [storeRows, deptRows] = await Promise.all([
            query(`SELECT IdTienda, Tienda FROM tblTiendas WHERE Status = 0 ORDER BY Tienda`) as Promise<Array<{ IdTienda: number; Tienda: string }>>,
            query(`SELECT DISTINCT Depto FROM tblDeptos WHERE Depto IS NOT NULL ORDER BY Depto`).catch(() => []) as Promise<Array<{ Depto: string }>>,
        ]);
        cache = {
            stores: storeRows.map((r) => ({ id: r.IdTienda, name: r.Tienda })),
            departments: (deptRows as Array<{ Depto: string }>).map((r) => r.Depto).filter(Boolean),
        };
        return NextResponse.json(cache);
    } catch (e: any) {
        return NextResponse.json({ stores: [], departments: [], error: e?.message || 'Error cargando catálogo' }, { status: 200 });
    }
}
