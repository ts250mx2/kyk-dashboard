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
        let result = await pool.request().query("SELECT name FROM sys.databases");
        console.log('Databases:', JSON.stringify(result.recordset.map(r => r.name)));
        await pool.close();
    } catch (err) {
        console.error('Error:', err);
    }
}

test();
