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
        console.log('--- Checking tblLogPreguntas columns ---');
        await sql.connect(config);
        const result = await sql.query`
            SELECT 
                c.name, 
                t.Name AS Type, 
                c.max_length, 
                c.is_nullable
            FROM 
                sys.columns c
            INNER JOIN 
                sys.types t ON c.user_type_id = t.user_type_id
            WHERE 
                c.object_id = OBJECT_ID('tblLogPreguntas')
        `;
        console.dir(result.recordset, { depth: null });
        process.exit(0);
    } catch (err) {
        console.error('ERROR:', err);
        process.exit(1);
    }
}

run();
