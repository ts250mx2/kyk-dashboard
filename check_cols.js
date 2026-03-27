const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

async function check() {
    const config = {
        host: process.env.MYSQL_SERVER_SERVER,
        user: process.env.MYSQL_SERVER_USER,
        password: process.env.MYSQL_SERVER_PASSWORD,
        database: process.env.MYSQL_SERVER_DATABASE,
    };
    
    let connection;
    try {
        connection = await mysql.createConnection(config);
        
        console.log("--- tblTransferenciasSalidas Columns ---");
        const [colsC] = await connection.execute("SHOW COLUMNS FROM tblTransferenciasSalidas");
        console.log(colsC.map(c => c.Field).join(', '));

        console.log("\n--- tblTransferenciasSalidasFacturas Columns ---");
        const [colsH] = await connection.execute("SHOW COLUMNS FROM tblTransferenciasSalidasFacturas");
        console.log(colsH.map(c => c.Field).join(', '));

    } catch (err) {
        console.error("Error:", err);
    } finally {
        if (connection) await connection.end();
    }
}

check();
