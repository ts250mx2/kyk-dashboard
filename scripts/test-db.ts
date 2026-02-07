import 'dotenv/config';
import { getSchema } from '../src/lib/db';

async function testConnection() {
    console.log('Testing database connection...');
    try {
        const schema = await getSchema();
        console.log('Successfully connected to database!');
        console.log('Schema retrieved:', JSON.stringify(schema, null, 2));

        if (Object.keys(schema).length === 0) {
            console.warn('Warning: No tables found in the database.');
        }
    } catch (error) {
        console.error('Failed to connect to database:', error);
        process.exit(1);
    }
}

testConnection();
