import { mysqlQuery } from '../src/lib/mysql.js';

async function audit() {
    try {
        console.log("--- RELATIONS TABLE ---");
        const relations = await mysqlQuery('SELECT * FROM tblRelacionArticulosFacturas LIMIT 10');
        console.log("Sample relations:", JSON.stringify(relations, null, 2));

        if (Array.isArray(relations) && relations.length > 0) {
            const rel = relations[0];
            console.log(`\nVerifying relation for CodigoInterno: ${rel.CodigoInterno}, IdProveedor: ${rel.IdProveedor}`);
            
            const prov = await mysqlQuery('SELECT IdProveedor, Proveedor, RFC FROM tblProveedores WHERE IdProveedor = ?', [rel.IdProveedor]);
            console.log("Provider in DB:", prov);

            const art = await mysqlQuery('SELECT CodigoInterno, Descripcion, CodigoBarras FROM tblArticulosSAP WHERE CodigoInterno = ?', [rel.CodigoInterno]);
            console.log("Article in DB:", art);
        }

        console.log("\n--- RECENT RECEIPTS ---");
        const receipts = await mysqlQuery(`
            SELECT A.IdReciboMovil, A.IdProveedor, B.Proveedor, A.UUID 
            FROM tblReciboMovil A 
            INNER JOIN tblProveedores B ON A.IdProveedor = B.IdProveedor 
            ORDER BY A.FechaRecibo DESC LIMIT 5
        `);
        console.log("Recent receipts:", receipts);

    } catch (e) {
        console.error(e);
    }
}

audit();
