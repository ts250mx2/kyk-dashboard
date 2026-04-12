import pool from './src/lib/mysql';

async function sampleRecord() {
    try {
        const [rows]: any = await pool.query('SELECT * FROM BDCFDV40.tblComprobantesConceptos LIMIT 1');
        if (rows.length > 0) {
            console.log('Columns found in tblComprobantesConceptos:');
            console.log(Object.keys(rows[0]));
        } else {
            console.log('No records found in tblComprobantesConceptos');
        }
    } catch (err) {
        console.error('Error fetching sample record:', err);
    } finally {
        process.exit();
    }
}

sampleRecord();
