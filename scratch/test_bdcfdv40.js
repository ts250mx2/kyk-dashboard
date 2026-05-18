const sql = require('mssql');
require('dotenv').config();

const config = {
    user: process.env.SQL_SERVER_USER || 'sa',
    password: (process.env.SQL_SERVER_PASSWORD || 'Ve14$20rio').replace(/\\(\$)/g, '$1'),
    database: 'master',
    server: process.env.SQL_SERVER_SERVER || '192.168.1.20',
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

async function test() {
    try {
        let pool = await sql.connect(config);
        let result = await pool.request().query("SELECT TOP 1 * FROM BDCFDV40.dbo.tblComprobantes");
        console.log('Success:', JSON.stringify(result.recordset[0]));
        await pool.close();
    } catch (err) {
        console.error('Error:', err.message);
    }
}

test();
