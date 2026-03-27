import { mysqlQuery } from './src/lib/mysql.js';

async function checkSchema() {
    try {
        console.log("--- tblTransferenciasSalidas ---");
        const colsC = await mysqlQuery("SHOW COLUMNS FROM tblTransferenciasSalidas");
        console.log(JSON.stringify(colsC, null, 2));

        console.log("\n--- tblTransferenciasSalidasFacturas ---");
        const colsH = await mysqlQuery("SHOW COLUMNS FROM tblTransferenciasSalidasFacturas");
        console.log(JSON.stringify(colsH, null, 2));

        console.log("\n--- Checking distribution #640427617 ---");
        const dist = await mysqlQuery(`
            SELECT * FROM tblTransferenciasSalidas 
            WHERE FolioSalida = '640427617' 
               OR IdTransferenciaSalida = '640427617'
        `);
        console.log("From tblTransferenciasSalidas:");
        console.log(JSON.stringify(dist, null, 2));

        const distFact = await mysqlQuery(`
            SELECT * FROM tblTransferenciasSalidasFacturas
            WHERE FolioSalida = '640427617'
               OR IdTransferenciaSalida = '640427617'
        `);
        console.log("\nFrom tblTransferenciasSalidasFacturas:");
        console.log(JSON.stringify(distFact, null, 2));

    } catch (e) {
        console.error(e);
    }
}

checkSchema();
