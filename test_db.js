const sql = require('mssql');

const config = {
    user: 'sa',
    password: 'Ve14$20rio',
    database: 'BDKYK',
    server: '192.168.1.20',
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

async function run() {
    try {
        console.log('Connecting...');
        await sql.connect(config);
        console.log('Connected!');
        const result = await sql.query`SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'tblPalabrasClave'`;
        console.dir(result.recordset, { depth: null });

        const data = await sql.query`SELECT TOP 5 * FROM tblPalabrasClave`;
        console.log('Current Data:');
        console.dir(data.recordset, { depth: null });

        process.exit(0);
    } catch (err) {
        console.error('ERROR MESSAGE:', err.message);
        console.error('ERROR CODE:', err.code);
        process.exit(1);
    }
}

run();
