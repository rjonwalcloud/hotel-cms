const db = require('./src/config/database');
const roomTypeService = require('./src/modules/room/services/room-type.service');

async function testSync() {
    try {
        console.log('Testing syncInventory...');

        // get first hotel id
        const hotelQuery = await db.pool.query('SELECT id FROM hotels LIMIT 1');
        if (hotelQuery.rows.length === 0) {
            console.log('No hotel found');
            return;
        }

        const hotelId = hotelQuery.rows[0].id;

        // print current inventory
        const before = await db.pool.query('SELECT total_inventory, booked_count, inventory_date FROM room_inventory WHERE hotel_id = $1 LIMIT 5', [hotelId]);
        console.log('Before sync:', before.rows);

        const count = await roomTypeService.syncInventory(hotelId, 30);
        console.log(`Synced ${count} rows`);

        const after = await db.pool.query('SELECT total_inventory, booked_count, inventory_date FROM room_inventory WHERE hotel_id = $1 LIMIT 5', [hotelId]);
        console.log('After sync:', after.rows);

    } catch (e) {
        console.error('Test failed:', e.message);
    } finally {
        process.exit(0);
    }
}
setTimeout(testSync, 2000);
