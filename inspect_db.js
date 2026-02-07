const sql = require('mssql');

const config = {
    user: 'sa',
    password: 'Ve14$20rio',
    database: 'BDKYK',
    server: '192.168.1.20',
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

async function run() {
    try {
        console.log('--- DB INSPECTION START ---');
        await sql.connect(config);
        console.log('Connected!');

        console.log('\nColumns for tblPalabrasClave:');
        const cols = await sql.query`
            SELECT 
                c.name, 
                t.Name AS Type, 
                c.max_length, 
                c.is_nullable, 
                c.is_identity
            FROM 
                sys.columns c
            INNER JOIN 
                sys.types t ON c.user_type_id = t.user_type_id
            WHERE 
                c.object_id = OBJECT_ID('tblPalabrasClave')
        `;
        console.dir(cols.recordset, { depth: null });

        console.log('\nColumns for tblReglasPalabrasClave:');
        const ruleCols = await sql.query`
            SELECT 
                c.name, 
                t.Name AS Type, 
                c.max_length, 
                c.is_nullable, 
                c.is_identity
            FROM 
                sys.columns c
            INNER JOIN 
                sys.types t ON c.user_type_id = t.user_type_id
            WHERE 
                c.object_id = OBJECT_ID('tblReglasPalabrasClave')
        `;
        console.dir(ruleCols.recordset, { depth: null });

        console.log('\n--- DB INSPECTION END ---');
        process.exit(0);
    } catch (err) {
        console.error('ERROR:', err);
        process.exit(1);
    }
}

run();
