import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

/**
 * Ventas por Proveedor — drill-down de 2 niveles
 *   1. suppliers → cards por proveedor (monto, unidades, # artículos distintos)
 *   2. products  → cards por producto del proveedor (monto, cantidad)
 *
 * Filtros: rango de fechas + sucursal (single, opcional)
 *
 * Match proveedor → artículo: A.IdProveedorDefault. (No usamos
 * tblArticulosProveedor para mantener el match simple y consistente.)
 */

type Level = 'suppliers' | 'products' | 'stores';

function dateRange(searchParams: URLSearchParams): { startStr: string; endStr: string } | null {
    const fechaInicio = searchParams.get('fechaInicio');
    const fechaFin = searchParams.get('fechaFin');
    if (!fechaInicio || !fechaFin) return null;
    return {
        startStr: `'${fechaInicio} 00:00:00'`,
        endStr: `'${fechaFin} 23:59:59'`
    };
}

function tiendaFilter(idTienda: string | null): string {
    if (!idTienda || idTienda === 'all') return '';
    const ids = idTienda.split(',').map(Number).filter(n => !isNaN(n));
    if (ids.length === 0) return '';
    return `AND V.IdTienda IN (${ids.join(',')})`;
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const level = (searchParams.get('level') as Level) || 'suppliers';

        // Sub-endpoint: catálogo de sucursales activas en el periodo
        if (level === 'stores') {
            const range = dateRange(searchParams);
            if (!range) return NextResponse.json({ error: 'Faltan fechas' }, { status: 400 });
            const rows = await query(`
                SELECT DISTINCT t.IdTienda, t.Tienda
                FROM tblVentas v
                INNER JOIN tblTiendas t ON v.IdTienda = t.IdTienda
                WHERE v.FechaVenta >= ${range.startStr} AND v.FechaVenta <= ${range.endStr}
                ORDER BY t.Tienda
            `);
            return NextResponse.json({ stores: rows });
        }

        const range = dateRange(searchParams);
        if (!range) return NextResponse.json({ error: 'Faltan fechas' }, { status: 400 });
        const { startStr, endStr } = range;
        const storeF = tiendaFilter(searchParams.get('idTienda'));

        // ---------------------------------------------------------------
        // NIVEL 1: SUPPLIERS — cards por proveedor con totales
        // ---------------------------------------------------------------
        if (level === 'suppliers') {
            const sql = `
                SELECT
                    ISNULL(A.IdProveedorDefault, 0) AS IdProveedor,
                    ISNULL(NULLIF(P.Proveedor, ''), '(Sin proveedor)') AS Proveedor,
                    SUM(DV.PrecioVenta * DV.Cantidad) AS Venta,
                    SUM(DV.Cantidad) AS Unidades,
                    COUNT(DISTINCT DV.CodigoInterno) AS Articulos,
                    COUNT(DISTINCT V.IdVenta) AS Tickets
                FROM tblDetalleVentas DV
                INNER JOIN tblVentas V
                    ON DV.IdVenta = V.IdVenta
                    AND DV.IdTienda = V.IdTienda
                    AND DV.IdComputadora = V.IdComputadora
                INNER JOIN tblArticulos A ON DV.CodigoInterno = A.CodigoInterno
                LEFT JOIN tblProveedores P ON A.IdProveedorDefault = P.IdProveedor
                WHERE V.FechaVenta >= ${startStr} AND V.FechaVenta <= ${endStr} ${storeF}
                GROUP BY A.IdProveedorDefault, P.Proveedor
                HAVING SUM(DV.PrecioVenta * DV.Cantidad) > 0
                ORDER BY Venta DESC
            `;
            const rows = await query(sql) as any[];

            const totals = rows.reduce((acc, r) => ({
                Venta: acc.Venta + Number(r.Venta || 0),
                Unidades: acc.Unidades + Number(r.Unidades || 0),
                Articulos: acc.Articulos + Number(r.Articulos || 0)
            }), { Venta: 0, Unidades: 0, Articulos: 0 });

            return NextResponse.json({
                level,
                totals,
                suppliers: rows.map(r => ({
                    IdProveedor: Number(r.IdProveedor) || 0,
                    Proveedor: r.Proveedor,
                    Venta: Number(r.Venta) || 0,
                    Unidades: Number(r.Unidades) || 0,
                    Articulos: Number(r.Articulos) || 0,
                    Tickets: Number(r.Tickets) || 0
                }))
            });
        }

        // ---------------------------------------------------------------
        // NIVEL 2: PRODUCTS — cards por producto del proveedor
        // ---------------------------------------------------------------
        if (level === 'products') {
            const idProveedor = searchParams.get('idProveedor');
            if (!idProveedor) {
                return NextResponse.json({ error: 'Falta idProveedor' }, { status: 400 });
            }
            const idProvNum = Number(idProveedor);
            const provFilter = idProvNum === 0
                ? '(A.IdProveedorDefault IS NULL OR A.IdProveedorDefault = 0)'
                : `A.IdProveedorDefault = ${idProvNum}`;

            const sql = `
                SELECT TOP 500
                    DV.CodigoInterno,
                    A.Descripcion,
                    A.CodigoBarras,
                    SUM(DV.PrecioVenta * DV.Cantidad) AS Venta,
                    SUM(DV.Cantidad) AS Cantidad,
                    COUNT(DISTINCT V.IdVenta) AS Tickets,
                    AVG(DV.PrecioVenta) AS PrecioPromedio
                FROM tblDetalleVentas DV
                INNER JOIN tblVentas V
                    ON DV.IdVenta = V.IdVenta
                    AND DV.IdTienda = V.IdTienda
                    AND DV.IdComputadora = V.IdComputadora
                INNER JOIN tblArticulos A ON DV.CodigoInterno = A.CodigoInterno
                WHERE V.FechaVenta >= ${startStr} AND V.FechaVenta <= ${endStr}
                AND ${provFilter}
                ${storeF}
                GROUP BY DV.CodigoInterno, A.Descripcion, A.CodigoBarras
                HAVING SUM(DV.PrecioVenta * DV.Cantidad) > 0
                ORDER BY Venta DESC
            `;
            const rows = await query(sql) as any[];

            const totals = rows.reduce((acc, r) => ({
                Venta: acc.Venta + Number(r.Venta || 0),
                Cantidad: acc.Cantidad + Number(r.Cantidad || 0)
            }), { Venta: 0, Cantidad: 0 });

            return NextResponse.json({
                level,
                totals,
                products: rows.map(r => ({
                    CodigoInterno: r.CodigoInterno,
                    Descripcion: r.Descripcion || '(Sin descripción)',
                    CodigoBarras: r.CodigoBarras,
                    Venta: Number(r.Venta) || 0,
                    Cantidad: Number(r.Cantidad) || 0,
                    Tickets: Number(r.Tickets) || 0,
                    PrecioPromedio: Number(r.PrecioPromedio) || 0
                }))
            });
        }

        return NextResponse.json({ error: 'Nivel inválido' }, { status: 400 });
    } catch (error: any) {
        console.error('[By-Supplier API] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
