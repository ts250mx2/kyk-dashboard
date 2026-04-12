import { mysqlQuery } from '../src/lib/mysql';

async function explore() {
    try {
        console.log('--- Exploring tblComprobantesXML ---');
        const columns = await mysqlQuery(`
            SELECT COLUMN_NAME, DATA_TYPE 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'tblComprobantesXML' 
            AND TABLE_SCHEMA = 'BDCFDV40'
        `);
        console.log('Columns:', JSON.stringify(columns, null, 2));

        console.log('\n--- Sample Row ---');
        const sample = await mysqlQuery(`
            SELECT TOP 1 * FROM BDCFDV40.tblComprobantesXML
        `);
        console.log('Sample Row:', JSON.stringify(sample, null, 2));
    } catch (error) {
        console.error('Error exploring DB:', error);
    }
}

explore();
