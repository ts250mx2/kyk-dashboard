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
        let result = await pool.request().query(`
            DECLARE @sql NVARCHAR(MAX) = '';
            SELECT @sql += 'SELECT ''' + name + ''' AS DB, TABLE_NAME FROM ' + QUOTENAME(name) + '.INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME LIKE ''%Comprobante%'';'
            FROM sys.databases 
            WHERE state_desc = 'ONLINE' AND name NOT IN ('master', 'tempdb', 'model', 'msdb');
            EXEC sp_executesql @sql;
        `);
        console.log('Results:', JSON.stringify(result.recordset));
        await pool.close();
    } catch (err) {
        console.error('Error:', err);
    }
}

test();
