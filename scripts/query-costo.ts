import { query } from '../src/lib/db';

async function main() {
    try {
        console.log("Checking columns for tblExistencias...");
        const cols = await query("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'tblExistencias'") as any[];
        console.log("tblExistencias columns:", cols.map(c => `${c.COLUMN_NAME} (${c.DATA_TYPE})`).join(', '));
    } catch (err) {
        console.error("Error executing database query:", err);
    }
}
main();
