
const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkTypes() {
    const connection = await mysql.createConnection({
        host: process.env.MYSQL_SERVER_SERVER,
        user: process.env.MYSQL_SERVER_USER,
        password: process.env.MYSQL_SERVER_PASSWORD,
        database: process.env.MYSQL_SERVER_DATABASE,
    });

    const [cols] = await connection.query('DESCRIBE tblRelacionArticulosFacturas');
    console.log('tblRelacionArticulosFacturas columns:', cols);
    
    await connection.end();
}

checkTypes().catch(console.error);
