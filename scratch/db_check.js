const { mysqlQuery } = require('./src/lib/mysql');

async function check() {
    try {
        const columns = await mysqlQuery('DESCRIBE tblProveedores');
        console.log(JSON.stringify(columns, null, 2));
    } catch (e) {
        console.error(e);
    }
}

check();
