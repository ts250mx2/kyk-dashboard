require('dotenv').config();
console.log('--- Environment Variables Check ---');
Object.keys(process.env).forEach(key => {
    if (key.includes('MYSQL') || key.includes('DB_')) {
        console.log(`${key}=${process.env[key]}`);
    }
});
console.log('-----------------------------------');
