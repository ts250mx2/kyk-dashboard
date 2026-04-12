const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = mysql.createPool({
  host: process.env.MYSQL_SERVER_SERVER,
  user: process.env.MYSQL_SERVER_USER,
  password: process.env.MYSQL_SERVER_PASSWORD,
  database: process.env.MYSQL_SERVER_DATABASE,
  waitForConnections: true,
  connectionLimit: 1,
});

async function run() {
  try {
    console.log('--- Columns for tblProveedores ---');
    const [columns] = await pool.execute('DESCRIBE tblProveedores');
    console.log(JSON.stringify(columns, null, 2));

    console.log('\n--- Sample Row ---');
    const [rows] = await pool.execute('SELECT RFC, Proveedor FROM tblProveedores LIMIT 1');
    console.log(JSON.stringify(rows, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

run();
