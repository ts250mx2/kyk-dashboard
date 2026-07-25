import { NextResponse } from 'next/server';
import { mysqlQuery } from '@/lib/mysql';
import { query as sqlQuery } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** IdTienda del CEDIS (sucursal-almacén). */
const CEDIS_ID = 64;
/** Salidas sin recibir con más de estos días se consideran "en tránsito antiguo". */
const TRANSIT_ALERT_DAYS = 3;
const TOP_PRODUCTS = 15;
const TOP_STALE_STOCK = 15;
/** Universo de existencias (por valor) contra el que se detecta stock sin movimiento. */
const STALE_STOCK_UNIVERSE = 400;

const cache = new Map<string, { data: unknown; expiresAt: number }>();
const CACHE_TTL_MS = 60_000;

interface SalidaRow {
    Id: number;
    Folio: string;
    IdTiendaDestino: number;
    TiendaDestino: string | null;
    Fecha: string;
    FechaDia: string;
    Recibida: number;
    DiasRecepcion: number | null;
    Valor: number | null;
    Unidades: number | null;
    EsFactura: number;
    IdOrdenCompra: number | null;
}

/** Salidas del período (normales + por factura) con su valor de detalle. */
async function fetchSalidas(start: string, end: string): Promise<SalidaRow[]> {
    const selectFor = (table: string, esFactura: number) => `
        SELECT
            s.IdTransferenciaSalida AS Id,
            s.FolioSalida AS Folio,
            s.IdTiendaDestino,
            t.Tienda AS TiendaDestino,
            DATE_FORMAT(s.FechaSalida, '%Y-%m-%d %H:%i') AS Fecha,
            DATE_FORMAT(s.FechaSalida, '%Y-%m-%d') AS FechaDia,
            CASE WHEN s.FechaEntrada > '2000-01-01' OR (s.FolioEntrada IS NOT NULL AND s.FolioEntrada <> '') THEN 1 ELSE 0 END AS Recibida,
            CASE WHEN s.FechaEntrada > '2000-01-01' THEN TIMESTAMPDIFF(HOUR, s.FechaSalida, s.FechaEntrada) / 24 ELSE NULL END AS DiasRecepcion,
            d.Valor,
            d.Unidades,
            ${esFactura} AS EsFactura,
            s.IdOrdenCompra
        FROM ${table} s
        LEFT JOIN (
            SELECT dd.IdTransferenciaSalida, dd.IdTienda, SUM(dd.Mov * dd.Costo) AS Valor, SUM(dd.Mov) AS Unidades
            FROM tblDetalleTransferenciasSalidas dd
            WHERE dd.IdTienda = ${CEDIS_ID}
            GROUP BY dd.IdTransferenciaSalida, dd.IdTienda
        ) d ON d.IdTransferenciaSalida = s.IdTransferenciaSalida AND d.IdTienda = s.IdTienda
        LEFT JOIN tblTiendas t ON t.IdTienda = s.IdTiendaDestino
        WHERE s.IdTienda = ${CEDIS_ID} AND s.Status = 0
          AND s.FechaSalida >= ? AND s.FechaSalida <= CONCAT(?, ' 23:59:59')
    `;
    const [normales, facturas] = await Promise.all([
        mysqlQuery(selectFor('tblTransferenciasSalidas', 0), [start, end]) as Promise<SalidaRow[]>,
        mysqlQuery(selectFor('tblTransferenciasSalidasFacturas', 1), [start, end]) as Promise<SalidaRow[]>,
    ]);
    return [...(normales ?? []), ...(facturas ?? [])];
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get('startDate');
    const end = searchParams.get('endDate');
    if (!start || !end) {
        return NextResponse.json({ error: 'startDate y endDate son requeridos' }, { status: 400 });
    }

    const cacheKey = `${start}|${end}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return NextResponse.json(cached.data);

    try {
        const [salidas, recibosAgg, recibosPorDia, entradas, topProductos, existencias] = await Promise.all([
            fetchSalidas(start, end),
            mysqlQuery(
                `SELECT COUNT(*) AS n, COALESCE(SUM(TotalPagar), 0) AS total
                 FROM tblReciboMovil
                 WHERE IdTienda = ${CEDIS_ID} AND Status = 0
                   AND FechaRecibo >= ? AND FechaRecibo <= CONCAT(?, ' 23:59:59')`,
                [start, end]
            ) as Promise<{ n: number; total: number }[]>,
            mysqlQuery(
                `SELECT DATE_FORMAT(FechaRecibo, '%Y-%m-%d') AS FechaDia, SUM(TotalPagar) AS total
                 FROM tblReciboMovil
                 WHERE IdTienda = ${CEDIS_ID} AND Status = 0
                   AND FechaRecibo >= ? AND FechaRecibo <= CONCAT(?, ' 23:59:59')
                 GROUP BY DATE_FORMAT(FechaRecibo, '%Y-%m-%d')`,
                [start, end]
            ) as Promise<{ FechaDia: string; total: number }[]>,
            mysqlQuery(
                `SELECT e.IdTransferenciaEntrada AS Id,
                        e.FolioEntrada AS Folio,
                        DATE_FORMAT(e.FechaEntrada, '%Y-%m-%d %H:%i') AS Fecha,
                        s.IdTienda AS IdTiendaOrigen,
                        t.Tienda AS TiendaOrigen,
                        d.Valor
                 FROM tblTransferenciasEntradas e
                 LEFT JOIN tblTransferenciasSalidas s
                        ON s.IdTransferenciaEntrada = e.IdTransferenciaEntrada AND s.IdTiendaDestino = ${CEDIS_ID}
                 LEFT JOIN tblTiendas t ON t.IdTienda = s.IdTienda
                 LEFT JOIN (
                     SELECT dd.IdTransferenciaSalida, dd.IdTienda, SUM(dd.Mov * dd.Costo) AS Valor
                     FROM tblDetalleTransferenciasSalidas dd
                     GROUP BY dd.IdTransferenciaSalida, dd.IdTienda
                 ) d ON d.IdTransferenciaSalida = s.IdTransferenciaSalida AND d.IdTienda = s.IdTienda
                 WHERE e.IdTienda = ${CEDIS_ID} AND e.Status = 0
                   AND e.FechaEntrada >= ? AND e.FechaEntrada <= CONCAT(?, ' 23:59:59')`,
                [start, end]
            ) as Promise<{ Id: number; Folio: string; Fecha: string; IdTiendaOrigen: number | null; TiendaOrigen: string | null; Valor: number | null }[]>,
            mysqlQuery(
                `SELECT d.CodigoInterno, a.Descripcion, a.CodigoBarras,
                        SUM(d.Mov) AS Unidades, SUM(d.Mov * d.Costo) AS Valor
                 FROM tblDetalleTransferenciasSalidas d
                 INNER JOIN tblTransferenciasSalidas s
                        ON s.IdTransferenciaSalida = d.IdTransferenciaSalida AND s.IdTienda = d.IdTienda
                 LEFT JOIN tblArticulosSAP a ON a.CodigoInterno = d.CodigoInterno
                 WHERE d.IdTienda = ${CEDIS_ID} AND s.Status = 0
                   AND s.FechaSalida >= ? AND s.FechaSalida <= CONCAT(?, ' 23:59:59')
                 GROUP BY d.CodigoInterno, a.Descripcion, a.CodigoBarras
                 ORDER BY Valor DESC
                 LIMIT ${TOP_PRODUCTS}`,
                [start, end]
            ) as Promise<{ CodigoInterno: string; Descripcion: string | null; CodigoBarras: string | null; Unidades: number; Valor: number }[]>,
            sqlQuery(
                `SELECT TOP ${STALE_STOCK_UNIVERSE}
                        e.CodigoInterno, ISNULL(a.Descripcion, 'S/N') AS Descripcion,
                        e.Exi, ISNULL(e.Costo, 0) AS Costo, e.Exi * ISNULL(e.Costo, 0) AS Valor
                 FROM tblExistencias e
                 LEFT JOIN tblArticulos a ON a.CodigoInterno = e.CodigoInterno
                 WHERE e.IdTienda = ${CEDIS_ID} AND e.Exi > 0
                 ORDER BY e.Exi * ISNULL(e.Costo, 0) DESC`
            ) as Promise<{ CodigoInterno: string; Descripcion: string; Exi: number; Costo: number; Valor: number }[]>,
        ]);

        // Inventario total del CEDIS (aparte del top usado para stock sin movimiento).
        const invTotals = (await sqlQuery(
            `SELECT COUNT(*) AS skus, SUM(e.Exi) AS unidades, SUM(e.Exi * ISNULL(e.Costo, 0)) AS valor
             FROM tblExistencias e WHERE e.IdTienda = ${CEDIS_ID} AND e.Exi > 0`
        )) as { skus: number; unidades: number; valor: number }[];

        // Fill rate por proveedor: qué tanto de lo ordenado por el CEDIS llegó.
        const fillRateRows = (await mysqlQuery(
            `SELECT p.Proveedor,
                    COUNT(*) AS Ordenes,
                    SUM(oc.TotalPedido) AS Pedido,
                    SUM(CASE WHEN oc.IdReciboMovil > 0 THEN 1 ELSE 0 END) AS OrdenesRecibidas,
                    SUM(CASE WHEN oc.IdReciboMovil > 0 THEN COALESCE(r.TotalPagar, 0) ELSE 0 END) AS Recibido
             FROM tblOrdenesCompra oc
             LEFT JOIN tblReciboMovil r ON r.IdReciboMovil = oc.IdReciboMovil AND r.IdTienda = oc.IdTienda
             LEFT JOIN tblProveedores p ON p.IdProveedor = oc.IdProveedor
             WHERE oc.IdTienda = ${CEDIS_ID}
               AND oc.FechaOrdenCompra >= ? AND oc.FechaOrdenCompra <= CONCAT(?, ' 23:59:59')
             GROUP BY p.Proveedor
             HAVING SUM(oc.TotalPedido) > 0
             ORDER BY Pedido DESC
             LIMIT 15`,
            [start, end]
        )) as { Proveedor: string | null; Ordenes: number; Pedido: number; OrdenesRecibidas: number; Recibido: number }[];

        // ---- Agregados en memoria ----
        const num = (v: unknown) => Number(v ?? 0) || 0;

        const totalEnviado = salidas.reduce((acc, s) => acc + num(s.Valor), 0);
        const enTransito = salidas.filter((s) => !s.Recibida);
        const conRecepcion = salidas.filter((s) => s.DiasRecepcion != null);
        const diasPromedioRecepcion = conRecepcion.length
            ? conRecepcion.reduce((acc, s) => acc + num(s.DiasRecepcion), 0) / conRecepcion.length
            : null;

        // Por tienda destino.
        const porTiendaMap = new Map<number, { idTienda: number; tienda: string; envios: number; valor: number; enTransito: number; valorTransito: number }>();
        for (const s of salidas) {
            const entry = porTiendaMap.get(s.IdTiendaDestino) ?? {
                idTienda: s.IdTiendaDestino,
                tienda: s.TiendaDestino || `Tienda ${s.IdTiendaDestino}`,
                envios: 0, valor: 0, enTransito: 0, valorTransito: 0,
            };
            entry.envios++;
            entry.valor += num(s.Valor);
            if (!s.Recibida) { entry.enTransito++; entry.valorTransito += num(s.Valor); }
            porTiendaMap.set(s.IdTiendaDestino, entry);
        }
        const porTienda = [...porTiendaMap.values()].sort((a, b) => b.valor - a.valor);

        // Serie diaria: recibido de proveedores vs enviado a tiendas.
        const serieMap = new Map<string, { fecha: string; recibido: number; enviado: number }>();
        for (const r of recibosPorDia ?? []) {
            const e = serieMap.get(r.FechaDia) ?? { fecha: r.FechaDia, recibido: 0, enviado: 0 };
            e.recibido += num(r.total);
            serieMap.set(r.FechaDia, e);
        }
        for (const s of salidas) {
            const e = serieMap.get(s.FechaDia) ?? { fecha: s.FechaDia, recibido: 0, enviado: 0 };
            e.enviado += num(s.Valor);
            serieMap.set(s.FechaDia, e);
        }
        const serie = [...serieMap.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));

        // Salidas en tránsito con antigüedad mayor al umbral.
        const now = Date.now();
        const transitoAntiguo = enTransito
            .map((s) => ({
                folio: s.Folio,
                tienda: s.TiendaDestino || `Tienda ${s.IdTiendaDestino}`,
                fechaSalida: s.Fecha,
                dias: Math.floor((now - new Date(s.Fecha.replace(' ', 'T')).getTime()) / 86_400_000),
                valor: num(s.Valor),
                esFactura: !!s.EsFactura,
            }))
            .filter((s) => s.dias >= TRANSIT_ALERT_DAYS)
            .sort((a, b) => b.dias - a.dias)
            .slice(0, 20);

        // Stock sin movimiento: existencias valiosas del CEDIS sin salidas en el período.
        const movidos = new Set(
            ((await mysqlQuery(
                `SELECT DISTINCT d.CodigoInterno
                 FROM tblDetalleTransferenciasSalidas d
                 INNER JOIN tblTransferenciasSalidas s
                        ON s.IdTransferenciaSalida = d.IdTransferenciaSalida AND s.IdTienda = d.IdTienda
                 WHERE d.IdTienda = ${CEDIS_ID} AND s.Status = 0
                   AND s.FechaSalida >= ? AND s.FechaSalida <= CONCAT(?, ' 23:59:59')`,
                [start, end]
            )) as { CodigoInterno: string }[]).map((r) => String(r.CodigoInterno).trim())
        );
        const stockSinMovimiento = (existencias ?? [])
            .filter((e) => !movidos.has(String(e.CodigoInterno).trim()))
            .slice(0, TOP_STALE_STOCK)
            .map((e) => ({
                codigoInterno: String(e.CodigoInterno).trim(),
                descripcion: e.Descripcion,
                existencia: num(e.Exi),
                costo: num(e.Costo),
                valor: num(e.Valor),
            }));

        const data = {
            kpis: {
                recibos: { count: num(recibosAgg?.[0]?.n), total: num(recibosAgg?.[0]?.total) },
                salidas: { count: salidas.length, total: totalEnviado, tiendas: porTienda.length },
                entradas: {
                    count: (entradas ?? []).length,
                    total: (entradas ?? []).reduce((acc, e) => acc + num(e.Valor), 0),
                },
                enTransito: { count: enTransito.length, total: enTransito.reduce((a, s) => a + num(s.Valor), 0) },
                diasPromedioRecepcion,
                inventario: {
                    skus: num(invTotals?.[0]?.skus),
                    unidades: num(invTotals?.[0]?.unidades),
                    valor: num(invTotals?.[0]?.valor),
                },
            },
            serie,
            porTienda,
            topProductos: (topProductos ?? []).map((p) => ({
                codigoInterno: String(p.CodigoInterno).trim(),
                codigoBarras: p.CodigoBarras ? String(p.CodigoBarras).trim() : null,
                descripcion: p.Descripcion || 'S/N',
                unidades: num(p.Unidades),
                valor: num(p.Valor),
            })),
            transitoAntiguo,
            stockSinMovimiento,
            fillRateProveedores: (fillRateRows ?? []).map((f) => ({
                proveedor: f.Proveedor || 'Proveedor desconocido',
                ordenes: num(f.Ordenes),
                ordenesRecibidas: num(f.OrdenesRecibidas),
                pedido: num(f.Pedido),
                recibido: num(f.Recibido),
                fillRate: num(f.Pedido) > 0 ? Math.min(150, (num(f.Recibido) / num(f.Pedido)) * 100) : null,
            })),
        };

        cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error building CEDIS summary:', error);
        return NextResponse.json({ error: 'Error al consultar los movimientos del CEDIS' }, { status: 500 });
    }
}
