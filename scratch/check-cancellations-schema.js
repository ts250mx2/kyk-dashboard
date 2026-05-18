const { query } = require('./src/lib/db');

async function checkSchema() {
    try {
        const res = await query("SELECT TOP 1 * FROM tblCancelaciones");
        console.log("Columns in tblCancelaciones:", Object.keys(res[0]));
    } catch (err) {
        console.error("Error checking schema:", err);
    }
}

checkSchema();
