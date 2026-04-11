const http = require('http');

http.get('http://localhost:5000/health', (res) => {
    console.log('Status Code:', res.statusCode);
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log('Response:', data));
}).on('error', err => console.error('Error:', err.message));
