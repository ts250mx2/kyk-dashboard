import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.MYSQL_SERVER_SERVER,
  user: process.env.MYSQL_SERVER_USER,
  password: process.env.MYSQL_SERVER_PASSWORD,
  database: process.env.MYSQL_SERVER_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
});

export async function mysqlQuery(sql: string, params?: any[], retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const [rows] = await pool.execute(sql, params);
      return rows;
    } catch (error: any) {
      const isTransient = error.code === 'ECONNRESET' || 
                         error.code === 'PROTOCOL_CONNECTION_LOST' || 
                         error.code === 'ETIMEDOUT' ||
                         error.code === 'ENOTFOUND' ||
                         error.code === 'ECONNREFUSED';
      
      if (isTransient && i < retries - 1) {
        console.warn(`MySQL Query Attempt ${i + 1} failed (error: ${error.code}), retrying in ${1000 * (i + 1)}ms...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); 
        continue;
      }
      console.error('MySQL Query Error:', error);
      throw error;
    }
  }
}

export default pool;
