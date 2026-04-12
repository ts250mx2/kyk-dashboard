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
    const tableName = 'tblRelacionArticulosFactura';
    console.log('--- Checking table: ' + tableName + ' ---');
    
    // Check if table exists
    const [tables] = await pool.execute("SHOW TABLES LIKE ?", [tableName]);
    if (tables.length > 0) {
      const [columns] = await pool.execute('DESCRIBE ' + tableName);
      console.log('Table exists. Schema:');
      console.log(JSON.stringify(columns, null, 2));
    } else {
      console.log('Table DOES NOT exist.');
      console.log('Suggested SQL:');
      console.log(`
        CREATE TABLE tblRelacionArticulosFactura (
          IdRelacion INT AUTO_INCREMENT PRIMARY KEY,
          CodigoInterno VARCHAR(45) NOT NULL,
          IdProveedor INT NOT NULL,
          Descripcion VARCHAR(255),
          NoIdentificacion VARCHAR(45) NOT NULL,
          FechaAct DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

run();
