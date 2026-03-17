require('dotenv').config();
const mysql = require('mysql2/promise');

async function simulatePopulation() {
    const config = {
        host: process.env.MYSQL_SERVER_SERVER,
        user: process.env.MYSQL_SERVER_USER,
        password: process.env.MYSQL_SERVER_PASSWORD,
        database: process.env.MYSQL_SERVER_DATABASE,
    };
    
    const idComputadora = 88888;
    const startDate = '2024-03-12';
    const endDate = '2024-03-12';

    try {
        const connection = await mysql.createConnection(config);
        console.log(`Connected to MySQL for simulation. IdComputadora: ${idComputadora}`);

        // 1. Clean
        await connection.execute('DELETE FROM tblBufferReporteRecibos WHERE IdComputadora = ?', [idComputadora]);
        await connection.execute('DELETE FROM tblBufferReporteOrdenesCompra WHERE IdComputadora = ?', [idComputadora]);
        console.log('Cleaned buffer.');

        // 2. Population Query
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

        console.log('Running population query...');
        const [result] = await connection.execute(populateOrdersSql, [idComputadora, startDate, endDate]);
        console.log('Order Population Result:', result.affectedRows, 'rows');

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
        const [reciboResult] = await connection.execute(populateRecibosSql, [idComputadora, idComputadora]);
        console.log('Recibo Population Result:', reciboResult.affectedRows, 'rows');

        // 4. Update
        const updateSql = `
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
        await connection.execute(updateSql, [idComputadora]);
        console.log('Updates applied.');

        // 5. Final Retrieval
        const retrievalSql = `
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
                F.Usuario 
            FROM tblBufferReporteOrdenesCompra A 
            INNER JOIN tblProveedores B ON A.IdProveedor = B.IdProveedor 
            INNER JOIN tblTiendas C ON A.IdTienda = C.IdTienda 
            INNER JOIN tblTiposOrdenesCompra D ON A.IdTipoOrdenCompra = D.IdTipoOrdenCompra 
            INNER JOIN tblStatusOrdenesCompra E ON A.IdStatusOrdenCompra = E.IdStatusOrdenCompra 
            INNER JOIN tblUsuarios F ON A.IdUsuarioOrdenCompra = F.IdUsuario 
            INNER JOIN tblRazonesSociales G ON C.IdRazonSocial = G.IdRazonSocial 
            WHERE A.IdComputadora = ?
        `;
        const [rows] = await connection.execute(retrievalSql, [idComputadora]);
        console.log('Final Retrieval Result:', rows.length, 'rows');

        if (rows.length === 0) {
            console.log('Retrieval empty! Checking joins...');
            const [joinsCheck] = await connection.execute(`
                SELECT COUNT(*) as count 
                FROM tblBufferReporteOrdenesCompra A 
                INNER JOIN tblProveedores B ON A.IdProveedor = B.IdProveedor 
                INNER JOIN tblTiendas C ON A.IdTienda = C.IdTienda 
                INNER JOIN tblTiposOrdenesCompra D ON A.IdTipoOrdenCompra = D.IdTipoOrdenCompra 
                INNER JOIN tblStatusOrdenesCompra E ON A.IdStatusOrdenCompra = E.IdStatusOrdenCompra 
                INNER JOIN tblUsuarios F ON A.IdUsuarioOrdenCompra = F.IdUsuario 
                INNER JOIN tblRazonesSociales G ON C.IdRazonSocial = G.IdRazonSocial 
                WHERE A.IdComputadora = ?
            `, [idComputadora]);
            console.log('Join count:', joinsCheck[0].count);
        }

        await connection.end();
    } catch (err) {
        console.error('Simulation Failed:', err);
    }
}

simulatePopulation();
