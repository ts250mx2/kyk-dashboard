const sql = require('mssql');
require('dotenv').config();

const config = {
    user: process.env.SAP_B1_USER || 'sa',
    password: (process.env.SAP_B1_PASSWORD || 'B1Admin').replace(/\\(\$)/g, '$1'),
    database: 'master',
    server: process.env.SAP_B1_SERVER || '192.168.1.200',
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
