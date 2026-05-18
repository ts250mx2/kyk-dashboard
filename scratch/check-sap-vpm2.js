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

async function checkTable() {
    try {
        console.log(`Connecting to SAP DB: ${config.database} on ${config.server}`);
        const pool = await sql.connect(config);
        
        console.log('Checking for VPM2 table...');
        const result = await pool.request().query("SELECT name FROM sys.tables WHERE name = 'VPM2'");
        
        if (result.recordset.length > 0) {
            console.log('✅ Found VPM2 table.');
        } else {
            console.log('❌ VPM2 table NOT found!');
            
            console.log('Listing similar tables (VPM*):');
            const similar = await pool.request().query("SELECT name FROM sys.tables WHERE name LIKE 'VPM%'");
            console.log(similar.recordset.map(r => r.name).join(', '));
        }
        
        await sql.close();
    } catch (err) {
        console.error('Error:', err.message);
    }
}

checkTable();
