require('dotenv').config();
const mysql = require('mysql2/promise');

async function testData() {
    const config = {
        host: process.env.MYSQL_SERVER_SERVER,
        user: process.env.MYSQL_SERVER_USER,
        password: process.env.MYSQL_SERVER_PASSWORD,
        database: process.env.MYSQL_SERVER_DATABASE,
    };
    
    console.log('Connecting to MySQL:', config.host);
    try {
        const connection = await mysql.createConnection(config);
        console.log('Connected!');

        console.log('\nChecking source tables count...');
        const [ocCount] = await connection.execute('SELECT COUNT(*) as count FROM tblOrdenesCompra');
        console.log('tblOrdenesCompra count:', ocCount[0].count);

        const [docCount] = await connection.execute('SELECT COUNT(*) as count FROM tblDetalleOrdenesCompra');
        console.log('tblDetalleOrdenesCompra count:', docCount[0].count);

        const [tCount] = await connection.execute('SELECT COUNT(*) as count FROM tblTiendas');
        console.log('tblTiendas count:', tCount[0].count);

        const [artCount] = await connection.execute('SELECT COUNT(*) as count FROM tblArticulosSAP');
        console.log('tblArticulosSAP count:', artCount[0].count);

        console.log('\nChecking date range (last 30 days)...');
        const [dateRange] = await connection.execute(`
            SELECT MIN(FechaOrdenCompra) as minDate, MAX(FechaOrdenCompra) as maxDate 
            FROM tblOrdenesCompra
        `);
        console.log('Order date range:', dateRange[0]);

        await connection.end();
    } catch (err) {
        console.error('Test Failed:', err);
    }
}

testData();
