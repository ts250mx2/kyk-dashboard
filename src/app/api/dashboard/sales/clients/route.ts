import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const fechaInicio = searchParams.get('fechaInicio');
        const fechaFin = searchParams.get('fechaFin');
        const idTienda = searchParams.get('idTienda') || 'all';
        const rfc = searchParams.get('rfc') || '';

        if (!fechaInicio || !fechaFin) {
            return NextResponse.json({ error: 'Missing date parameters' }, { status: 400 });
        }

        const startStr = `'${fechaInicio} 00:00:00'`;
        const endStr = `'${fechaFin} 23:59:59'`;

        // Parse multi-select stores filter
        let storeFilter = '';
        let fStoreFilter = '';

        if (idTienda !== 'all') {
            const storeIds = idTienda.split(',').map(Number).filter(n => !isNaN(n));
            if (storeIds.length > 0) {
                storeFilter = `AND IdTienda IN (${storeIds.join(',')})`;
                fStoreFilter = `AND f.IdTienda IN (${storeIds.join(',')})`;
            }
        }

        // Apply specific client RFC filter if selected
        let rfcFilter = '';
        let fRfcFilter = '';
        if (rfc && rfc !== 'all') {
            const cleanRfc = rfc.replace(/'/g, "''");
            rfcFilter = `AND RFC = '${cleanRfc}'`;
            fRfcFilter = `AND f.RFC = '${cleanRfc}'`;
        }

        // 1. KPI Aggregates
        const kpiSql = `
            SELECT 
                -- Totales
                SUM(CASE WHEN Credito IN (0, 1) THEN Total ELSE 0 END) as TotalVentas,
                COUNT(DISTINCT CASE WHEN Credito IN (0, 1) THEN RFC END) as TotalClientes,

                -- Contado (Credito = 0, no publico general)
                SUM(CASE WHEN Credito = 0 AND RFC != 'XAXX010101000' THEN Total ELSE 0 END) as ContadoMonto,
                COUNT(DISTINCT CASE WHEN Credito = 0 AND RFC != 'XAXX010101000' THEN RFC END) as ContadoClientes,

                -- Credito (Credito = 1)
                SUM(CASE WHEN Credito = 1 THEN Total ELSE 0 END) as CreditoMonto,
                COUNT(DISTINCT CASE WHEN Credito = 1 THEN RFC END) as CreditoClientes,

                -- Publico General (RFC = XAXX010101000, Credito IN (0,1))
                SUM(CASE WHEN RFC = 'XAXX010101000' AND Credito IN (0, 1) THEN Total ELSE 0 END) as PublicoMonto,
                SUM(CASE WHEN RFC = 'XAXX010101000' AND Credito IN (0, 1) THEN 1 ELSE 0 END) as PublicoOperaciones,

                -- Notas de Credito (Credito = 2)
                SUM(CASE WHEN Credito = 2 THEN Total ELSE 0 END) as NotasMonto,
                COUNT(DISTINCT CASE WHEN Credito = 2 THEN RFC END) as NotasClientes,
                SUM(CASE WHEN Credito = 2 THEN 1 ELSE 0 END) as NotasOperaciones
            FROM tblFacturas
            WHERE FechaFactura >= ${startStr} AND FechaFactura <= ${endStr} ${storeFilter} ${rfcFilter}
        `;

        // 2. Top Clients by Category
        const topClientsTotalesSql = `
            SELECT TOP 15 RFC, ClienteConcepto, SUM(Total) as Total, COUNT(*) as Operaciones
            FROM tblFacturas
            WHERE Credito IN (0, 1) AND FechaFactura >= ${startStr} AND FechaFactura <= ${endStr} ${storeFilter} ${rfcFilter}
            GROUP BY RFC, ClienteConcepto
            ORDER BY Total DESC
        `;

        const topClientsContadoSql = `
            SELECT TOP 15 RFC, ClienteConcepto, SUM(Total) as Total, COUNT(*) as Operaciones
            FROM tblFacturas
            WHERE Credito = 0 AND RFC != 'XAXX010101000' AND FechaFactura >= ${startStr} AND FechaFactura <= ${endStr} ${storeFilter} ${rfcFilter}
            GROUP BY RFC, ClienteConcepto
            ORDER BY Total DESC
        `;

        const topClientsCreditoSql = `
            SELECT TOP 15 RFC, ClienteConcepto, SUM(Total) as Total, COUNT(*) as Operaciones
            FROM tblFacturas
            WHERE Credito = 1 AND FechaFactura >= ${startStr} AND FechaFactura <= ${endStr} ${storeFilter} ${rfcFilter}
            GROUP BY RFC, ClienteConcepto
            ORDER BY Total DESC
        `;

        const topClientsNotasSql = `
            SELECT TOP 15 RFC, ClienteConcepto, SUM(Total) as Total, COUNT(*) as Operaciones
            FROM tblFacturas
            WHERE Credito = 2 AND FechaFactura >= ${startStr} AND FechaFactura <= ${endStr} ${storeFilter} ${rfcFilter}
            GROUP BY RFC, ClienteConcepto
            ORDER BY Total DESC
        `;

        // 3. Store breakdowns
        const storesTotalesSql = `
            SELECT f.IdTienda, t.Tienda, SUM(f.Total) as Total, COUNT(*) as Operaciones
            FROM tblFacturas f
            JOIN tblTiendas t ON f.IdTienda = t.IdTienda
            WHERE f.Credito IN (0, 1) AND f.FechaFactura >= ${startStr} AND f.FechaFactura <= ${endStr} ${fStoreFilter} ${fRfcFilter}
            GROUP BY f.IdTienda, t.Tienda
            ORDER BY Total DESC
        `;

        const storesContadoSql = `
            SELECT f.IdTienda, t.Tienda, SUM(f.Total) as Total, COUNT(*) as Operaciones
            FROM tblFacturas f
            JOIN tblTiendas t ON f.IdTienda = t.IdTienda
            WHERE f.Credito = 0 AND f.RFC != 'XAXX010101000' AND f.FechaFactura >= ${startStr} AND f.FechaFactura <= ${endStr} ${fStoreFilter} ${fRfcFilter}
            GROUP BY f.IdTienda, t.Tienda
            ORDER BY Total DESC
        `;

        const storesCreditoSql = `
            SELECT f.IdTienda, t.Tienda, SUM(f.Total) as Total, COUNT(*) as Operaciones
            FROM tblFacturas f
            JOIN tblTiendas t ON f.IdTienda = t.IdTienda
            WHERE f.Credito = 1 AND f.FechaFactura >= ${startStr} AND f.FechaFactura <= ${endStr} ${fStoreFilter} ${fRfcFilter}
            GROUP BY f.IdTienda, t.Tienda
            ORDER BY Total DESC
        `;

        const storesPublicoSql = `
            SELECT f.IdTienda, t.Tienda, SUM(f.Total) as Total, COUNT(*) as Operaciones
            FROM tblFacturas f
            JOIN tblTiendas t ON f.IdTienda = t.IdTienda
            WHERE f.RFC = 'XAXX010101000' AND f.Credito IN (0, 1) AND f.FechaFactura >= ${startStr} AND f.FechaFactura <= ${endStr} ${fStoreFilter} ${fRfcFilter}
            GROUP BY f.IdTienda, t.Tienda
            ORDER BY Total DESC
        `;

        const storesNotasSql = `
            SELECT f.IdTienda, t.Tienda, SUM(f.Total) as Total, COUNT(*) as Operaciones
            FROM tblFacturas f
            JOIN tblTiendas t ON f.IdTienda = t.IdTienda
            WHERE f.Credito = 2 AND f.FechaFactura >= ${startStr} AND f.FechaFactura <= ${endStr} ${fStoreFilter} ${fRfcFilter}
            GROUP BY f.IdTienda, t.Tienda
            ORDER BY Total DESC
        `;

        // Apply dynamic time series grouping (día, semana, mes)
        const groupBy = searchParams.get('groupBy') || 'dia';
        let dateSelector = 'CAST(FechaFactura AS DATE)';
        if (groupBy === 'semana') {
            dateSelector = 'DATEADD(WEEK, DATEDIFF(WEEK, 0, FechaFactura), 0)';
        } else if (groupBy === 'mes') {
            dateSelector = 'DATEFROMPARTS(YEAR(FechaFactura), MONTH(FechaFactura), 1)';
        }

        // 4. Daily trends
        const dailyTotalesSql = `
            SELECT ${dateSelector} as Fecha, SUM(Total) as Total, COUNT(*) as Operaciones
            FROM tblFacturas
            WHERE Credito IN (0, 1) AND FechaFactura >= ${startStr} AND FechaFactura <= ${endStr} ${storeFilter} ${rfcFilter}
            GROUP BY ${dateSelector}
            ORDER BY Fecha
        `;

        const dailyContadoSql = `
            SELECT ${dateSelector} as Fecha, SUM(Total) as Total, COUNT(*) as Operaciones
            FROM tblFacturas
            WHERE Credito = 0 AND RFC != 'XAXX010101000' AND FechaFactura >= ${startStr} AND FechaFactura <= ${endStr} ${storeFilter} ${rfcFilter}
            GROUP BY ${dateSelector}
            ORDER BY Fecha
        `;

        const dailyCreditoSql = `
            SELECT ${dateSelector} as Fecha, SUM(Total) as Total, COUNT(*) as Operaciones
            FROM tblFacturas
            WHERE Credito = 1 AND FechaFactura >= ${startStr} AND FechaFactura <= ${endStr} ${storeFilter} ${rfcFilter}
            GROUP BY ${dateSelector}
            ORDER BY Fecha
        `;

        const dailyPublicoSql = `
            SELECT ${dateSelector} as Fecha, SUM(Total) as Total, COUNT(*) as Operaciones
            FROM tblFacturas
            WHERE RFC = 'XAXX010101000' AND Credito IN (0, 1) AND FechaFactura >= ${startStr} AND FechaFactura <= ${endStr} ${storeFilter} ${rfcFilter}
            GROUP BY ${dateSelector}
            ORDER BY Fecha
        `;

        const dailyNotasSql = `
            SELECT ${dateSelector} as Fecha, SUM(Total) as Total, COUNT(*) as Operaciones
            FROM tblFacturas
            WHERE Credito = 2 AND FechaFactura >= ${startStr} AND FechaFactura <= ${endStr} ${storeFilter} ${rfcFilter}
            GROUP BY ${dateSelector}
            ORDER BY Fecha
        `;

        // 5. Raw Invoices List for Table
        const invoicesSql = `
            SELECT TOP 500 
                f.IdFactura, f.Serie, f.AlfaNumerico, f.FechaFactura, 
                f.RFC, f.ClienteConcepto, f.Total, f.MetodoPago, f.FormaPago, f.Credito,
                t.Tienda
            FROM tblFacturas f
            JOIN tblTiendas t ON f.IdTienda = t.IdTienda
            WHERE f.FechaFactura >= ${startStr} AND f.FechaFactura <= ${endStr} ${fStoreFilter} ${fRfcFilter}
            ORDER BY f.FechaFactura DESC
        `;

        // 6. Stores Catalog List (Exactly matches the list from the Heatmap dashboard)
        const storesListSql = `
            SELECT DISTINCT t.IdTienda, t.Tienda 
            FROM tblVentas v
            JOIN tblTiendas t ON v.IdTienda = t.IdTienda
            WHERE v.FechaVenta >= ${startStr} AND v.FechaVenta <= ${endStr}
            ORDER BY t.Tienda
        `;

        // Execute all queries in parallel for peak performance!
        const [
            kpiResult,
            topTotales, topContado, topCredito, topNotas,
            storesTotales, storesContado, storesCredito, storesPublico, storesNotas,
            dailyTotales, dailyContado, dailyCredito, dailyPublico, dailyNotas,
            invoicesList,
            storesList
        ] = await Promise.all([
            query(kpiSql),
            query(topClientsTotalesSql),
            query(topClientsContadoSql),
            query(topClientsCreditoSql),
            query(topClientsNotasSql),
            query(storesTotalesSql),
            query(storesContadoSql),
            query(storesCreditoSql),
            query(storesPublicoSql),
            query(storesNotasSql),
            query(dailyTotalesSql),
            query(dailyContadoSql),
            query(dailyCreditoSql),
            query(dailyPublicoSql),
            query(dailyNotasSql),
            query(invoicesSql),
            query(storesListSql)
        ]);

        const kpis = kpiResult[0] || {
            TotalVentas: 0, TotalClientes: 0,
            ContadoMonto: 0, ContadoClientes: 0,
            CreditoMonto: 0, CreditoClientes: 0,
            PublicoMonto: 0, PublicoOperaciones: 0,
            NotasMonto: 0, NotasClientes: 0, NotasOperaciones: 0
        };

        return NextResponse.json({
            kpis,
            desgloses: {
                totales: { top: topTotales, stores: storesTotales, daily: dailyTotales },
                contado: { top: topContado, stores: storesContado, daily: dailyContado },
                credito: { top: topCredito, stores: storesCredito, daily: dailyCredito },
                publico: { top: [{ RFC: 'XAXX010101000', ClienteConcepto: 'Público General', Total: kpis.PublicoMonto, Operaciones: kpis.PublicoOperaciones }], stores: storesPublico, daily: dailyPublico },
                notas: { top: topNotas, stores: storesNotas, daily: dailyNotas }
            },
            invoices: invoicesList,
            stores: storesList
        });

    } catch (error: any) {
        console.error('[Clients Stats API] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
