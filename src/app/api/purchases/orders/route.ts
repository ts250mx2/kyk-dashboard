import { NextResponse } from 'next/server';
import { mysqlQuery } from '@/lib/mysql';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const idComputadora = searchParams.get('idComputadora');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!idComputadora) {
        return NextResponse.json({ error: 'IdComputadora is required' }, { status: 400 });
    }

    // If dates are provided, we should populate/refresh the buffer
    if (startDate && endDate) {
        console.log(`[Orders API] Populating buffer for IdComputadora: ${idComputadora}, Range: ${startDate} to ${endDate}`);
        try {
            // 1. Clean previous data for this session
            await mysqlQuery('DELETE FROM tblBufferReporteRecibos WHERE IdComputadora = ?', [idComputadora]);
            await mysqlQuery('DELETE FROM tblBufferReporteOrdenesCompra WHERE IdComputadora = ?', [idComputadora]);
            console.log('[Orders API] Cleaned previous buffer data');

            // 2. Populate tblBufferReporteOrdenesCompra
            const populateOrdersSql = `
                INSERT INTO tblBufferReporteOrdenesCompra(
                    IdOrdenCompra, IdComputadora, IdTiendaComputadora, IdTienda, IdProveedor, 
                    IdStatusOrdenCompra, IdTipoOrdenCompra, IdUsuarioOrdenCompra, FechaOrdenCompra, 
                    Ordenados, TotalPedido, FechaCaducidad, IdReciboMovil, TieneDistribucion
                )
                SELECT 
                    A.IdOrdenCompra, ?, 0, A.IdTienda, A.IdProveedor, 
                    A.IdStatusOrdenCompra, A.IdTipoOrdenCompra, A.IdUsuarioOrdenCompra, A.FechaOrdenCompra, 
                    SUM(CASE WHEN B.Cantidad > 0 THEN 1 ELSE 0 END),
                    SUM(B.Cantidad * B.Costo * (1-B.Desc0)*(1-B.Desc1)*(1-B.Desc2)*(1-B.Desc3)*(1-B.Desc4)*(CASE WHEN B.FactorVolumen = 0 THEN 1 ELSE B.FactorVolumen END)*(1+D.IEPS)*(1+B.IVA)) AS TotalPedido, 
                    A.FechaCaducidad, A.IdReciboMovil, A.TieneDistribucion
                FROM tblOrdenesCompra A
                INNER JOIN tblDetalleOrdenesCompra B ON A.IdOrdenCompra = B.IdOrdenCompra
                INNER JOIN tblTiendas C ON A.IdTienda = C.IdTienda
                INNER JOIN tblArticulosSAP D ON B.CodigoInterno = D.CodigoInterno
                WHERE A.FechaOrdenCompra >= ? AND A.FechaOrdenCompra <= CONCAT(?, ' 23:59:59')
                GROUP BY A.IdOrdenCompra, A.IdTienda, A.IdProveedor, A.IdStatusOrdenCompra, A.IdTipoOrdenCompra, A.IdUsuarioOrdenCompra, A.FechaOrdenCompra, A.FechaCaducidad, A.IdReciboMovil, A.TieneDistribucion
            `;
            const orderPopulation = await mysqlQuery(populateOrdersSql, [idComputadora, startDate, endDate]);
            console.log('[Orders API] Population Order Buffer Result:', orderPopulation);

            // 3. Populate tblBufferReporteRecibos
            const populateRecibosSql = `
                INSERT INTO tblBufferReporteRecibos(
                    IdOrdenCompra, IdRecibo, IdTienda, IdComputadora, IdTiendaComputadora, 
                    TipoRecibo, FolioRecibo, FechaRecibo, IdProveedor, Numero, Total, 
                    TotalRecibo, TotalDev, Recibidos, Devoluciones, UUID
                )
                SELECT 
                    A.IdOrdenCompra, A.IdReciboMovil, A.IdTienda, ?, 0, 
                    0, B.FolioReciboMovil, B.FechaRecibo, A.IdProveedor, B.Numero, B.Total,
                    SUM(CASE WHEN C.Devolucion = 0 THEN C.Rec * C.Costo * (1-C.Desc0)*(1-C.Desc1)*(1-C.Desc2)*(1-C.Desc3)*(1-C.Desc4)*(CASE WHEN C.Factor = 0 THEN 1 ELSE C.Factor END)* (1+C.IEPS) * (1+C.IVA) ELSE 0 END) AS TotalRecibo,
                    SUM(CASE WHEN C.Devolucion = 1 THEN C.Rec * C.Costo * (1-C.Desc0)*(1-C.Desc1)*(1-C.Desc2)*(1-C.Desc3)*(1-C.Desc4)*(CASE WHEN C.Factor = 0 THEN 1 ELSE C.Factor END)* (1+C.IEPS) * (1+C.IVA) ELSE 0 END) AS TotalDev,
                    SUM(CASE WHEN C.Devolucion = 0 THEN 1 ELSE 0 END) AS Recibidos,
                    SUM(CASE WHEN C.Devolucion = 1 THEN 1 ELSE 0 END) AS Devoluciones, B.UUID
                FROM tblBufferReporteOrdenesCompra A
                INNER JOIN tblReciboMovil B ON A.IdReciboMovil = B.IdReciboMovil AND A.IdTienda = B.IdTienda
                INNER JOIN tblDetalleReciboMovil C ON B.IdReciboMovil = C.IdReciboMovil AND B.IdTienda = C.IdTienda
                WHERE A.IdComputadora = ? AND A.IdTiendaComputadora = 0
                GROUP BY A.IdOrdenCompra, A.IdReciboMovil, A.IdTienda, B.FolioReciboMovil, B.FechaRecibo, A.IdProveedor, B.Numero, B.Total, B.UUID
            `;
            const reciboPopulation = await mysqlQuery(populateRecibosSql, [idComputadora, idComputadora]);
            console.log('[Orders API] Population Recibo Buffer Result:', reciboPopulation);

            // 4. Update Order Buffer with Recibo data
            const updateOrdersWithRecibosSql = `
                UPDATE tblBufferReporteOrdenesCompra A
                INNER JOIN tblBufferReporteRecibos B ON A.IdOrdenCompra = B.IdOrdenCompra 
                    AND A.IdComputadora = B.IdComputadora 
                    AND A.IdTiendaComputadora = B.IdTiendaComputadora
                SET A.TotalRecibo = B.TotalRecibo, 
                    A.TotalDev = B.TotalDev, 
                    A.Recibidos = B.Recibidos, 
                    A.Devoluciones = B.Devoluciones, 
                    A.FolioReciboMovil = B.FolioRecibo, 
                    A.NumeroFactura = B.Numero, 
                    A.FechaRecibo = B.FechaRecibo, 
                    A.TotalFactura = B.Total, 
                    A.UUID = B.UUID
                WHERE A.IdComputadora = ?
            `;
            await mysqlQuery(updateOrdersWithRecibosSql, [idComputadora]);

            // 5. Final Calculations
            const finalCalculationsSql = `
                UPDATE tblBufferReporteOrdenesCompra 
                SET TotalPagar = IFNULL(TotalRecibo, 0) - IFNULL(TotalDev, 0), 
                    PorcentajeEfectividad = CASE WHEN TotalPedido > 0 THEN (IFNULL(TotalRecibo, 0) / TotalPedido) * 100 ELSE 0 END
                WHERE IdComputadora = ?
            `;
            await mysqlQuery(finalCalculationsSql, [idComputadora]);
            console.log('[Orders API] Population logic completed successfully');

        } catch (error: any) {
            console.error('[Orders API] Error populating buffer tables:', error);
            return NextResponse.json({ error: 'Failed to populate session data: ' + error.message }, { status: 500 });
        }
    }

    try {
        const storeIdsStr = searchParams.get('storeIds');
        const storeIds = storeIdsStr ? storeIdsStr.split(',').map(Number).filter(n => !isNaN(n)) : [];

        let storeFilter = '';
        const params: any[] = [idComputadora];
        
        if (storeIds.length > 0) {
            storeFilter = ` AND A.IdTienda IN (${storeIds.map(() => '?').join(',')})`;
            params.push(...storeIds);
        }

        const sql = `
            SELECT 
                A.*, 
                B.Proveedor, 
                C.Tienda, 
                G.RazonSocial, 
                CASE 
                    WHEN A.TieneDistribucion = 1 THEN CONCAT(D.TipoOrdenCompra, '/DIST') 
                    ELSE D.TipoOrdenCompra 
                END AS TipoOrdenCompra, 
                E.StatusOrdenCompra as Status, 
                F.Usuario as UsuarioOrden,
                H.Usuario as UsuarioRecibo,
                I.FolioReciboMovil
            FROM tblBufferReporteOrdenesCompra A 
            INNER JOIN tblProveedores B ON A.IdProveedor = B.IdProveedor 
            INNER JOIN tblTiendas C ON A.IdTienda = C.IdTienda 
            INNER JOIN tblTiposOrdenesCompra D ON A.IdTipoOrdenCompra = D.IdTipoOrdenCompra 
            INNER JOIN tblStatusOrdenesCompra E ON A.IdStatusOrdenCompra = E.IdStatusOrdenCompra 
            INNER JOIN tblUsuarios F ON A.IdUsuarioOrdenCompra = F.IdUsuario 
            INNER JOIN tblRazonesSociales G ON C.IdRazonSocial = G.IdRazonSocial 
            LEFT JOIN tblReciboMovil I ON A.IdReciboMovil = I.IdReciboMovil AND A.IdTienda = I.IdTienda
            LEFT JOIN tblUsuarios H ON I.IdUsuarioRecibo = H.IdUsuario
            WHERE A.IdComputadora = ? ${storeFilter}
            ORDER BY A.FechaOrdenCompra DESC
        `;

        console.log('[Orders API] Executing final retrieval query...');
        const results = await mysqlQuery(sql, params);
        console.log(`[Orders API] Found ${Array.isArray(results) ? results.length : 0} results`);
        return NextResponse.json(results);
    } catch (error: any) {
        console.error('[Orders API] Retrieval Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
