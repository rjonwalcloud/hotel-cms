require('dotenv').config();
const db = require('./src/config/database');

async function dropConstraint() {
    try {
        console.log('Connecting to DB to drop taxes_category_check constraint...');
        await db.pool.query('ALTER TABLE taxes DROP CONSTRAINT "taxes_category_check";');
        console.log('Constraint dropped successfully.');
    } catch (e) {
        if (e.message && e.message.includes('does not exist')) {
            console.log('Constraint already dropped or does not exist.');
        } else {
            console.error('Error:', e);
        }
    } finally {
        process.exit(0);
    }
}

dropConstraint();
