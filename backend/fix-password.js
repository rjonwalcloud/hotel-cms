const db = require('./src/config/database');
const bcrypt = require('bcrypt');

async function fixPasswordFinal() {
    try {
        console.log('==== FIXING ADMIN PASSWORD ====\n');

        // Use the pre-verified hash that was just generated and tested
        const correctHash = '$2b$10$y6FU0cVGwXBvO2hA7B987RqlPUz3PzwH2cjxaLb.9apO';
        console.log('Using pre-verified hash:', correctHash);

        // Update database    await db.query(
        'UPDATE users SET password_hash = $1 WHERE email = $2',
            [correctHash, 'admin@hotelcms.com']
    );
        console.log('✅ Database updated\n');

        // Verify from database
        const result = await db.query(
            'SELECT password_hash FROM users WHERE email = $1',
            ['admin@hotelcms.com']
        );

        const storedHash = result.rows[0].password_hash;
        console.log('Hash stored in DB:', storedHash);
        console.log('Hash length:', storedHash.length);

        const postVerify = await bcrypt.compare('Admin@123', storedHash);
        console.log('Post-save verification:', postVerify ? '✅ PASS' : '❌ FAIL');

        if (postVerify) {
            console.log('\n🎉 SUCCESS! Login should now work with:');
            console.log('   Email: admin@hotelcms.com');
            console.log('   Password: Admin@123');
        } else {
            console.log('\n❌ FAILURE! Hash in database is corrupted.');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

fixPasswordFinal();
