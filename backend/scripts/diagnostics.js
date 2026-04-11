require('dotenv').config();
const { Pool } = require('pg');

async function runDiagnostics() {
    console.log('🔍 Starting Render Diagnostics...');

    // Check Environment Variables
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.warn('⚠️ DATABASE_URL is not set. Assuming local DB or DB_HOST config.');
    }

    // Database Connection
    const pool = new Pool(dbUrl ? {
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false }
    } : {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'hotel_cms',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
    });

    try {
        const client = await pool.connect();
        console.log('✅ Database connected successfully');

        // 1. Check users
        const users = await client.query('SELECT id, email, is_active FROM users LIMIT 5');
        console.log(`✅ Found ${users.rowCount} users in DB`);

        // 2. Check roles
        const roles = await client.query('SELECT * FROM roles');
        console.log(`✅ Found roles: ${roles.rows.map(r => r.name).join(', ')}`);

        // 3. Check user_roles mapping
        const userRoles = await client.query(`
      SELECT u.email, r.name as role_name, h.name as hotel_name 
      FROM user_roles ur
      JOIN users u ON u.id = ur.user_id
      JOIN roles r ON r.id = ur.role_id
      LEFT JOIN hotels h ON h.id = ur.hotel_id
    `);
        console.log(`✅ User Roles Mapping (total: ${userRoles.rowCount}):`);
        userRoles.rows.forEach(ur => {
            console.log(`   - ${ur.email} has role ${ur.role_name} for hotel ${ur.hotel_name || 'NONE'}`);
        });

        // 4. Test the exact Auth Middleware query for syntax/casting errors (such as the JSONB/JSON COALESCE issue)
        console.log('🔄 Testing auth.middleware.js verification query for syntax errors...');
        try {
            const authQuery = `
        SELECT 
          u.id,
          u.email,
          u.full_name,
          u.is_active,
          json_agg(
            DISTINCT jsonb_build_object(
              'role', r.name,
              'hotel_id', ur.hotel_id,
              'permissions', COALESCE(
                ur.custom_permissions,
                (
                  SELECT json_agg(p.key)
                  FROM role_permissions rp
                  JOIN permissions p ON p.id = rp.permission_id
                  WHERE rp.role_id = r.id
                )
              )
            )
          ) as roles
        FROM users u
        LEFT JOIN user_roles ur ON ur.user_id = u.id
        LEFT JOIN roles r ON r.id = ur.role_id
        WHERE u.is_active = true
        GROUP BY u.id, u.email, u.full_name, u.is_active
        LIMIT 1
      `;
            await client.query(authQuery);
            console.log('✅ Auth middleware query executed successfully - NO syntax errors');
        } catch (queryError) {
            console.error('❌ SQL ERROR in auth middleware query! This causes 500 errors on every API request:', queryError.message);
            if (queryError.message.includes('COALESCE types jsonb and json cannot be matched')) {
                console.error('   👉 FIX REQUIRED: You must cast the json_agg to jsonb like this: (SELECT json_agg(p.key)::jsonb FROM ...)');
            }
        }

        client.release();
        console.log('🔍 Diagnostics complete.');
    } catch (err) {
        console.error('❌ Database connection failed:', err.message);
    } finally {
        await pool.end();
    }
}

runDiagnostics();
