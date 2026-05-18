const sql = require('mssql');
require('dotenv').config();

const config = {
    user: process.env.SQL_SERVER_USER || 'sa',
    password: (process.env.SQL_SERVER_PASSWORD || 'Ve14$20rio').replace(/\\(\$)/g, '$1'),
    database: process.env.SQL_SERVER_DATABASE || 'BDKYK',
    server: process.env.SQL_SERVER_SERVER || '192.168.1.20',
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

async function test() {
    try {
        console.log('Connecting to:', config.server, config.database);
        let pool = await sql.connect(config);
        console.log('Connected!');
        let result = await pool.request().query("SELECT name FROM sys.tables ORDER BY name");
        console.log('Tables:', JSON.stringify(result.recordset.map(r => r.name)));
        await pool.close();
    } catch (err) {
        console.error('Error:', err);
    }
}

test();
