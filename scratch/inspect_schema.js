const mysql = require('mysql2/promise');

async function main() {
  const connection = await mysql.createConnection({
    host: '192.168.1.207',
    user: 'kyk',
    password: 'merkurio',
    database: 'BDKYKRemoto'
  });

  try {
    console.log('--- Table Schema: tblRelacionArticulosFacturas ---');
    const [rows] = await connection.execute('SHOW CREATE TABLE tblRelacionArticulosFacturas');
    console.log(rows[0]['Create Table']);
    
    console.log('\n--- Sample Data (NULL/Empty NoIdentificacion) ---');
    const [data] = await connection.execute('SELECT * FROM tblRelacionArticulosFacturas WHERE NoIdentificacion = "" OR NoIdentificacion IS NULL LIMIT 10');
    console.table(data);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

main();
