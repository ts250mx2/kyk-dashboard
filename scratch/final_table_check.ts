const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = mysql.createPool({
  host: process.env.MYSQL_SERVER_SERVER,
  user: process.env.MYSQL_SERVER_USER,
  password: process.env.MYSQL_SERVER_PASSWORD,
  database: process.env.MYSQL_SERVER_DATABASE,
});

async function run() {
  try {
    const tableName = 'tblRelacionArticulosFacturas';
    const [rows] = await pool.execute("SHOW TABLES LIKE ?", [tableName]);
    if (rows.length > 0) {
      console.log('--- Table EXISTS: ' + tableName + ' ---');
      const [cols] = await pool.execute("DESCRIBE " + tableName);
      console.log(JSON.stringify(cols, null, 2));
    } else {
      console.log('--- Table DOES NOT EXIST: ' + tableName + ' ---');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

run();
