const http = require('http');

const data = JSON.stringify({
    company_name: "Test Corp",
    guest_name: 'John Doe',
    guest_email: 'john@test.com',
    guest_phone: '1234567890',
    event_details: 'Test',
    additional_requirements: 'None',
    check_in_date: '2024-05-01',
    check_out_date: '2024-05-02',
    adults: 4,
    children: 0,
    rooms: [
        { room_type_id: "d3fc154a-fd48-43b2-9a80-a3e6d79d5a69", quantity: 1 }
    ]
});

const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/bulk-bookings/hotel/eaf8e24c-1d0b-478a-a664-9be89f41de14',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'Authorization': 'Bearer mock' // Auth middleware handles this?
    }
};

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    res.setEncoding('utf8');
    let rawData = '';
    res.on('data', (chunk) => { rawData += chunk; });
    res.on('end', () => {
        console.log(`BODY: ${rawData}`);
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.write(data);
req.end();
