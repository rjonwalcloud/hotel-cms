const { Pool } = require('pg');
require('dotenv').config();

async function seed() {
  console.log('🌱 Seeding database...');

  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
  });

  try {
    // Check if already seeded
    const checkQuery = 'SELECT COUNT(*) as count FROM roles';
    const checkResult = await pool.query(checkQuery);
    
    if (parseInt(checkResult.rows[0].count) > 0) {
      console.log('⏭️  Database already seeded');
      return;
    }

    console.log('🗄️  Seeding initial data...');

    // The schema.sql already contains seed data
    // This script is for additional custom seeding if needed

    console.log('✅ Seeding completed');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

seed()
  .then(() => {
    console.log('✅ Seed completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Seed failed:', error.message);
    process.exit(1);
  });
