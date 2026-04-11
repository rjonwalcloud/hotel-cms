const db = require('./src/config/database');

async function testDate() {
    try {
        console.log('Testing DB Date...');
        const res = await db.pool.query('SELECT CURRENT_DATE, CURRENT_TIMESTAMP;');
        console.log('DB Date:', res.rows[0]);
    } catch (e) {
        console.error('Test failed:', e.message);
    } finally {
        process.exit(0);
    }
}
setTimeout(testDate, 2000);
