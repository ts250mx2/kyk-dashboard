import sql from 'mssql';

const user = 'sa';//process.env.SQL_SERVER_USER;
const password = 'Ve14$20rio';//process.env.SQL_SERVER_PASSWORD;
const database = 'BDKYK';//process.env.SQL_SERVER_DATABASE;
const server = '192.168.1.20';// process.env.SQL_SERVER_SERVER || '192.168.1.20';

if (!user || !password || !database) {
    throw new Error('Missing required database environment variables (SQL_SERVER_USER, SQL_SERVER_PASSWORD, SQL_SERVER_DATABASE)');
}

const sqlConfig: sql.config = {
    user,
    password,
    database,
    server,
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    },
    options: {
        encrypt: false, // Set to false for local dev with IP addresses to avoid TLS SNI errors
        trustServerCertificate: true
    },
    requestTimeout: 20000 // 20 seconds timeout for queries
};

let pool: sql.ConnectionPool | null = null;

export async function getPool() {
    if (pool) return pool;
    try {
        pool = await sql.connect(sqlConfig);
        return pool;
    } catch (err) {
        console.error('Database Connection Failed! Bad Config: ', err);
        throw err;
    }
}

export async function query(queryString: string, params: (string | number | boolean | Date | null | undefined)[] = []) {
    try {
        const pool = await getPool();
        const request = pool.request();

        // Bind parameters
        params.forEach((param, index) => {
            request.input(`p${index}`, param);
        });

        // Replace ? with @p0, @p1, etc.
        let paramIndex = 0;
        const convertedQuery = queryString.replace(/\?/g, () => {
            return `@p${paramIndex++}`;
        });

        const result = await request.query(convertedQuery);
        return result.recordset;
    } catch (error) {
        console.error('Database Error:', error);
        throw new Error('Failed to execute query ' + error);
    }
}

export async function getSchema() {
    try {
        const columnsQuery = `
            SELECT 
                TABLE_NAME, 
                COLUMN_NAME, 
                DATA_TYPE 
            FROM 
                INFORMATION_SCHEMA.COLUMNS 
            WHERE 
                TABLE_CATALOG = @p0
            ORDER BY 
                TABLE_NAME, ORDINAL_POSITION
        `;

        const fkQuery = `
            SELECT 
                tp.name AS ParentTable,
                cp.name AS ParentColumn,
                tr.name AS ReferencedTable,
                cr.name AS ReferencedColumn
            FROM 
                sys.foreign_keys AS fk
            INNER JOIN 
                sys.tables AS tp ON fk.parent_object_id = tp.object_id
            INNER JOIN 
                sys.tables AS tr ON fk.referenced_object_id = tr.object_id
            INNER JOIN 
                sys.foreign_key_columns AS fkc ON fk.object_id = fkc.constraint_object_id
            INNER JOIN 
                sys.columns AS cp ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
            INNER JOIN 
                sys.columns AS cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
        `;

        const [columnsResult, fkResult] = await Promise.all([
            query(columnsQuery, [process.env.SQL_SERVER_DATABASE]),
            query(fkQuery)
        ]);

        // Group columns by table
        const tables: Record<string, string[]> = {};
        (columnsResult as { TABLE_NAME: string; COLUMN_NAME: string; DATA_TYPE: string }[]).forEach((row) => {
            if (!tables[row.TABLE_NAME]) {
                tables[row.TABLE_NAME] = [];
            }
            tables[row.TABLE_NAME].push(`${row.COLUMN_NAME} (${row.DATA_TYPE})`);
        });

        // Format Foreign Keys
        const foreignKeys = (fkResult as { ParentTable: string; ParentColumn: string; ReferencedTable: string; ReferencedColumn: string }[]).map(row =>
            `${row.ParentTable}.${row.ParentColumn} -> ${row.ReferencedTable}.${row.ReferencedColumn}`
        );

        // Add manual relationships
        foreignKeys.push('tblDetalleVentas (IdVenta, IdComputadora, IdTienda) -> tblVentas (IdVenta, IdComputadora, IdTienda)');

        return { tables, foreignKeys };
    } catch (error) {
        console.error('Schema Error:', error);
        return { tables: {}, foreignKeys: [] };
    }
}
