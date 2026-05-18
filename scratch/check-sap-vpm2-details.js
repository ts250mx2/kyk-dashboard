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

async function checkDetails() {
    try {
        console.log(`Connecting to SAP DB: ${config.database} on ${config.server}`);
        const pool = await sql.connect(config);
        
        const dbInfo = await pool.request().query("SELECT DB_NAME() as CurrentDB");
        console.log(`✅ Connected to DB: ${dbInfo.recordset[0].CurrentDB}`);
        
        console.log('Checking for VPM2 in sys.objects...');
        const result = await pool.request().query("SELECT name, type_desc FROM sys.objects WHERE name = 'VPM2'");
        
        if (result.recordset.length > 0) {
            console.log(`✅ Found VPM2: ${result.recordset[0].type_desc}`);
        } else {
            console.log('❌ VPM2 NOT found in current database!');
            
            console.log('Checking if it exists in ANOTHER database (cross-db check)...');
            // This is just a guess, but let's see if we can see other databases
            const dbs = await pool.request().query("SELECT name FROM sys.databases WHERE name LIKE 'KYK%'");
            console.log('Available KYK databases:', dbs.recordset.map(r => r.name).join(', '));
        }
        
        await sql.close();
    } catch (err) {
        console.error('Error:', err.message);
    }
}

checkDetails();
