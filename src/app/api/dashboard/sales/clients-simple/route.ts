import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

/**
 * Clients-Simple API (drill-down por niveles)
 * --------------------------------------------
 * Cuatro niveles encadenados:
 *   1. stores         → cards por sucursal (+ "Todas las sucursales")
 *   2. payment-types  → cards por tipo de venta (filtra por idTienda, opcional)
 *   3. clients        → cards por cliente (filtra por tipo y opcionalmente sucursal)
 *   4. invoices       → detalle de facturas del cliente en el tipo+sucursal
 *
 * Reglas de tipo de venta (campo tblFacturas.Credito):
 *   - contado: Credito = 0 AND RFC != 'XAXX010101000'
 *   - credito: Credito = 1
 *   - publico: RFC  = 'XAXX010101000' AND Credito IN (0,1)
 *   - notas:   Credito = 2
 */

type Level = 'stores' | 'payment-types' | 'clients' | 'invoices';
type PaymentType = 'contado' | 'credito' | 'publico' | 'notas';

const PAYMENT_FILTERS: Record<PaymentType, string> = {
    contado: "Credito = 0 AND RFC != 'XAXX010101000'",
    credito: "Credito = 1",
    publico: "RFC = 'XAXX010101000' AND Credito IN (0, 1)",
    notas: "Credito = 2"
};

const PAYMENT_FILTERS_PREFIXED: Record<PaymentType, string> = {
    contado: "f.Credito = 0 AND f.RFC != 'XAXX010101000'",
    credito: "f.Credito = 1",
    publico: "f.RFC = 'XAXX010101000' AND f.Credito IN (0, 1)",
    notas: "f.Credito = 2"
};

function dateRange(searchParams: URLSearchParams): { startStr: string; endStr: string } | null {
    const fechaInicio = searchParams.get('fechaInicio');
    const fechaFin = searchParams.get('fechaFin');
    if (!fechaInicio || !fechaFin) return null;
    return {
        startStr: `'${fechaInicio} 00:00:00'`,
        endStr: `'${fechaFin} 23:59:59'`
    };
}

