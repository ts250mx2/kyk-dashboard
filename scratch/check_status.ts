import { query } from './src/lib/db';

async function check() {
    try {
        const artStatus = await query('SELECT TOP 5 Status, COUNT(*) as Count FROM tblArticulos GROUP BY Status');
        const provStatus = await query('SELECT TOP 5 Status, COUNT(*) as Count FROM tblProveedores GROUP BY Status');
        console.log('Articulos Status:', artStatus);
        console.log('Proveedores Status:', provStatus);
    } catch (e) {
        console.error(e);
    }
}

check();
