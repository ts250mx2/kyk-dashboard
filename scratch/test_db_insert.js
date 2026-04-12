
const mysql = require('mysql2/promise');
require('dotenv').config();

async function testInsert() {
    const connection = await mysql.createConnection({
        host: process.env.MYSQL_SERVER_SERVER,
        user: process.env.MYSQL_SERVER_USER,
        password: process.env.MYSQL_SERVER_PASSWORD,
        database: process.env.MYSQL_SERVER_DATABASE,
    });

    try {
        console.log('Attempting insert into tblRelacionArticulosFacturas...');
        const [res] = await connection.query(
            'INSERT INTO tblRelacionArticulosFacturas (CodigoInterno, IdProveedor, Descripcion, NoIdentificacion, FechaAct) VALUES (?, ?, ?, ?, NOW())',
            [9999, 9999, "TEST_DESC", "TEST_IDENT"]
        );
        console.log('Insert res:', res);
        
        const [rows] = await connection.query('SELECT * FROM tblRelacionArticulosFacturas WHERE IdProveedor = 9999');
        console.log('Query result:', rows);
        
        await connection.query('DELETE FROM tblRelacionArticulosFacturas WHERE IdProveedor = 9999');
        console.log('Cleanup done');
    } catch (e) {
        console.error('Test failed:', e);
    } finally {
        await connection.end();
    }
}

testInsert().catch(console.error);
