require('dotenv').config();
const db = require('../src/config/database');

async function main() {
    try {
        console.log('Adding short_code column to room_types...');
        await db.query('ALTER TABLE room_types ADD COLUMN IF NOT EXISTS short_code VARCHAR(10);');
        console.log('Successfully added short_code column.');
    } catch (err) {
        console.error('Error adding column:', err);
    } finally {
        process.exit(0);
    }
}

main();
