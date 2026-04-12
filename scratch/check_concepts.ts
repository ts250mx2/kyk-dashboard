import pool from './src/lib/mysql';

async function checkConcepts() {
    try {
        const [rows]: any = await pool.query('DESCRIBE BDCFDV40.tblComprobantesConceptos');
        console.log('Columns in BDCFDV40.tblComprobantesConceptos:');
        rows.forEach((row: any) => console.log(`- ${row.Field} (${row.Type})`));
    } catch (err) {
        console.error('Error describing table:', err);
    } finally {
        process.exit();
    }
}

checkConcepts();
