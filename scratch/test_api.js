async function test() {
    try {
        const res = await fetch('http://localhost:3001/api/stores');
        const data = await res.json();
        console.log('Status:', res.status);
        console.log('Data:', JSON.stringify(data));
    } catch (e) {
        console.error('Error:', e);
    }
}

test();
