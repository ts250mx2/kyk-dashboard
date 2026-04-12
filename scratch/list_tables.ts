import pool from './src/lib/mysql';

async function listTables() {
    try {
        const [rows]: any = await pool.query('SHOW TABLES FROM BDCFDV40');
        console.log('Tables in BDCFDV40:');
        rows.forEach((row: any) => console.log(`- ${Object.values(row)[0]}`));
    } catch (err) {
        console.error('Error listing tables:', err);
    } finally {
        process.exit();
    }
}

listTables();
