const http = require('http');

const data = JSON.stringify({
    PalabraClave: 'Test Keyword ' + Date.now()
});

const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/system/ai-learning',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = http.request(options, (res) => {
    console.log(`Status Code: ${res.statusCode}`);
    res.on('data', (d) => {
        process.stdout.write(d);
    });
});

req.on('error', (error) => {
    console.error('Error:', error);
});

req.write(data);
req.end();
