const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = mysql.createPool({
  host: process.env.MYSQL_SERVER_SERVER,
  user: process.env.MYSQL_SERVER_USER,
  password: process.env.MYSQL_SERVER_PASSWORD,
  database: 'BDCFDV40', // Explicitly use the database prefix if needed, or just connect
  waitForConnections: true,
  connectionLimit: 1,
});

async function run() {
  try {
    console.log('--- Columns for tblComprobantesXML ---');
    const [columns] = await pool.execute('DESCRIBE tblComprobantesXML');
    console.log(JSON.stringify(columns, null, 2));

    console.log('\n--- Sample Row ---');
    const [rows] = await pool.execute('SELECT UUID, LEFT(XMLTexto, 100) as XML_Start FROM tblComprobantesXML LIMIT 1');
    console.log(JSON.stringify(rows, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

run();
