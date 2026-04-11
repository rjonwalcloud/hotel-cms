const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigrations() {
  console.log('🔧 Running post-install setup...');

  // Only run in production/staging environments
  if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'staging') {
    console.log('⏭️  Skipping migrations (not production/staging)');
    return;
  }

  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
  });

  try {
    // Test connection
    console.log('📡 Testing database connection...');
    await pool.query('SELECT NOW()');
    console.log('✅ Database connected');

    // Check if schema is already initialized
    const checkQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `;
    
    const result = await pool.query(checkQuery);
    const schemaExists = result.rows[0].exists;

    if (schemaExists) {
      console.log('✅ Schema already initialized');
      return;
    }

    // Run schema.sql
    console.log('🗄️  Initializing database schema...');
    const schemaPath = path.join(__dirname, '../../schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    await pool.query(schema);
    console.log('✅ Schema initialized successfully');

  } catch (error) {
    console.error('❌ Post-install error:', error.message);
    // Don't fail the build, just warn
    console.warn('⚠️  Continuing without database setup. Run migrations manually.');
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('✅ Post-install complete');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Post-install failed:', error);
      process.exit(0); // Don't fail build
    });
}

module.exports = runMigrations;
