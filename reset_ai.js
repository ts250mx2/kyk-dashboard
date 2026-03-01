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

async function resetAI() {
    try {
        let pool = await sql.connect(config);
        console.log('Connected to database.');

        console.log('Deleting all learned rules from tblReglasPalabrasClave...');
        await pool.request().query('DELETE FROM tblReglasPalabrasClave');

        console.log('Deleting all learned keywords from tblPalabrasClave...');
        await pool.request().query('DELETE FROM tblPalabrasClave');

        console.log('Reset complete. The AI will now only follow the database-schema.md file.');
        await pool.close();
    } catch (err) {
        console.error('Error resetting AI:', err);
    }
}

resetAI();
