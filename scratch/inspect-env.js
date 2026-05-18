require('dotenv').config();

const vars = [
    'SQL_SERVER_DATABASE',
    'SAP_B1_DATABASE',
    'SAP_B1_SERVER'
];

console.log('--- Env Var Inspection ---');
vars.forEach(v => {
    const val = process.env[v];
    console.log(`${v}: [${val}] (length: ${val ? val.length : 0})`);
    if (val) {
        for (let i = 0; i < val.length; i++) {
            console.log(`  char ${i}: ${val[i]} (code: ${val.charCodeAt(i)})`);
        }
    }
});
console.log('-------------------------');
