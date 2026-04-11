const db = require('./src/config/database');
const qrcodeService = require('./src/modules/qrcode/services/qrcode.service');

async function test() {
    try {
        const hotelId = '2a31309f-6825-45c1-90a6-987893a73c09'; // Example hotel ID from context or logs
        const requests = await qrcodeService.getServiceRequests(hotelId);
        console.log(`Found ${requests.length} requests`);
        requests.slice(0, 5).forEach(r => {
            console.log(`ID: ${r.id}, Status: ${r.status}, Room: ${r.room_number}, Guest: ${r.guest_name}`);
        });
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

test();
