const sql = require('mssql');
require('dotenv').config();

const config = {
    user: process.env.SQL_SERVER_USER || 'sa',
    password: (process.env.SQL_SERVER_PASSWORD || 'Ve14$20rio').replace(/\\(\$)/g, '$1'),
    database: process.env.SQL_SERVER_DATABASE || 'BDKYK',
    server: process.env.SQL_SERVER_SERVER || '192.168.1.20',
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    },
    options: {
        encrypt: false,
        trustServerCertificate: true
    },
    requestTimeout: 15000
};

async function testConnection() {
    console.log('--- Database Connection Test ---');
    console.log(`Connecting to: ${config.server}`);
    console.log(`Database: ${config.database}`);
    console.log(`User: ${config.user}`);
    console.log('--------------------------------');

    try {
        const pool = await sql.connect(config);
        console.log('✅ SUCCESS: Connection established safely.');

        const result = await pool.request().query('SELECT TOP 1 Tienda FROM tblTiendas');
        console.log('✅ SUCCESS: Query executed correctly.');
        console.log('Sample data (Tienda):', result.recordset[0]?.Tienda || 'No data found');

        await sql.close();
        console.log('--------------------------------');
        console.log('Test completed successfully.');
    } catch (err) {
        console.error('❌ ERROR: Connection failed!');
        console.error('Details:', err.message);
        console.log('--------------------------------');
        process.exit(1);
    }
}

testConnection();
