const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = mysql.createPool({
  host: process.env.MYSQL_SERVER_SERVER,
  user: process.env.MYSQL_SERVER_USER,
  password: process.env.MYSQL_SERVER_PASSWORD,
  database: 'BDCFDV40',
  waitForConnections: true,
  connectionLimit: 1,
});

async function run() {
  try {
    const uuid = '561549f4-1381-4392-b010-194d7264116f';
    const [rows] = await pool.execute('SELECT NoIdentificacion, Descripcion, Cantidad FROM tblComprobantesConceptos WHERE UUID = ?', [uuid]);
    console.log('--- Invoice Concepts for UUID: ' + uuid + ' ---');
    console.log(JSON.stringify(rows.slice(0, 3), null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

run();
