const db = require('./backend/src/config/database');

async function dropConstraint() {
    try {
        console.log('Connecting to DB to drop constraint...');
        await db.pool.query('ALTER TABLE taxes DROP CONSTRAINT IF EXISTS taxes_category_check;');
        console.log('Constraint dropped successfully.');
    } catch (e) {
        console.error('Error:', e);
    } finally {
        process.exit(0);
    }
}

dropConstraint();
