const { query } = require('./src/lib/db');

async function check() {
    const fecha = new Date().toISOString().split('T')[0];
    const startStr = `'${fecha} 00:00:00'`;
    const endStr = `'${fecha} 23:59:59'`;

    const tests = [
        { name: 'Stores', sql: `SELECT TOP 1 * FROM tblTiendas` },
        { name: 'Aperturas', sql: `SELECT TOP 1 * FROM tblAperturasCierres` },
        { name: 'Ventas', sql: `SELECT TOP 1 * FROM tblVentas` },
        { name: 'Cancelaciones', sql: `SELECT TOP 1 * FROM Cancelaciones` },
        { name: 'Facturas', sql: `SELECT TOP 1 * FROM tblFacturas` },
        { name: 'Cortes', sql: `SELECT TOP 1 * FROM tblAperturasCierres WHERE FechaCierre IS NOT NULL` }
    ];

    for (const test of tests) {
        try {
            const res = await query(test.sql);
            console.log(`✅ ${test.name}: Success (${res.length} rows)`);
        } catch (e) {
            console.log(`❌ ${test.name}: Failed - ${e.message}`);
        }
    }
    process.exit(0);
}

check();
