const db = require('../src/config/database');

async function migrate() {
  console.log('🚀 Starting migration: Add task_automation_enabled to hotel_settings...');
  
  try {
    // Add column if it doesn't exist
    await db.query(`
      ALTER TABLE hotel_settings 
      ADD COLUMN IF NOT EXISTS task_automation_enabled BOOLEAN DEFAULT true;
    `);
    
    console.log('✅ Migration successful: task_automation_enabled column added.');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

migrate();
