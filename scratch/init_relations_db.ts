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
    console.log('--- Database Initialization (v3) ---');
    
    // 1. Create the table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS tblRelacionArticulosFacturas (
        IdRelacion INT AUTO_INCREMENT PRIMARY KEY,
        CodigoInterno VARCHAR(45) NOT NULL,
        IdProveedor INT NOT NULL,
        Descripcion VARCHAR(255),
        NoIdentificacion VARCHAR(45) NOT NULL,
        FechaAct DATETIME
      )
    `);
    console.log('v Table tblRelacionArticulosFacturas ready.');

    // 2. Clean up any invalid data that might block index creation
    await pool.execute("DELETE FROM tblRelacionArticulosFacturas WHERE NoIdentificacion IS NULL OR NoIdentificacion = ''");
    console.log('v Cleaned up invalid rows.');

    // 3. Add Unique Index if it doesn't exist
    try {
        await pool.execute(`
            CREATE UNIQUE INDEX idx_unique_prov_ident 
            ON tblRelacionArticulosFacturas (IdProveedor, NoIdentificacion)
        `);
        console.log('v Unique index added.');
    } catch (e) {
        if (e.code === 'ER_DUP_KEYNAME' || e.errno === 1061) {
            console.log('v Unique index already exists.');
        } else if (e.code === 'ER_DUP_ENTRY' || e.errno === 1062) {
             console.log('! Duplicate entries found. Truncating for clean start...');
             await pool.execute("TRUNCATE TABLE tblRelacionArticulosFacturas");
             await pool.execute(`
                CREATE UNIQUE INDEX idx_unique_prov_ident 
                ON tblRelacionArticulosFacturas (IdProveedor, NoIdentificacion)
             `);
             console.log('v Table truncated and unique index added.');
        } else {
            throw e;
        }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

run();
