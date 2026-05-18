const sql = require('mssql');
require('dotenv').config();

const config = {
    user: process.env.SAP_B1_USER,
    password: process.env.SAP_B1_PASSWORD,
    database: process.env.SAP_B1_DATABASE,
    server: process.env.SAP_B1_SERVER,
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

async function checkSchema() {
    try {
        const pool = await sql.connect(config);
        
        const result = await pool.request().query(`
            SELECT s.name as SchemaName, t.name as TableName 
            FROM sys.tables t 
            INNER JOIN sys.schemas s ON t.schema_id = s.schema_id 
            WHERE t.name = 'VPM2'
        `);
        
        if (result.recordset.length > 0) {
            console.log(`✅ Table VPM2 found in schema: ${result.recordset[0].SchemaName}`);
        } else {
            console.log('❌ VPM2 table not found!');
        }
        
        await sql.close();
    } catch (err) {
        console.error('Error:', err.message);
    }
}

checkSchema();
