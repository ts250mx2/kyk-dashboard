import sql from 'mssql';

const user = process.env.SAP_B1_USER;
const password = process.env.SAP_B1_PASSWORD;
const database = process.env.SAP_B1_DATABASE;
const server = process.env.SAP_B1_SERVER;

if (!user || !password || !database || !server) {
    console.warn('SAP B1 environment variables missing. SAP queries will fail.');
}

const sqlConfig: sql.config = {
    user: user || '',
    password: password || '',
    database: database || '',
    server: server || '',
    pool: {
        max: 5,
        min: 0,
        idleTimeoutMillis: 30000
    },
    options: {
        encrypt: false,
        trustServerCertificate: true,
        useUTC: false
    },
    requestTimeout: 90000 // 90 seconds for larger SAP queries
};

let pool: sql.ConnectionPool | null = null;

export async function getSapPool() {
    if (pool) return pool;
    try {
        pool = await new sql.ConnectionPool(sqlConfig).connect();
        return pool;
    } catch (err) {
        console.error('SAP B1 Database Connection Failed! ', err);
        throw err;
    }
}

export async function sapQuery(queryString: string, params: (string | number | boolean | Date | null | undefined)[] = []) {
    try {
        const pool = await getSapPool();
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
        console.error('SAP B1 Database Error:', error);
        throw new Error('Failed to execute SAP query ' + error);
    }
}
