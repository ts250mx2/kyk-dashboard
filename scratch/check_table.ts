import pool from './src/lib/mysql';

async function checkTable() {
    try {
        const [rows]: any = await pool.query('DESCRIBE BDCFDV40.tblCompobantes');
        console.log('Columns in BDCFDV40.tblCompobantes:');
        rows.forEach((row: any) => console.log(`- ${row.Field} (${row.Type})`));
    } catch (err) {
        console.error('Error describing table:', err);
    } finally {
        process.exit();
    }
}

checkTable();
