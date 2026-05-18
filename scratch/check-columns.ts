require('dotenv').config({path: '.env.local'});
import { query } from '../src/lib/db.ts';

async function check() {
    try {
        const viewDef = await query("SELECT OBJECT_DEFINITION(OBJECT_ID('Cortes')) AS definition");
        console.log("Cortes View Definition:");
        console.log(viewDef[0].definition);
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
}
check();