function tiendaFilter(idTienda: string | null, prefix = ''): string {
    if (!idTienda || idTienda === 'all') return '';
    const ids = idTienda.split(',').map(Number).filter(n => !isNaN(n));
    if (ids.length === 0) return '';
    return `AND ${prefix}IdTienda IN (${ids.join(',')})`;
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const level = (searchParams.get('level') as Level) || 'stores';

        const range = dateRange(searchParams);
        if (!range) {
            return NextResponse.json({ error: 'Faltan fechaInicio o fechaFin' }, { status: 400 });
        }
        const { startStr, endStr } = range;

        // ---------------------------------------------------------------
        // NIVEL 1: STORES — cards por sucursal con totales por tipo
        // ---------------------------------------------------------------
        if (level === 'stores') {
            const sql = `
                SELECT
                    f.IdTienda,
                    t.Tienda,
                    SUM(CASE WHEN f.Credito IN (0, 1) THEN f.Total ELSE 0 END) AS VentaTotal,
                    SUM(CASE WHEN f.Credito = 0 AND f.RFC != 'XAXX010101000' THEN f.Total ELSE 0 END) AS Contado,
                    SUM(CASE WHEN f.Credito = 1 THEN f.Total ELSE 0 END) AS Credito,
                    SUM(CASE WHEN f.RFC = 'XAXX010101000' AND f.Credito IN (0, 1) THEN f.Total ELSE 0 END) AS Publico,
                    SUM(CASE WHEN f.Credito = 2 THEN f.Total ELSE 0 END) AS Notas,
                    COUNT(DISTINCT CASE WHEN f.Credito IN (0, 1) AND f.RFC != 'XAXX010101000' THEN f.RFC END) AS ClientesUnicos,
                    COUNT(*) AS Facturas
                FROM tblFacturas f
                INNER JOIN tblTiendas t ON f.IdTienda = t.IdTienda
                WHERE f.FechaFactura >= ${startStr} AND f.FechaFactura <= ${endStr}
                GROUP BY f.IdTienda, t.Tienda
                ORDER BY VentaTotal DESC
            `;

            const rows = await query(sql) as any[];

            // KPIs "Todas las sucursales"
            const totalAll = rows.reduce((acc, r) => ({
                VentaTotal: acc.VentaTotal + Number(r.VentaTotal || 0),
                Contado: acc.Contado + Number(r.Contado || 0),
                Credito: acc.Credito + Number(r.Credito || 0),
                Publico: acc.Publico + Number(r.Publico || 0),
                Notas: acc.Notas + Number(r.Notas || 0),
                Facturas: acc.Facturas + Number(r.Facturas || 0)
            }), { VentaTotal: 0, Contado: 0, Credito: 0, Publico: 0, Notas: 0, Facturas: 0 });

            // ClientesUnicos GLOBAL requiere otra query (DISTINCT cross sucursales)
            const globalClientesSql = `
                SELECT COUNT(DISTINCT RFC) AS ClientesUnicos
                FROM tblFacturas
                WHERE FechaFactura >= ${startStr} AND FechaFactura <= ${endStr}
                AND Credito IN (0, 1) AND RFC != 'XAXX010101000'
            `;
            const [globalRow] = await query(globalClientesSql) as any[];

            return NextResponse.json({
                level,
                allStores: { ...totalAll, ClientesUnicos: Number(globalRow?.ClientesUnicos || 0) },
                stores: rows.map(r => ({
                    ...r,
                    VentaTotal: Number(r.VentaTotal || 0),
                    Contado: Number(r.Contado || 0),
                    Credito: Number(r.Credito || 0),
                    Publico: Number(r.Publico || 0),
                    Notas: Number(r.Notas || 0),
                    ClientesUnicos: Number(r.ClientesUnicos || 0),
                    Facturas: Number(r.Facturas || 0)
                }))
            });
        }

        // ---------------------------------------------------------------
        // NIVEL 2: PAYMENT-TYPES — 4 cards de tipos de venta para una sucursal
        // ---------------------------------------------------------------
        if (level === 'payment-types') {
            const storeF = tiendaFilter(searchParams.get('idTienda'));
            const sql = `
                SELECT
                    -- Contado
                    SUM(CASE WHEN Credito = 0 AND RFC != 'XAXX010101000' THEN Total ELSE 0 END) AS ContadoMonto,
                    COUNT(DISTINCT CASE WHEN Credito = 0 AND RFC != 'XAXX010101000' THEN RFC END) AS ContadoClientes,
                    SUM(CASE WHEN Credito = 0 AND RFC != 'XAXX010101000' THEN 1 ELSE 0 END) AS ContadoFacturas,
                    -- Credito
                    SUM(CASE WHEN Credito = 1 THEN Total ELSE 0 END) AS CreditoMonto,
                    COUNT(DISTINCT CASE WHEN Credito = 1 THEN RFC END) AS CreditoClientes,
                    SUM(CASE WHEN Credito = 1 THEN 1 ELSE 0 END) AS CreditoFacturas,
                    -- Publico
                    SUM(CASE WHEN RFC = 'XAXX010101000' AND Credito IN (0, 1) THEN Total ELSE 0 END) AS PublicoMonto,
                    SUM(CASE WHEN RFC = 'XAXX010101000' AND Credito IN (0, 1) THEN 1 ELSE 0 END) AS PublicoFacturas,
                    -- Notas
                    SUM(CASE WHEN Credito = 2 THEN Total ELSE 0 END) AS NotasMonto,
                    COUNT(DISTINCT CASE WHEN Credito = 2 THEN RFC END) AS NotasClientes,
                    SUM(CASE WHEN Credito = 2 THEN 1 ELSE 0 END) AS NotasFacturas
                FROM tblFacturas
                WHERE FechaFactura >= ${startStr} AND FechaFactura <= ${endStr} ${storeF}
            `;
            const [row] = await query(sql) as any[];
            const k = row || {};
            return NextResponse.json({
                level,
                paymentTypes: [
                    {
                        key: 'contado',
                        label: 'Contado',
                        monto: Number(k.ContadoMonto || 0),
                        clientes: Number(k.ContadoClientes || 0),
                        facturas: Number(k.ContadoFacturas || 0)
                    },
                    {
                        key: 'credito',
                        label: 'Crédito',
                        monto: Number(k.CreditoMonto || 0),
                        clientes: Number(k.CreditoClientes || 0),
                        facturas: Number(k.CreditoFacturas || 0)
                    },
                    {
                        key: 'publico',
                        label: 'Público General',
                        monto: Number(k.PublicoMonto || 0),
                        clientes: 1,
                        facturas: Number(k.PublicoFacturas || 0)
                    },
                    {
                        key: 'notas',
                        label: 'Nota de Crédito',
                        monto: Number(k.NotasMonto || 0),
                        clientes: Number(k.NotasClientes || 0),
                        facturas: Number(k.NotasFacturas || 0)
                    }
                ]
            });
        }

        // ---------------------------------------------------------------
        // NIVEL 3: CLIENTS — cards por cliente para tipo+sucursal
        // ---------------------------------------------------------------
        if (level === 'clients') {
            const tipo = searchParams.get('tipo') as PaymentType;
            if (!tipo || !PAYMENT_FILTERS[tipo]) {
                return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 });
            }
            const storeF = tiendaFilter(searchParams.get('idTienda'));
            const tipoFilter = PAYMENT_FILTERS[tipo];

            const sql = `
                SELECT TOP 200
                    RFC,
                    MAX(ClienteConcepto) AS ClienteConcepto,
                    SUM(Total) AS Monto,
                    COUNT(*) AS Facturas,
                    MIN(FechaFactura) AS PrimeraFactura,
                    MAX(FechaFactura) AS UltimaFactura
                FROM tblFacturas
                WHERE ${tipoFilter}
                AND FechaFactura >= ${startStr} AND FechaFactura <= ${endStr}
                ${storeF}
                GROUP BY RFC
                ORDER BY Monto DESC
            `;
            const rows = await query(sql) as any[];

            return NextResponse.json({
                level,
                clients: rows.map(r => ({
                    RFC: r.RFC,
                    ClienteConcepto: r.ClienteConcepto || '(Sin nombre)',
                    Monto: Number(r.Monto || 0),
                    Facturas: Number(r.Facturas || 0),
                    PrimeraFactura: r.PrimeraFactura,
                    UltimaFactura: r.UltimaFactura
                }))
            });
        }

        // ---------------------------------------------------------------
        // NIVEL 4: INVOICES — detalle de facturas para tipo+sucursal+cliente
        // ---------------------------------------------------------------
        if (level === 'invoices') {
            const tipo = searchParams.get('tipo') as PaymentType;
            const rfc = searchParams.get('rfc');
            if (!tipo || !PAYMENT_FILTERS_PREFIXED[tipo]) {
                return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 });
            }
            if (!rfc) {
                return NextResponse.json({ error: 'Falta rfc' }, { status: 400 });
            }
            const storeF = tiendaFilter(searchParams.get('idTienda'), 'f.');
            const tipoFilter = PAYMENT_FILTERS_PREFIXED[tipo];
            const cleanRfc = rfc.replace(/'/g, "''");

            const sql = `
                SELECT TOP 500
                    f.IdFactura, f.Serie, f.AlfaNumerico, f.FechaFactura,
                    f.RFC, f.ClienteConcepto, f.Total, f.MetodoPago, f.FormaPago, f.Credito,
                    t.Tienda, f.IdTienda
                FROM tblFacturas f
                INNER JOIN tblTiendas t ON f.IdTienda = t.IdTienda
                WHERE ${tipoFilter}
                AND f.FechaFactura >= ${startStr} AND f.FechaFactura <= ${endStr}
                AND f.RFC = '${cleanRfc}'
                ${storeF}
                ORDER BY f.FechaFactura DESC
            `;
            const rows = await query(sql) as any[];

            return NextResponse.json({
                level,
                invoices: rows.map(r => ({
                    IdFactura: r.IdFactura,
                    Serie: r.Serie,
                    AlfaNumerico: r.AlfaNumerico,
                    FechaFactura: r.FechaFactura,
                    RFC: r.RFC,
                    ClienteConcepto: r.ClienteConcepto,
                    Total: Number(r.Total || 0),
                    MetodoPago: r.MetodoPago,
                    FormaPago: r.FormaPago,
                    Credito: Number(r.Credito),
                    Tienda: r.Tienda,
                    IdTienda: r.IdTienda
                }))
            });
        }

        return NextResponse.json({ error: 'Nivel inválido' }, { status: 400 });
    } catch (error: any) {
        console.error('[Clients-Simple API] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
