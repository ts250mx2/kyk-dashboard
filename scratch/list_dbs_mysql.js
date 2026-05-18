const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config();

async function test() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.MYSQL_SERVER_SERVER || '192.168.1.207',
            user: process.env.MYSQL_SERVER_USER || 'kyk',
            password: process.env.MYSQL_SERVER_PASSWORD || 'merkurio'
        });
        const [rows] = await connection.query("SHOW DATABASES");
        fs.writeFileSync('scratch/mysql_dbs.txt', JSON.stringify(rows.map(r => r.Database), null, 2));
        await connection.end();
    } catch (err) {
        fs.writeFileSync('scratch/mysql_dbs.txt', 'Error: ' + err.message);
    }
}

test();
