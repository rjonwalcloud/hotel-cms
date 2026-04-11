const db = require('./src/config/database');
const bulkBookingService = require('./src/modules/booking/services/bulk-booking.service');

async function testBulkBooking() {
    try {
        console.log('--- Starting Bulk Booking Test ---');

        // 1. Get default hotel and user and room types
        const hotelRes = await db.pool.query('SELECT id FROM hotels LIMIT 1');
        const userRes = await db.pool.query('SELECT id FROM users LIMIT 1');
        const roomTypeRes = await db.pool.query('SELECT id, name, base_price FROM room_types LIMIT 2');

        if (hotelRes.rows.length === 0 || roomTypeRes.rows.length < 2) {
            console.log('Not enough data to run test. Exiting.');
            process.exit(0);
        }

        const hotelId = hotelRes.rows[0].id;
        const userId = userRes.rows[0].id;
        const roomType1 = roomTypeRes.rows[0];
        const roomType2 = roomTypeRes.rows[1];

        // Check inventory before
        const checkIn = new Date().toISOString().split('T')[0];
        const checkOut = new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0]; // +2 days

        const invBefore = await db.pool.query(
            `SELECT room_type_id, total_inventory, booked_count FROM room_inventory 
       WHERE hotel_id = $1 AND inventory_date = $2 AND room_type_id IN ($3, $4)`,
            [hotelId, checkIn, roomType1.id, roomType2.id]
        );
        console.log('Inventory Before:', invBefore.rows);

        // 2. Create Bulk Booking
        const bulkData = {
            company_name: 'Test Corp',
            guest_name: 'John Doe',
            guest_email: 'john@test.com',
            guest_phone: '1234567890',
            event_details: 'Test Event',
            additional_requirements: 'None',
            check_in_date: checkIn,
            check_out_date: checkOut,
            adults: 4,
            children: 0,
            rooms: [
                { room_type_id: roomType1.id, quantity: 1 },
                { room_type_id: roomType2.id, quantity: 1 }
            ]
        };

        console.log('Creating Bulk Booking mapping 3 rooms across 2 types...');
        const result = await bulkBookingService.createBulkBooking(bulkData, userId, hotelId);

        console.log('✅ Bulk Booking Created:', result.bulkBooking.id, '| Total Amount:', result.bulkBooking.total_amount);
        console.log('✅ Child Bookings Generated:', result.childBookings.length);

        // 3. Verify Database
        const invAfter = await db.pool.query(
            `SELECT room_type_id, total_inventory, booked_count FROM room_inventory 
       WHERE hotel_id = $1 AND inventory_date = $2 AND room_type_id IN ($3, $4)`,
            [hotelId, checkIn, roomType1.id, roomType2.id]
        );
        console.log('Inventory After:', invAfter.rows);

        // Assert Inventory
        const r1Before = invBefore.rows.find(r => r.room_type_id === roomType1.id)?.booked_count || 0;
        const r1After = invAfter.rows.find(r => r.room_type_id === roomType1.id)?.booked_count || 0;
        if (r1After - r1Before !== 1) throw new Error(`Inventory math failed for RT1! Before: ${r1Before}, After: ${r1After}`);

        const r2Before = invBefore.rows.find(r => r.room_type_id === roomType2.id)?.booked_count || 0;
        const r2After = invAfter.rows.find(r => r.room_type_id === roomType2.id)?.booked_count || 0;
        if (r2After - r2Before !== 1) throw new Error(`Inventory math failed for RT2! Before: ${r2Before}, After: ${r2After}`);

        console.log('✅ Inventory Math Decremented Correctly!');

        // Clean up
        await db.pool.query('DELETE FROM bulk_bookings WHERE id = $1', [result.bulkBooking.id]);
        console.log('✅ Cleanup successful');

    } catch (error) {
        require('fs').writeFileSync('err.txt', error.stack || error.toString());
        console.error('❌ Test failed. See err.txt for details.');
    } finally {
        process.exit(0);
    }
}

testBulkBooking();
