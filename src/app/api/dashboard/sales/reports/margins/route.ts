import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

const GROUP_MAP: Record<string, { selectExpr: string; joinExtra: string; alias: string }> = {
    sucursal: {
        selectExpr: 'T.Tienda',
        joinExtra: 'INNER JOIN tblTiendas T ON V.IdTienda = T.IdTienda',
        alias: 'Tienda'
    },
    depto: {
        selectExpr: 'D.Depto',
        joinExtra: 'INNER JOIN tblDeptos D ON A.IdDepto = D.IdDepto',
        alias: 'Depto'
    },
    articulo: {
        selectExpr: 'A.Descripcion',
        joinExtra: '',
        alias: 'Producto'
    },
    categoria: {
        selectExpr: "ISNULL(NULLIF(A.Categoria, ''), '(Sin categoría)')",
        joinExtra: '',
        alias: 'Categoria'
    },
    marca: {
        selectExpr: "ISNULL(NULLIF(A.Familia, ''), '(Sin familia)')",
        joinExtra: '',
        alias: 'Familia'
    },
    proveedor: {
        selectExpr: "ISNULL(NULLIF(P.Proveedor, ''), '(Sin proveedor)')",
        joinExtra: 'LEFT JOIN tblProveedores P ON A.IdProveedorDefault = P.IdProveedor',
        alias: 'Proveedor'
    }
};

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const today = new Date();
        const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const fmt = (d: Date) => d.toISOString().slice(0, 10);

        const startDate = url.searchParams.get('startDate') || fmt(firstOfMonth);
        const endDate = url.searchParams.get('endDate') || fmt(today);
        const groupByKey = (url.searchParams.get('groupBy') || 'sucursal').toLowerCase();
        const storeId = url.searchParams.get('storeId');
        const limitParam = parseInt(url.searchParams.get('limit') || '0', 10);
        const onlyStores = url.searchParams.get('onlyStores') === 'true';

        // Direct exit to fetch active stores for date range
        if (onlyStores) {
            const storeList = await query(`
                SELECT DISTINCT t.IdTienda, t.Tienda 
                FROM tblVentas v
                JOIN tblTiendas t ON v.IdTienda = t.IdTienda
                WHERE v.FechaVenta >= '${startDate} 00:00:00' AND v.FechaVenta <= '${endDate} 23:59:59'
                ORDER BY t.Tienda
            `);
            return NextResponse.json({ success: true, stores: storeList });
        }

        const gb = GROUP_MAP[groupByKey] || GROUP_MAP.sucursal;

        const whereClauses: string[] = [
            `V.FechaVenta >= '${startDate} 00:00:00'`,
            `V.FechaVenta <= '${endDate} 23:59:59'`
        ];

        if (storeId && storeId !== 'undefined' && storeId !== 'null' && storeId !== 'all') {
            if (storeId.includes(',')) {
                const ids = storeId.split(',').map(id => `'${id.trim()}'`).join(',');
                whereClauses.push(`V.IdTienda IN (${ids})`);
            } else {
                whereClauses.push(`V.IdTienda = '${storeId}'`);
            }
        }

        const limit = limitParam > 0 ? Math.min(limitParam, 1000) : (groupByKey === 'articulo' ? 100 : 200);

        const sql = `
            WITH RawSales AS (
                SELECT
                    ${gb.selectExpr} AS Grupo,
                    DV.Cantidad AS Cantidad,
                    (DV.PrecioVenta * DV.Cantidad) AS FilaIngreso,
                    (DV.Cantidad * A.UltimoCosto) AS FilaCosto,
                    V.IdVenta AS IdVenta
                FROM tblDetalleVentas DV
                INNER JOIN tblVentas V ON DV.IdVenta = V.IdVenta AND DV.IdTienda = V.IdTienda AND DV.IdComputadora = V.IdComputadora
                INNER JOIN tblArticulos A ON DV.CodigoInterno = A.CodigoInterno
                ${gb.joinExtra}
                WHERE ${whereClauses.join(' AND ')}
            )
            SELECT TOP ${limit}
                Grupo,
                SUM(Cantidad) AS Unidades,
                SUM(FilaIngreso) AS Ingreso,
                SUM(FilaCosto) AS Costo,
                SUM(FilaIngreso) - SUM(FilaCosto) AS Utilidad,
                CASE
                    WHEN SUM(FilaIngreso) = 0 THEN 0
                    ELSE ((SUM(FilaIngreso) - SUM(FilaCosto)) / SUM(FilaIngreso)) * 100
                END AS MargenPct,
                COUNT(DISTINCT IdVenta) AS Tickets
            FROM RawSales
            GROUP BY Grupo
            ORDER BY Utilidad DESC
        `;

        const rows = await query(sql);

        // Global KPIs
        const totalsSql = `
            SELECT
                SUM(DV.PrecioVenta * DV.Cantidad) AS Ingreso,
                SUM(DV.Cantidad * A.UltimoCosto) AS Costo,
                SUM(DV.Cantidad) AS Unidades,
                COUNT(DISTINCT V.IdVenta) AS Tickets
            FROM tblDetalleVentas DV
            INNER JOIN tblVentas V ON DV.IdVenta = V.IdVenta AND DV.IdTienda = V.IdTienda AND DV.IdComputadora = V.IdComputadora
            INNER JOIN tblArticulos A ON DV.CodigoInterno = A.CodigoInterno
            WHERE ${whereClauses.join(' AND ')}
        `;

        const totalsRows = await query(totalsSql) as any[];
        const t = totalsRows[0] || {};
        const ingreso = Number(t.Ingreso) || 0;
        const costo = Number(t.Costo) || 0;
        const utilidad = ingreso - costo;
        const margenPct = ingreso > 0 ? (utilidad / ingreso) * 100 : 0;

        return NextResponse.json({
            success: true,
            filters: { startDate, endDate, groupBy: groupByKey, storeId },
            kpis: {
                ingreso,
                costo,
                utilidad,
                margenPct,
                unidades: Number(t.Unidades) || 0,
                tickets: Number(t.Tickets) || 0
            },
            groupAlias: gb.alias,
            data: rows
        });
    } catch (error: any) {
        console.error('Margins and profitability report error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
