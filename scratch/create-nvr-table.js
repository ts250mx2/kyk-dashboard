const sql = require('mssql');
require('dotenv').config();

const config = {
    user: process.env.SQL_SERVER_USER || 'sa',
    password: (process.env.SQL_SERVER_PASSWORD || 'Ve14$20rio').replace(/\\(\$)/g, '$1'),
    database: process.env.SQL_SERVER_DATABASE || 'BDKYK',
    server: process.env.SQL_SERVER_SERVER || '192.168.1.20',
    options: { encrypt: false, trustServerCertificate: true },
    requestTimeout: 30000,
};

const DDL = `
IF OBJECT_ID('dbo.tblNVR', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.tblNVR (
        IdNVR        INT IDENTITY(1,1) NOT NULL,
        IdTienda     INT NOT NULL,
        Descripcion  NVARCHAR(255) NULL,
        IP           NVARCHAR(100) NULL,
        Usuario      NVARCHAR(100) NULL,
        Passwd       NVARCHAR(255) NULL,
        FechaAct     DATETIME NULL CONSTRAINT DF_tblNVR_FechaAct DEFAULT (GETDATE()),
        Status       INT NOT NULL CONSTRAINT DF_tblNVR_Status DEFAULT (0),
        CONSTRAINT PK_tblNVR PRIMARY KEY CLUSTERED (IdNVR),
        CONSTRAINT FK_tblNVR_tblTiendas FOREIGN KEY (IdTienda) REFERENCES dbo.tblTiendas(IdTienda)
    );
    PRINT 'tblNVR created';
END
ELSE
    PRINT 'tblNVR already exists';
`;

(async () => {
    try {
        const pool = await sql.connect(config);

        const cols = await pool.request().query(
            "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='tblTiendas' AND COLUMN_NAME IN ('IdTienda','Tienda','Status')"
        );
        console.log('tblTiendas relevant cols:', cols.recordset.map(r => r.COLUMN_NAME).join(', '));

        await pool.request().batch(DDL);

        const after = await pool.request().query(
            "SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='tblNVR' ORDER BY ORDINAL_POSITION"
        );
        console.log('tblNVR columns:');
        after.recordset.forEach(r => console.log(`  ${r.COLUMN_NAME} ${r.DATA_TYPE} ${r.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'}`));

        await sql.close();
        console.log('Done.');
    } catch (e) {
        console.error('ERR:', e.message);
        process.exit(1);
    }
})();
