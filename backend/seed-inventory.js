require('dotenv').config();
const db = require('./src/config/database');

async function seedInventory() {
    try {
        console.log('🌱 Seeding room inventory for the next 30 days...');

        // This query finds all room types across all hotels and gives them 5 available rooms per day for the next 30 days.
        const query = `
            INSERT INTO room_inventory (hotel_id, room_type_id, inventory_date, total_inventory, booked_count) 
            SELECT hotel_id, id, CURRENT_DATE + i, 5, 0 
            FROM room_types 
            CROSS JOIN generate_series(0, 30) i 
            ON CONFLICT (hotel_id, room_type_id, inventory_date) 
            DO UPDATE SET total_inventory = excluded.total_inventory;
        `;

        await db.query(query);
        console.log(`✅ Successfully seeded inventory logic! Your rooms are now available to book.`);
        process.exit(0);
    } catch (err) {
        console.error('❌ Error seeding inventory:', err);
        process.exit(1);
    }
}

seedInventory();
