import { query } from './src/lib/db';

async function checkSchema() {
    try {
        console.log('Checking schema for tblPalabrasClave...');
        const results = await query(`
            SELECT 
                COLUMN_NAME, 
                DATA_TYPE, 
                IS_NULLABLE, 
                COLUMN_DEFAULT
            FROM 
                INFORMATION_SCHEMA.COLUMNS 
            WHERE 
                TABLE_NAME = 'tblPalabrasClave'
        `);
        console.log(JSON.stringify(results, null, 2));

        console.log('\nChecking current data...');
        const data = await query('SELECT * FROM tblPalabrasClave');
        console.log(JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error:', error);
    }
}

checkSchema();
