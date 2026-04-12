const mysql = require('mysql2/promise');

async function main() {
  const connection = await mysql.createConnection({
    host: '192.168.1.207',
    user: 'kyk',
    password: 'merkurio',
    database: 'BDCFDV40'
  });

  try {
    console.log('--- Tables in BDCFDV40 ---');
    const [rows] = await connection.execute('SHOW TABLES');
    console.table(rows);
    
    // Check Conceptos table specifically
    console.log('\n--- Columns in tblComprobantesConceptos ---');
    const [cols] = await connection.execute('DESCRIBE tblComprobantesConceptos');
    console.table(cols);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

main();
