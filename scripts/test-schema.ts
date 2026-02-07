import 'dotenv/config';
import { getSchema } from '../src/lib/db';

async function main() {
    console.log('Testing getSchema()...');
    try {
        const schema = await getSchema();
        console.log('Schema fetched successfully:');
        console.log(JSON.stringify(schema, null, 2));
    } catch (error) {
        console.error('Error fetching schema:', error);
    }
}

main();
