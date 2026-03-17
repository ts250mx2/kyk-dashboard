const { query } = require('./src/lib/db');
require('dotenv').config();

async function main() {
    try {
        const results = await query('SELECT TOP 1 * FROM tblTiendas');
        console.log(JSON.stringify(results, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

main();
