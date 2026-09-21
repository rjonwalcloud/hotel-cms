const db = require('./backend/src/config/database');

async function fixFks() {
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        // Drop existing constraint if it exists (assuming it is called bookings_room_type_id_fkey)
        try {
            await client.query('ALTER TABLE bookings DROP CONSTRAINT bookings_room_type_id_fkey');
            console.log('Dropped bookings_room_type_id_fkey constraint');
        } catch (e) {
            console.log('Constraint bookings_room_type_id_fkey might not exist or already dropped.', e.message);
        }

        // Add new constraint with SET NULL
        await client.query(`
      ALTER TABLE bookings 
      ADD CONSTRAINT bookings_room_type_id_fkey 
      FOREIGN KEY (room_type_id) 
      REFERENCES room_types(id) 
      ON DELETE SET NULL
    `);
        console.log('Added new constraint with SET NULL');

        // Also check room_inventory foreign key
        try {
            await client.query('ALTER TABLE room_inventory DROP CONSTRAINT room_inventory_room_type_id_fkey');
            console.log('Dropped room_inventory_room_type_id_fkey constraint');
        } catch (e) {
        }

        await client.query(`
      ALTER TABLE room_inventory 
      ADD CONSTRAINT room_inventory_room_type_id_fkey 
      FOREIGN KEY (room_type_id) 
      REFERENCES room_types(id) 
      ON DELETE CASCADE
    `);
        console.log('Added room_inventory constraint with CASCADE');


        await client.query('COMMIT');
        console.log('Migration successful');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', e);
    } finally {
        client.release();
        db.pool.end();
    }
}

fixFks();
