const db = require('./src/config/database');

async function test() {
    try {
        const token = 'ANY_TOKEN'; // We just want to see if it executes without syntax error
        const query = `
            SELECT qr.*, r.room_number, r.floor, r.status as room_status,
                   h.name as hotel_name, h.id as hotel_id, h.phone as hotel_phone,
                   h.email as hotel_email, h.address as hotel_address,
                   hs.currency_code, hs.currency_symbol
            FROM room_qr_codes qr
            JOIN rooms r ON r.id = qr.room_id
            JOIN hotels h ON h.id = qr.hotel_id
            LEFT JOIN hotel_settings hs ON hs.hotel_id = h.id
            WHERE qr.qr_token = $1 AND qr.is_active = true
        `;
        await db.query(query, [token]);
        console.log('Query executed successfully (no syntax errors)');
        process.exit(0);
    } catch (error) {
        console.error('SQL ERROR:', error.message);
        process.exit(1);
    }
}

test();
