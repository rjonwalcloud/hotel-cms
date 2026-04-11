const db = require('./src/config/database');

async function migrate() {
    try {
        console.log('Creating amenities table...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS amenities (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
                name VARCHAR(100) NOT NULL,
                icon VARCHAR(50),
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Amenities table ensured.');

        // Seed some default amenities for the primary hotel if none exist
        const defaultHotel = await db.query('SELECT id FROM hotels LIMIT 1');
        if (defaultHotel.rows.length > 0) {
            const hotelId = defaultHotel.rows[0].id;
            const existing = await db.query('SELECT count(*) FROM amenities WHERE hotel_id = $1', [hotelId]);
            if (parseInt(existing.rows[0].count) === 0) {
                console.log('Seeding default amenities...');
                await db.query(`
                    INSERT INTO amenities (hotel_id, name, icon, description) VALUES
                    ($1, 'WiFi', 'Wifi', 'High-speed wireless internet'),
                    ($1, 'TV', 'Tv', 'Flat-screen television with cable'),
                    ($1, 'AC', 'Wind', 'Air conditioning'),
                    ($1, 'Mini Fridge', 'Refrigerator', 'Miniature refrigerator for drinks & snacks'),
                    ($1, 'Room Service', 'Utensils', '24/7 in-room dining'),
                    ($1, 'Ocean View', 'Waves', 'Beautiful view of the ocean')
                `, [hotelId]);
                console.log('Default amenities seeded.');
            }
        }
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        db.pool.end();
        console.log('Done.');
    }
}

migrate();
