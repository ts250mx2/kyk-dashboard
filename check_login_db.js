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

async function inspect() {
    try {
        await sql.connect(config);
        const result = await sql.query`
            SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'tblUsuarios'
            ORDER BY ORDINAL_POSITION
        `;
        console.log('Columns for tblUsuarios:');
        console.log(JSON.stringify(result.recordset, null, 2));

        const users = await sql.query`
            SELECT TOP 5 Usuario, CodigoBarras, Contrasenia2, Status FROM tblUsuarios
        `;
        console.log('Sample Data from tblUsuarios:');
        console.log(JSON.stringify(users.recordset, null, 2));

        await sql.close();
    } catch (err) {
        console.error(err);
    }
}

inspect();
