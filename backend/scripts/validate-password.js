#!/usr/bin/env node

const db = require('../src/config/database');
const bcrypt = require('bcrypt');

const ADMIN_EMAIL = 'admin@hotelcms.com';
const ADMIN_PASSWORD = 'Admin@123';

async function validateAndFixPassword() {
    console.log('\n==============================================');
    console.log('🔐 PRE-STARTUP PASSWORD VALIDATION');
    console.log('==============================================\n');

    try {
        // Wait for database to be ready
        console.log('⏳ Waiting for database connection...');
        let retries = 10;
        while (retries > 0) {
            try {
                await db.query('SELECT 1');
                console.log('✅ Database connected\n');
                break;
            } catch (err) {
                retries--;
                if (retries === 0) throw err;
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        // Check if admin user exists
        console.log(`📋 Checking for admin user: ${ADMIN_EMAIL}`);
        const userResult = await db.query(
            'SELECT id, email, password_hash FROM users WHERE email = $1',
            [ADMIN_EMAIL]
        );

        if (userResult.rows.length === 0) {
            console.log('❌ Admin user not found in database');
            console.log('⚠️  Please ensure schema.sql has been loaded');
            process.exit(1);
        }

        const user = userResult.rows[0];
        console.log(`✅ Admin user found: ${user.email}`);
        console.log(`   Hash length: ${user.password_hash.length} characters\n`);

        // Test password hash
        console.log(`🔐 Testing password hash for "${ADMIN_PASSWORD}"...`);
        const isValid = await bcrypt.compare(ADMIN_PASSWORD, user.password_hash);

        if (isValid) {
            console.log('✅ Password hash is VALID\n');
            console.log('==============================================');
            console.log('✅ ALL VALIDATIONS PASSED - Starting server...');
            console.log('==============================================\n');
            process.exit(0);
        }

        // Password hash is invalid - fix it
        console.log('❌ Password hash is INVALID\n');
        console.log('🔧 Auto-fixing password hash...');

        // Generate new hash
        const newHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
        console.log(`   Generated new hash: ${newHash.substring(0, 20)}...`);

        // Verify new hash works
        const testVerify = await bcrypt.compare(ADMIN_PASSWORD, newHash);
        if (!testVerify) {
            console.log('❌ Generated hash verification failed!');
            process.exit(1);
        }
        console.log('   ✅ New hash verified\n');

        // Update database
        await db.query(
            'UPDATE users SET password_hash = $1 WHERE email = $2',
            [newHash, ADMIN_EMAIL]
        );
        console.log('✅ Database updated with correct hash');

        // Final verification
        const finalCheck = await db.query(
            'SELECT password_hash FROM users WHERE email = $1',
            [ADMIN_EMAIL]
        );
        const finalValid = await bcrypt.compare(ADMIN_PASSWORD, finalCheck.rows[0].password_hash);

        if (finalValid) {
            console.log('✅ Final verification: PASS\n');
            console.log('==============================================');
            console.log('✅ PASSWORD FIXED - Starting server...');
            console.log('==============================================\n');
            process.exit(0);
        } else {
            console.log('❌ Final verification: FAIL');
            console.log('⚠️  Critical error - cannot start server');
            process.exit(1);
        }

    } catch (error) {
        console.error('\n❌ VALIDATION ERROR:', error.message);
        console.error('⚠️  Cannot start server - fix the error and try again\n');
        process.exit(1);
    }
}

// Run validation
validateAndFixPassword();
