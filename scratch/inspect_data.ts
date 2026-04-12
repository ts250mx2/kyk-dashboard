import { mysqlQuery } from '../src/lib/mysql.js';

async function inspect() {
    try {
        console.log("--- TABLE SCHEMAS ---");
        const provCols = await mysqlQuery('DESCRIBE tblProveedores');
        console.log("tblProveedores columns:", provCols.map(c => c.Field).join(', '));
        
        const recCols = await mysqlQuery('DESCRIBE tblReciboMovil');
        console.log("tblReciboMovil columns:", recCols.map(c => c.Field).join(', '));

        console.log("\n--- SAMPLE DATA ---");
        const sampleRec = await mysqlQuery('SELECT IdReciboMovil, UUID, IdProveedor FROM tblReciboMovil WHERE UUID IS NOT NULL AND UUID != "" LIMIT 1');
        console.log("Sample Receipt:", sampleRec);

        if (sampleRec.length > 0) {
            const sampleProv = await mysqlQuery('SELECT * FROM tblProveedores WHERE IdProveedor = ?', [sampleRec[0].IdProveedor]);
            console.log("Sample Provider for Receipt:", sampleProv);
        }

        const sampleOrder = await mysqlQuery('SELECT IdOrdenCompra, IdProveedor, IdReciboMovil FROM tblOrdenesCompra WHERE IdReciboMovil IS NOT NULL LIMIT 1');
        console.log("Sample Order:", sampleOrder);

    } catch (e) {
        console.error(e);
    }
}

inspect();
