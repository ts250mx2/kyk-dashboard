import { NextResponse } from 'next/server';
import { mysqlQuery } from '@/lib/mysql';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CEDIS_ID = 64;
const MAX_ROWS = 1000;

export interface CedisMovement {
    tipo: 'RECIBO' | 'SALIDA' | 'ENTRADA';
    id: number;
    folio: string;
    fecha: string;
    contraparte: string;
    usuario: string | null;
    renglones: number;
    total: number;
    estado: string;
    esFactura: boolean;
    idOrdenCompra: number | null;
}

/**
 * GET /api/inventory/cedis/movements?startDate&endDate&tipo=TODOS|RECIBO|SALIDA|ENTRADA
 * Bitácora unificada de movimientos del CEDIS:
 *  - RECIBO: mercancía de proveedores (órdenes de compra recibidas en el CEDIS).
 *  - SALIDA: transferencias hacia tiendas (distribuciones y por factura).
 *  - ENTRADA: transferencias recibidas (devoluciones de tiendas).
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get('startDate');
    const end = searchParams.get('endDate');
    const tipo = (searchParams.get('tipo') ?? 'TODOS').toUpperCase();
    if (!start || !end) {
        return NextResponse.json({ error: 'startDate y endDate son requeridos' }, { status: 400 });
    }

    try {
        const wants = (t: string) => tipo === 'TODOS' || tipo === t;
        const movements: CedisMovement[] = [];

        if (wants('RECIBO')) {
            const rows = (await mysqlQuery(
                `SELECT r.IdReciboMovil AS Id,
                        r.FolioReciboMovil AS Folio,
                        DATE_FORMAT(r.FechaRecibo, '%Y-%m-%d %H:%i') AS Fecha,
                        p.Proveedor AS Contraparte,
                        u.Usuario,
                        r.TotalPagar AS Total,
                        r.Status,
                        d.Renglones
                 FROM tblReciboMovil r
                 LEFT JOIN tblProveedores p ON p.IdProveedor = r.IdProveedor
                 LEFT JOIN tblUsuarios u ON u.IdUsuario = r.IdUsuarioRecibo
                 LEFT JOIN (
                     SELECT IdReciboMovil, IdTienda, COUNT(*) AS Renglones
                     FROM tblDetalleReciboMovil
                     WHERE IdTienda = ${CEDIS_ID}
                     GROUP BY IdReciboMovil, IdTienda
                 ) d ON d.IdReciboMovil = r.IdReciboMovil AND d.IdTienda = r.IdTienda
                 WHERE r.IdTienda = ${CEDIS_ID}
                   AND r.FechaRecibo >= ? AND r.FechaRecibo <= CONCAT(?, ' 23:59:59')`,
                [start, end]
            )) as any[];
            for (const r of rows ?? []) {
                movements.push({
                    tipo: 'RECIBO',
                    id: Number(r.Id),
                    folio: String(r.Folio ?? ''),
                    fecha: String(r.Fecha ?? ''),
                    contraparte: r.Contraparte || 'Proveedor desconocido',
                    usuario: r.Usuario || null,
                    renglones: Number(r.Renglones ?? 0),
                    total: Number(r.Total ?? 0),
                    estado: Number(r.Status) === 0 ? 'Recibido' : 'Cancelado',
                    esFactura: false,
                    idOrdenCompra: null,
                });
            }
        }

        if (wants('SALIDA')) {
            const selectFor = (table: string, esFactura: number) => `
                SELECT s.IdTransferenciaSalida AS Id,
                       s.FolioSalida AS Folio,
                       DATE_FORMAT(s.FechaSalida, '%Y-%m-%d %H:%i') AS Fecha,
                       t.Tienda AS Contraparte,
                       u.Usuario,
                       s.Status,
                       s.IdOrdenCompra,
                       CASE WHEN s.FechaEntrada > '2000-01-01' OR (s.FolioEntrada IS NOT NULL AND s.FolioEntrada <> '') THEN 1 ELSE 0 END AS Recibida,
                       d.Valor,
                       d.Renglones,
                       ${esFactura} AS EsFactura
                FROM ${table} s
                LEFT JOIN tblTiendas t ON t.IdTienda = s.IdTiendaDestino
                LEFT JOIN tblUsuarios u ON u.IdUsuario = s.IdUsuarioSalida
                LEFT JOIN (
                    SELECT IdTransferenciaSalida, IdTienda, SUM(Mov * Costo) AS Valor, COUNT(*) AS Renglones
                    FROM tblDetalleTransferenciasSalidas
                    WHERE IdTienda = ${CEDIS_ID}
                    GROUP BY IdTransferenciaSalida, IdTienda
                ) d ON d.IdTransferenciaSalida = s.IdTransferenciaSalida AND d.IdTienda = s.IdTienda
                WHERE s.IdTienda = ${CEDIS_ID}
                  AND s.FechaSalida >= ? AND s.FechaSalida <= CONCAT(?, ' 23:59:59')`;
            const [normales, facturas] = await Promise.all([
                mysqlQuery(selectFor('tblTransferenciasSalidas', 0), [start, end]) as Promise<any[]>,
                mysqlQuery(selectFor('tblTransferenciasSalidasFacturas', 1), [start, end]) as Promise<any[]>,
            ]);
            for (const r of [...(normales ?? []), ...(facturas ?? [])]) {
                const cancelada = Number(r.Status) !== 0;
                movements.push({
                    tipo: 'SALIDA',
                    id: Number(r.Id),
                    folio: String(r.Folio ?? ''),
                    fecha: String(r.Fecha ?? ''),
                    contraparte: r.Contraparte || 'Tienda desconocida',
                    usuario: r.Usuario || null,
                    renglones: Number(r.Renglones ?? 0),
                    total: Number(r.Valor ?? 0),
                    estado: cancelada ? 'Cancelada' : Number(r.Recibida) === 1 ? 'Recibida en tienda' : 'En tránsito',
                    esFactura: Number(r.EsFactura) === 1,
                    idOrdenCompra: r.IdOrdenCompra ? Number(r.IdOrdenCompra) : null,
                });
            }
        }

        if (wants('ENTRADA')) {
            const rows = (await mysqlQuery(
                `SELECT e.IdTransferenciaEntrada AS Id,
                        e.FolioEntrada AS Folio,
                        DATE_FORMAT(e.FechaEntrada, '%Y-%m-%d %H:%i') AS Fecha,
                        e.Status,
                        u.Usuario,
                        t.Tienda AS Contraparte,
                        d.Valor,
                        d.Renglones
                 FROM tblTransferenciasEntradas e
                 LEFT JOIN tblUsuarios u ON u.IdUsuario = e.IdUsuarioEntrada
                 LEFT JOIN tblTransferenciasSalidas s
                        ON s.IdTransferenciaEntrada = e.IdTransferenciaEntrada AND s.IdTiendaDestino = ${CEDIS_ID}
                 LEFT JOIN tblTiendas t ON t.IdTienda = s.IdTienda
                 LEFT JOIN (
                     SELECT IdTransferenciaSalida, IdTienda, SUM(Mov * Costo) AS Valor, COUNT(*) AS Renglones
                     FROM tblDetalleTransferenciasSalidas
                     GROUP BY IdTransferenciaSalida, IdTienda
                 ) d ON d.IdTransferenciaSalida = s.IdTransferenciaSalida AND d.IdTienda = s.IdTienda
                 WHERE e.IdTienda = ${CEDIS_ID}
                   AND e.FechaEntrada >= ? AND e.FechaEntrada <= CONCAT(?, ' 23:59:59')`,
                [start, end]
            )) as any[];
            for (const r of rows ?? []) {
                movements.push({
                    tipo: 'ENTRADA',
                    id: Number(r.Id),
                    folio: String(r.Folio ?? ''),
                    fecha: String(r.Fecha ?? ''),
                    contraparte: r.Contraparte || 'Tienda desconocida',
                    usuario: r.Usuario || null,
                    renglones: Number(r.Renglones ?? 0),
                    total: Number(r.Valor ?? 0),
                    estado: Number(r.Status) === 0 ? 'Recibida en CEDIS' : 'Cancelada',
                    esFactura: false,
                    idOrdenCompra: null,
                });
            }
        }

        movements.sort((a, b) => b.fecha.localeCompare(a.fecha));
        return NextResponse.json({ count: movements.length, movements: movements.slice(0, MAX_ROWS) });
    } catch (error) {
        console.error('Error fetching CEDIS movements:', error);
        return NextResponse.json({ error: 'Error al consultar los movimientos del CEDIS' }, { status: 500 });
    }
}
