import { mysqlQuery } from '../src/lib/mysql.js';

async function check() {
    try {
        const columns = await mysqlQuery('DESCRIBE tblProveedores');
        console.log(JSON.stringify(columns, null, 2));
    } catch (e) {
        console.error(e);
    }
}

check();
