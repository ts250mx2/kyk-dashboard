const mysql = require('mysql2/promise');

async function main() {
  const connection = await mysql.createConnection({
    host: '192.168.1.207',
    user: 'kyk',
    password: 'merkurio',
    database: 'BDCFDV40'
  });

  try {
    const [rows] = await connection.execute("SHOW TABLES LIKE 'tblComprobantesConceptosImpuestos%'");
    console.log('Tables:', rows);
    
    if (rows.length > 0) {
      const tableName = rows[0][Object.keys(rows[0])[0]];
      console.log(`\n--- Columns in ${tableName} ---`);
      const [cols] = await connection.execute(`DESCRIBE ${tableName}`);
      console.table(cols);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

main();
