const db = require('./backend/src/config/database');

async function dropConstraint() {
    try {
        console.log('Connecting to DB to find check constraints on taxes table...');
        const res = await db.pool.query(`
            SELECT conname 
            FROM pg_constraint 
            WHERE conrelid = 'taxes'::regclass AND contype = 'c';
        `);

        console.log('Found Constraints:', res.rows);

        for (let row of res.rows) {
            console.log('Dropping constraint:', row.conname);
            await db.pool.query(`ALTER TABLE taxes DROP CONSTRAINT "${row.conname}";`);
        }

        console.log('All check constraints on taxes dropped successfully.');
    } catch (e) {
        console.error('Error:', e);
    } finally {
        process.exit(0);
    }
}

dropConstraint();
