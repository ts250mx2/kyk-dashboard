const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

async function check() {
    const config = {
        host: process.env.MYSQL_SERVER_SERVER,
        user: process.env.MYSQL_SERVER_USER,
        password: process.env.MYSQL_SERVER_PASSWORD,
        database: process.env.MYSQL_SERVER_DATABASE,
    };
    
    console.log("Connecting to:", config.host, config.database);
    
    let connection;
    try {
        connection = await mysql.createConnection(config);
        
        const folio = '640427617';
        
        console.log(`\n--- Searching for Folio: ${folio} ---`);
        
        // Try all possible folio fields or IDs
        const [rowsC] = await connection.execute(
            "SELECT * FROM tblTransferenciasSalidas WHERE FolioSalida = ? OR IdTransferenciaSalida = ?", [folio, folio]
        );
        console.log("tblTransferenciasSalidas:", JSON.stringify(rowsC, null, 2));
        
        const [rowsH] = await connection.execute(
            "SELECT * FROM tblTransferenciasSalidasFacturas WHERE FolioSalida = ? OR IdTransferenciaSalida = ?", [folio, folio]
        );
        console.log("tblTransferenciasSalidasFacturas:", JSON.stringify(rowsH, null, 2));

        if (rowsC.length > 0) {
            const idTS = rowsC[0].IdTransferenciaSalida;
            console.log(`\n--- Searching by IdTransferenciaSalida: ${idTS} ---`);
            const [rowsH2] = await connection.execute(
                "SELECT * FROM tblTransferenciasSalidasFacturas WHERE IdTransferenciaSalida = ?", [idTS]
            );
             console.log("tblTransferenciasSalidasFacturas (by ID):", JSON.stringify(rowsH2, null, 2));
        }

    } catch (err) {
        console.error("Error:", err);
    } finally {
        if (connection) await connection.end();
    }
}

check();
