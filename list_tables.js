const { query } = require('./src/lib/db');

async function listTables() {
    try {
        const res = await query("SELECT name FROM sys.tables ORDER BY name");
        console.log('--- TABLES ---');
        res.forEach(r => console.log(r.name));
        console.log('--------------');
    } catch (e) {
        console.log('Error:', e.message);
    }
    process.exit(0);
}

listTables();
