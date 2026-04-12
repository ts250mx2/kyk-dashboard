const mysql = require('mysql2/promise');

async function main() {
  const connection = await mysql.createConnection({
    host: '192.168.1.207',
    user: 'kyk',
    password: 'merkurio',
    database: 'BDKYKRemoto'
  });

  try {
    console.log('--- Database Migration: tblRelacionArticulosFacturas ---');
    
    // 1. Drop existing keys
    console.log('Dropping existing unique index...');
    try { await connection.execute('ALTER TABLE tblRelacionArticulosFacturas DROP INDEX idx_unique_prov_ident'); } catch(e) { console.warn('Index not found or already dropped'); }
    
    console.log('Dropping existing primary key...');
    try { await connection.execute('ALTER TABLE tblRelacionArticulosFacturas DROP PRIMARY KEY'); } catch(e) { console.warn('PK not found or already dropped'); }

    // 2. Clear potential duplicates for the new PK (IdProveedor, Descripcion)
    // Actually, since we want ONLY ONE system item per concept per provider,
    // we should keep only the latest one.
    // For now, let's just try to set the PK. 
    // If it fails, I'll need to clean up.
    
    console.log('Adding new PRIMARY KEY (IdProveedor, Descripcion)...');
    await connection.execute('ALTER TABLE tblRelacionArticulosFacturas ADD PRIMARY KEY (IdProveedor, Descripcion)');

    console.log('Migration successful!');

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await connection.end();
  }
}

main();
