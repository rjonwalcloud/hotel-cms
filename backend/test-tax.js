const db = require('./src/config/database');

async function testInsert() {
    try {
        console.log('Testing insert into taxes...');
        const res = await db.pool.query(`
            INSERT INTO taxes (hotel_id, name, category, rate, is_inclusive, is_active)
            VALUES (
                (SELECT id FROM hotels LIMIT 1),
                'Test Tax ' || extract(epoch from now()),
                'TESTING',
                10.00,
                false,
                false
            ) RETURNING *;
        `);
        console.log('Insert successful:', res.rows[0]);

        // Clean up
        await db.pool.query('DELETE FROM taxes WHERE id = $1', [res.rows[0].id]);
        console.log('Test record cleaned up.');
    } catch (e) {
        console.error('Insert failed:', e.message);
    } finally {
        process.exit(0);
    }
}
setTimeout(testInsert, 2000); // 2 second delay to ensure db connection initializes
