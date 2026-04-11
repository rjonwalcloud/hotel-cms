const { Pool } = require('pg');

const isProduction = process.env.NODE_ENV === 'production';

const dbHost = process.env.DB_HOST || 'localhost';
const isConnectionString = dbHost.startsWith('postgresql://') || dbHost.startsWith('postgres://');
const databaseUrl = process.env.DATABASE_URL || (isConnectionString ? dbHost : null);

const poolConfig = databaseUrl ? {
  connectionString: databaseUrl,
  max: parseInt(process.env.DB_POOL_MAX) || 20,
  min: parseInt(process.env.DB_POOL_MIN) || 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: isProduction ? { rejectUnauthorized: false } : false
} : {
  host: dbHost,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'hotel_cms',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: parseInt(process.env.DB_POOL_MAX) || 20,
  min: parseInt(process.env.DB_POOL_MIN) || 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: isProduction ? { rejectUnauthorized: false } : false
};

// Log configuration on startup (masking secrets)
console.log('📦 Database Configuration:');
if (databaseUrl) {
  const maskedUrl = databaseUrl.replace(/:([^@]+)@/, ':****@');
  console.log(`   Connection String: ${maskedUrl}`);
} else {
  console.log(`   Host: ${poolConfig.host}`);
  console.log(`   Port: ${poolConfig.port}`);
  console.log(`   Database: ${poolConfig.database}`);
  console.log(`   User: ${poolConfig.user}`);
}
console.log(`   SSL: ${!!poolConfig.ssl}`);

if (!databaseUrl && (poolConfig.host === 'localhost' || poolConfig.host === '127.0.0.1')) {
  console.log('⚠️  WARNING: Connecting to LOCALHOST database. Ensure DB_HOST or DATABASE_URL is set if this is production.');
}

const pool = new Pool(poolConfig);

// Auto-migration for missing tables
const ensureMigrations = async () => {
  const client = await pool.connect();
  try {
    // Ensure column constraints are relaxed (idempotent - with explicit checks)
    console.log('🛠️ Synchronizing table constraints...');

    const roomIdCheck = await client.query(`
      SELECT is_nullable FROM information_schema.columns 
      WHERE table_name = 'bookings' AND column_name = 'room_id'
    `);
    if (roomIdCheck.rows.length > 0 && roomIdCheck.rows[0].is_nullable === 'NO') {
      console.log('🛠️ Altering bookings table: making room_id nullable');
      await client.query('ALTER TABLE bookings ALTER COLUMN room_id DROP NOT NULL');
    }

    const totalAmountCheck = await client.query(`
      SELECT is_nullable FROM information_schema.columns 
      WHERE table_name = 'bookings' AND column_name = 'total_amount'
    `);
    if (totalAmountCheck.rows.length > 0 && totalAmountCheck.rows[0].is_nullable === 'NO') {
      console.log('🛠️ Altering bookings table: making total_amount nullable');
      await client.query('ALTER TABLE bookings ALTER COLUMN total_amount DROP NOT NULL');
    }

    // Add room_type_id and quantity to bookings table for simplified logic
    const roomTypeIdCheck = await client.query(`
      SELECT COLUMN_NAME FROM information_schema.columns 
      WHERE table_name = 'bookings' AND column_name = 'room_type_id'
    `);
    if (roomTypeIdCheck.rows.length === 0) {
      console.log('🛠️ Altering bookings table: adding room_type_id');
      await client.query('ALTER TABLE bookings ADD COLUMN room_type_id UUID REFERENCES room_types(id) ON DELETE SET NULL');
    } else {
      // Ensure constraint is SET NULL to allow deleting room types
      try {
        await client.query('ALTER TABLE bookings DROP CONSTRAINT bookings_room_type_id_fkey');
        await client.query('ALTER TABLE bookings ADD CONSTRAINT bookings_room_type_id_fkey FOREIGN KEY (room_type_id) REFERENCES room_types(id) ON DELETE SET NULL');
      } catch (e) {
        // Ignore if constraint doesn't exist with exactly this name
      }
    }

    const quantityCheck = await client.query(`
      SELECT COLUMN_NAME FROM information_schema.columns 
      WHERE table_name = 'bookings' AND column_name = 'quantity'
    `);
    if (quantityCheck.rows.length === 0) {
      console.log('🛠️ Altering bookings table: adding quantity');
      await client.query('ALTER TABLE bookings ADD COLUMN quantity INTEGER DEFAULT 1');
    }

    const discountColumnsCheck = await client.query(`
      SELECT COLUMN_NAME FROM information_schema.columns 
      WHERE table_name = 'bookings' AND column_name IN ('promo_discount', 'coupon_discount', 'applied_coupon', 'applied_promotion', 'rate_plan_name', 'rate_rule_name')
    `);
    if (discountColumnsCheck.rows.length < 6) {
      console.log('🛠️ Altering bookings table: adding invoice tracking columns');
      await client.query('ALTER TABLE bookings ADD COLUMN IF NOT EXISTS promo_discount DECIMAL(10,2) DEFAULT 0');
      await client.query('ALTER TABLE bookings ADD COLUMN IF NOT EXISTS coupon_discount DECIMAL(10,2) DEFAULT 0');
      await client.query('ALTER TABLE bookings ADD COLUMN IF NOT EXISTS applied_coupon VARCHAR(50)');
      await client.query('ALTER TABLE bookings ADD COLUMN IF NOT EXISTS applied_promotion VARCHAR(150)');
      await client.query('ALTER TABLE bookings ADD COLUMN IF NOT EXISTS rate_plan_name VARCHAR(100)');
      await client.query('ALTER TABLE bookings ADD COLUMN IF NOT EXISTS rate_rule_name VARCHAR(150)');
    }

    // IAM: Custom Permissions Migration
    const customPermissionsCheck = await client.query(`
      SELECT COLUMN_NAME FROM information_schema.columns 
      WHERE table_name = 'user_roles' AND column_name = 'custom_permissions'
    `);
    if (customPermissionsCheck.rows.length === 0) {
      console.log('🛠️ Altering user_roles table: adding custom_permissions');
      await client.query('ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS custom_permissions JSONB');
    }

    // IAM: Menu Visibility Migration
    const menuVisibilityCheck = await client.query(`
      SELECT COLUMN_NAME FROM information_schema.columns 
      WHERE table_name = 'user_roles' AND column_name = 'hidden_menu_items'
    `);
    if (menuVisibilityCheck.rows.length === 0) {
      console.log('🛠️ Altering user_roles table: adding hidden_menu_items');
      await client.query("ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS hidden_menu_items JSONB DEFAULT '[]'::jsonb");
    }

    const rateLockCheck = await client.query(`
      SELECT COLUMN_NAME FROM information_schema.columns 
      WHERE table_name = 'bookings' AND column_name IN ('room_rate', 'room_subtotal', 'service_charge')
    `);
    if (rateLockCheck.rows.length < 3) {
      console.log('🛠️ Altering bookings table: adding rate lock and service charge columns');
      await client.query('ALTER TABLE bookings ADD COLUMN IF NOT EXISTS room_rate NUMERIC(10,2)');
      await client.query('ALTER TABLE bookings ADD COLUMN IF NOT EXISTS room_subtotal NUMERIC(10,2)');
      await client.query('ALTER TABLE bookings ADD COLUMN IF NOT EXISTS service_charge NUMERIC(10,2) DEFAULT 0');
    }

    // Invoicing and Payment Settlement Migration
    console.log('🛠️ Ensuring bookings table has invoicing columns...');
    await client.query('ALTER TABLE bookings ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(100) UNIQUE');
    await client.query("ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'NOT_PAID'");
    await client.query('ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50)');

    // Booking Taxes table for historical tax records
    await client.query(`
      CREATE TABLE IF NOT EXISTS booking_taxes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
        tax_id UUID,
        name VARCHAR(100),
        rate DECIMAL(5, 2),
        is_inclusive BOOLEAN DEFAULT false,
        amount DECIMAL(10, 2),
        applied_to VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ensure tasks table exists (may not have been created from schema.sql on Render)
    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
        booking_id UUID REFERENCES bookings(id),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        assigned_to UUID REFERENCES users(id),
        status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
        priority VARCHAR(20) DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
        due_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        created_by UUID REFERENCES users(id),
        comments TEXT,
        source VARCHAR(20) DEFAULT 'MANUAL'
      )
    `);

    // Tasks table: add created_by and comments columns (for existing tables missing them)
    await client.query('ALTER TABLE tasks ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id)');
    await client.query('ALTER TABLE tasks ADD COLUMN IF NOT EXISTS comments TEXT');
    await client.query("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'MANUAL'");

    // Task history table for audit trail
    await client.query(`
      CREATE TABLE IF NOT EXISTS task_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
        from_status VARCHAR(20),
        to_status VARCHAR(20) NOT NULL,
        changed_by UUID REFERENCES users(id),
        comments TEXT,
        changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Task auto-rules table for event-driven task creation
    await client.query(`
      CREATE TABLE IF NOT EXISTS task_auto_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
        event_type VARCHAR(50) NOT NULL,
        event_filter VARCHAR(100),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        priority VARCHAR(20) DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
        assign_to UUID REFERENCES users(id),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Credit notes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS credit_notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
        booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
        credit_note_ref VARCHAR(30) UNIQUE,
        guest_name VARCHAR(255) NOT NULL,
        guest_phone VARCHAR(30),
        guest_email VARCHAR(255),
        invoice_pnr VARCHAR(100),
        comments TEXT,
        amount DECIMAL(12,2) NOT NULL,
        paid_via VARCHAR(30) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'CREATED' CHECK (status IN ('CREATED','APPROVED','REJECTED')),
        created_by UUID REFERENCES users(id),
        approved_by UUID REFERENCES users(id),
        approved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Credit note events for audit trail
    await client.query(`
      CREATE TABLE IF NOT EXISTS credit_note_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        credit_note_id UUID REFERENCES credit_notes(id) ON DELETE CASCADE,
        event_type VARCHAR(50) NOT NULL,
        description TEXT,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Lost & Found table
    await client.query(`
      CREATE TABLE IF NOT EXISTS lost_found_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
        type VARCHAR(10) NOT NULL CHECK (type IN ('LOST', 'FOUND')),
        location VARCHAR(50) NOT NULL,
        location_detail VARCHAR(255),
        found_lost_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        item_category VARCHAR(50) NOT NULL,
        item_description TEXT NOT NULL,
        item_cost DECIMAL(12,2),
        contact_name VARCHAR(255),
        contact_phone VARCHAR(30),
        contact_email VARCHAR(255),
        booking_pnr VARCHAR(100),
        status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','CLAIMED','RETURNED','DISPOSED')),
        notes TEXT,
        reported_by UUID REFERENCES users(id),
        updated_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ensure service_requests table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS service_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
        room_id UUID,
        qr_code_id UUID,
        service_item_id UUID,
        guest_name VARCHAR(255),
        guest_phone VARCHAR(50),
        quantity INTEGER DEFAULT 1,
        notes TEXT,
        status VARCHAR(20) DEFAULT 'PENDING',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Service request history table for audit trail
    await client.query(`
      CREATE TABLE IF NOT EXISTS sr_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        request_id UUID REFERENCES service_requests(id) ON DELETE CASCADE,
        from_status VARCHAR(20),
        to_status VARCHAR(20) NOT NULL,
        changed_by UUID REFERENCES users(id),
        note TEXT,
        changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add booking linkage columns to service_requests
    await client.query('ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS booking_id UUID');
    await client.query('ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS booking_ref VARCHAR(50)');
    // Add invoicing columns to service_requests
    await client.query('ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(100)');
    await client.query('ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS is_billed BOOLEAN DEFAULT false');
    await client.query('ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS order_group_id UUID');
    await client.query('ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50)');

    // Seed missing permission keys for bulk bookings, service requests
    const missingPerms = [
      { key: 'BULK_BOOKING_CREATE', description: 'Create bulk bookings', module: 'BOOKING' },
      { key: 'BULK_BOOKING_VIEW', description: 'View bulk bookings', module: 'BOOKING' },
      { key: 'SERVICE_REQUEST_VIEW', description: 'View service requests', module: 'SERVICE' },
      { key: 'SERVICE_REQUEST_UPDATE', description: 'Update service requests', module: 'SERVICE' },
    ];
    for (const perm of missingPerms) {
      await client.query(`
        INSERT INTO permissions (key, description, module)
        VALUES ($1, $2, $3)
        ON CONFLICT (key) DO NOTHING
      `, [perm.key, perm.description, perm.module]);
    }

    // Ensure Staff role has the right permissions
    const staffPermsToAdd = [
      'SERVICE_REQUEST_VIEW', 'SERVICE_REQUEST_UPDATE',
      'TASK_VIEW', 'TASK_UPDATE',
      'BOOKING_VIEW', 'BOOKING_CREATE', 'BOOKING_UPDATE',
      'BOOKING_CANCEL', 'BOOKING_CHECKIN', 'BOOKING_CHECKOUT',
      'SERVICE_VIEW', 'ROOM_VIEW', 'ROOM_UPDATE_STATUS'
    ];
    for (const permKey of staffPermsToAdd) {
      await client.query(`
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id FROM roles r, permissions p
        WHERE r.name = 'STAFF' AND p.key = $1
        ON CONFLICT (role_id, permission_id) DO NOTHING
      `, [permKey]);
    }
    console.log('✅ Permissions and staff role updated');

    // Inject mandatory permissions into existing staff users who have custom_permissions set
    const mandatoryPerms = ['TASK_VIEW', 'TASK_UPDATE', 'SERVICE_REQUEST_VIEW', 'SERVICE_REQUEST_UPDATE'];
    const staffUsersWithCustom = await client.query(`
      SELECT ur.id, ur.custom_permissions
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE r.name = 'STAFF' AND ur.custom_permissions IS NOT NULL
    `);
    for (const row of staffUsersWithCustom.rows) {
      const currentPerms = Array.isArray(row.custom_permissions) ? row.custom_permissions : [];
      const merged = [...new Set([...currentPerms, ...mandatoryPerms])];
      if (merged.length !== currentPerms.length) {
        await client.query(
          'UPDATE user_roles SET custom_permissions = $1::jsonb WHERE id = $2',
          [JSON.stringify(merged), row.id]
        );
        console.log(`🛠️ Updated staff user_role ${row.id} with mandatory permissions`);
      }
    }

    // Service Category Restaurant Label Migration
    await client.query('ALTER TABLE service_categories ADD COLUMN IF NOT EXISTS is_restaurant BOOLEAN DEFAULT false');

    console.log('🔄 Checking for missing database tables...');

    // Check for booking_rooms table
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'booking_rooms'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('📦 Creating missing table: booking_rooms');
      await client.query(`
        CREATE TABLE booking_rooms (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
          room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(booking_id, room_id)
        );
      `);
      console.log('✅ booking_rooms table created successfully');
    }

    // Check for amenities table
    console.log('🔄 Checking for missing table: amenities');
    const amenitiesTableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'amenities'
      );
    `);

    if (!amenitiesTableCheck.rows[0].exists) {
      console.log('📦 Creating missing table: amenities');
      await client.query(`
            CREATE TABLE IF NOT EXISTS amenities (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
                name VARCHAR(100) NOT NULL,
                icon VARCHAR(50),
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
      console.log('✅ amenities table created successfully');

      // Seed some default amenities for the primary hotel if none exist
      const defaultHotel = await client.query('SELECT id FROM hotels LIMIT 1');
      if (defaultHotel.rows.length > 0) {
        const defaultHotelId = defaultHotel.rows[0].id;
        console.log('🌱 Seeding default amenities...');
        await client.query(`
                INSERT INTO amenities (hotel_id, name, icon, description) VALUES
                ($1, 'WiFi', 'Wifi', 'High-speed wireless internet'),
                ($1, 'TV', 'Tv', 'Flat-screen television with cable'),
                ($1, 'AC', 'Wind', 'Air conditioning'),
                ($1, 'Mini Fridge', 'Refrigerator', 'Miniature refrigerator for drinks & snacks'),
                ($1, 'Room Service', 'Utensils', '24/7 in-room dining'),
                ($1, 'Ocean View', 'Waves', 'Beautiful view of the ocean')
            `, [defaultHotelId]);
        console.log('✅ Default amenities seeded.');
      }
    }

    // New Migrations for Guest Details and Billing
    console.log('🔄 Checking for advanced booking tables...');

    // Check for booking_guests table
    const guestTableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'booking_guests'
      );
    `);

    if (!guestTableCheck.rows[0].exists) {
      console.log('📦 Creating missing table: booking_guests');
      await client.query(`
        CREATE TABLE booking_guests (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
          full_name VARCHAR(255) NOT NULL,
          age INTEGER,
          id_proof_type VARCHAR(50),
          id_proof_number VARCHAR(100),
          is_child BOOLEAN DEFAULT false,
          room_idx INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('✅ booking_guests table created successfully');
    } else {
      // Migrations for existing booking_guests table
      const guestIsChildCheck = await client.query(`
        SELECT COLUMN_NAME FROM information_schema.columns 
        WHERE table_name = 'booking_guests' AND column_name = 'is_child'
      `);
      if (guestIsChildCheck.rows.length === 0) {
        console.log('🛠️ Altering booking_guests table: adding is_child');
        await client.query('ALTER TABLE booking_guests ADD COLUMN is_child BOOLEAN DEFAULT false');
      }

      const guestRoomIdxCheck = await client.query(`
        SELECT COLUMN_NAME FROM information_schema.columns 
        WHERE table_name = 'booking_guests' AND column_name = 'room_idx'
      `);
      if (guestRoomIdxCheck.rows.length === 0) {
        console.log('🛠️ Altering booking_guests table: adding room_idx');
        await client.query('ALTER TABLE booking_guests ADD COLUMN room_idx INTEGER DEFAULT 0');
      }
    }

    // Migration for Hotel GST Number
    const hotelGstCheck = await client.query(`
      SELECT COLUMN_NAME FROM information_schema.columns 
      WHERE table_name = 'hotels' AND column_name = 'gst_number'
    `);

    if (hotelGstCheck.rows.length === 0) {
      console.log('🛠️ Altering hotels table: adding gst_number');
      await client.query('ALTER TABLE hotels ADD COLUMN gst_number VARCHAR(50)');
      console.log('✅ Hotel migrations applied successfully');
    }

    // Migration for Hotel Logo
    const hotelLogoCheck = await client.query(`
      SELECT COLUMN_NAME FROM information_schema.columns 
      WHERE table_name = 'hotels' AND column_name = 'logo'
    `);

    if (hotelLogoCheck.rows.length === 0) {
      console.log('🛠️ Altering hotels table: adding logo');
      await client.query('ALTER TABLE hotels ADD COLUMN logo TEXT');
      console.log('✅ Hotel logo migration applied successfully');
    }

    // Migration for Hotel ID Code (10-digit alphanumeric)
    const hotelIdCodeCheck = await client.query(`
      SELECT COLUMN_NAME FROM information_schema.columns 
      WHERE table_name = 'hotels' AND column_name = 'hotel_id_code'
    `);

    if (hotelIdCodeCheck.rows.length === 0) {
      console.log('🛠️ Altering hotels table: adding hotel_id_code');
      await client.query('ALTER TABLE hotels ADD COLUMN hotel_id_code VARCHAR(10) UNIQUE');

      // Generate codes for existing hotels
      const hotels = await client.query('SELECT id FROM hotels WHERE hotel_id_code IS NULL');
      for (const hotel of hotels.rows) {
        let unique = false;
        let code = '';
        while (!unique) {
          code = Array.from({ length: 10 }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.charAt(Math.floor(Math.random() * 36))).join('');
          const check = await client.query('SELECT 1 FROM hotels WHERE hotel_id_code = $1', [code]);
          if (check.rows.length === 0) unique = true;
        }
        await client.query('UPDATE hotels SET hotel_id_code = $1 WHERE id = $2', [code, hotel.id]);
      }
      console.log('✅ Hotel ID Code migration applied successfully');
    }

    // Migration for Service Item Max Quantity
    const maxQuantityCheck = await client.query(`
      SELECT COLUMN_NAME FROM information_schema.columns 
      WHERE table_name = 'service_items' AND column_name = 'max_quantity'
    `);

    if (maxQuantityCheck.rows.length === 0) {
      console.log('🛠️ Altering service_items table: adding max_quantity');
      await client.query('ALTER TABLE service_items ADD COLUMN max_quantity INTEGER');
      console.log('✅ Service items migration applied successfully');
    }

    // Migration for Service Item Dietary Type
    const dietaryTypeCheck = await client.query(`
      SELECT COLUMN_NAME FROM information_schema.columns 
      WHERE table_name = 'service_items' AND column_name = 'dietary_type'
    `);

    if (dietaryTypeCheck.rows.length === 0) {
      console.log('🛠️ Altering service_items table: adding dietary_type');
      await client.query("ALTER TABLE service_items ADD COLUMN dietary_type VARCHAR(20) DEFAULT 'ALL' CHECK (dietary_type IN ('VEG', 'NON_VEG', 'ALL'))");
      console.log('✅ Service items dietary_type migration applied successfully');
    }

    // Migration for Room Type Short Code
    const shortCodeCheck = await client.query(`
      SELECT COLUMN_NAME FROM information_schema.columns 
      WHERE table_name = 'room_types' AND column_name = 'short_code'
    `);

    if (shortCodeCheck.rows.length === 0) {
      console.log('🛠️ Altering room_types table: adding short_code');
      await client.query('ALTER TABLE room_types ADD COLUMN short_code VARCHAR(10)');
      console.log('✅ Room Types Short Code migration applied successfully');
    }

    // Migration for Room Type Occupancy-Based Pricing
    const occupancyPricingCheck = await client.query(`
      SELECT COLUMN_NAME FROM information_schema.columns 
      WHERE table_name = 'room_types' AND column_name = 'max_adults'
    `);
    if (occupancyPricingCheck.rows.length === 0) {
      console.log('🛠️ Altering room_types table: adding occupancy pricing columns');
      await client.query('ALTER TABLE room_types ADD COLUMN IF NOT EXISTS max_adults INTEGER DEFAULT 2');
      await client.query('ALTER TABLE room_types ADD COLUMN IF NOT EXISTS max_children INTEGER DEFAULT 0');
      await client.query('ALTER TABLE room_types ADD COLUMN IF NOT EXISTS extra_adult_charge NUMERIC(10,2) DEFAULT 500');
      await client.query('ALTER TABLE room_types ADD COLUMN IF NOT EXISTS extra_child_charge NUMERIC(10,2) DEFAULT 200');
      console.log('✅ Room Types occupancy pricing migration applied successfully');
    }

    // Migration for Booking Occupancy Surcharge
    await client.query('ALTER TABLE bookings ADD COLUMN IF NOT EXISTS occupancy_surcharge NUMERIC(10,2) DEFAULT 0');

    // Migration for Booking Reference (Public Booking ID)
    const bookingRefCheck = await client.query(`
      SELECT COLUMN_NAME FROM information_schema.columns 
      WHERE table_name = 'bookings' AND column_name = 'booking_ref'
    `);

    if (bookingRefCheck.rows.length === 0) {
      console.log('🛠️ Altering bookings table: adding booking_ref');
      await client.query('ALTER TABLE bookings ADD COLUMN booking_ref VARCHAR(30) UNIQUE');
      console.log('✅ Booking Reference migration applied successfully');
    }

    // Check for room_inventory table
    const inventoryTableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'room_inventory'
      );
    `);

    // Check for bulk_bookings table
    const bulkBookingsTableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'bulk_bookings'
      );
    `);

    if (!bulkBookingsTableCheck.rows[0].exists) {
      console.log('📦 Creating missing table: bulk_bookings');
      await client.query(`
        CREATE TABLE bulk_bookings (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
            company_name VARCHAR(255),
            guest_name VARCHAR(255) NOT NULL,
            guest_email VARCHAR(255),
            guest_phone VARCHAR(20) NOT NULL,
            event_details TEXT,
            additional_requirements TEXT,
            check_in_date DATE NOT NULL,
            check_out_date DATE NOT NULL,
            adults INTEGER DEFAULT 1,
            children INTEGER DEFAULT 0,
            promo_discount DECIMAL(10, 2) DEFAULT 0,
            applied_promotion VARCHAR(255),
            extra_charges JSONB DEFAULT '[]'::jsonb,
            corporate_gst VARCHAR(50),
            total_amount DECIMAL(10, 2) NOT NULL,
            paid_amount DECIMAL(10, 2) DEFAULT 0,
            status VARCHAR(20) DEFAULT 'CREATED' CHECK (status IN ('CREATED', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW', 'REFUNDED')),
            created_by UUID REFERENCES users(id),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('✅ bulk_bookings table created successfully');
    }

    // Verify fields exist if bulk_bookings was already created
    const bulkBookingsChecks = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'bulk_bookings'
    `);
    const bulkBookingCols = bulkBookingsChecks.rows.map(r => r.column_name);

    if (!bulkBookingCols.includes('promo_discount')) {
      console.log('🛠️ Altering bulk_bookings table: adding billing fields');
      await client.query('ALTER TABLE bulk_bookings ADD COLUMN promo_discount DECIMAL(10,2) DEFAULT 0');
      await client.query('ALTER TABLE bulk_bookings ADD COLUMN applied_promotion VARCHAR(255)');
      await client.query("ALTER TABLE bulk_bookings ADD COLUMN extra_charges JSONB DEFAULT '[]'::jsonb");
      await client.query('ALTER TABLE bulk_bookings ADD COLUMN corporate_gst VARCHAR(50)');
    }

    if (!bulkBookingCols.includes('invoice_number')) {
      console.log('🛠️ Altering bulk_bookings table: adding invoice_number');
      await client.query('ALTER TABLE bulk_bookings ADD COLUMN invoice_number VARCHAR(100)');
    }

    if (!bulkBookingCols.includes('payment_status')) {
      console.log('🛠️ Altering bulk_bookings table: adding payment fields');
      await client.query("ALTER TABLE bulk_bookings ADD COLUMN payment_status VARCHAR(20) DEFAULT 'UNPAID'");
      await client.query('ALTER TABLE bulk_bookings ADD COLUMN payment_method VARCHAR(50)');
    }

    // Migration for bulk_booking_id on bookings
    const bookingsBulkIdCheck = await client.query(`
      SELECT COLUMN_NAME FROM information_schema.columns 
      WHERE table_name = 'bookings' AND column_name = 'bulk_booking_id'
    `);

    if (bookingsBulkIdCheck.rows.length === 0) {
      console.log('🛠️ Altering bookings table: adding bulk_booking_id');
      await client.query('ALTER TABLE bookings ADD COLUMN bulk_booking_id UUID REFERENCES bulk_bookings(id) ON DELETE CASCADE');
      console.log('✅ Bookings Bulk Booking ID migration applied successfully');
    }

    if (!inventoryTableCheck.rows[0].exists) {
      console.log('📦 Creating missing table: room_inventory');
      await client.query(`
        CREATE TABLE room_inventory (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
          room_type_id UUID REFERENCES room_types(id) ON DELETE CASCADE,
          inventory_date DATE NOT NULL,
          total_inventory INTEGER NOT NULL DEFAULT 0,
          booked_count INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(hotel_id, room_type_id, inventory_date)
        );
        CREATE INDEX idx_room_inventory_dates ON room_inventory(hotel_id, room_type_id, inventory_date);
      `);
      console.log('✅ room_inventory table created successfully');
    }

    // Check for booking_events table
    const eventsTableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'booking_events'
      );
    `);

    if (!eventsTableCheck.rows[0].exists) {
      console.log('📦 Creating missing table: booking_events');
      await client.query(`
        CREATE TABLE booking_events (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
            event_type VARCHAR(50) NOT NULL,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX idx_booking_events_booking_id ON booking_events(booking_id);
      `);
      console.log('✅ booking_events table created successfully');
    }

    // Tax and Currency Settings Migrations
    console.log('🔄 Checking for Tax & Currency tables...');

    // 1. hotel_settings
    const settingsTableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'hotel_settings'
      );
    `);

    if (!settingsTableCheck.rows[0].exists) {
      console.log('📦 Creating missing table: hotel_settings');
      await client.query(`
        CREATE TABLE hotel_settings (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE UNIQUE,
          currency_code VARCHAR(10) DEFAULT 'USD',
          currency_symbol VARCHAR(5) DEFAULT '$',
          task_automation_enabled BOOLEAN DEFAULT true,
          invoice_prefix VARCHAR(10),
          invoice_counter INTEGER DEFAULT 0,
          upi_id TEXT,
          bank_name TEXT,
          account_number TEXT,
          ifsc_code TEXT,
          upi_qr_code TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('✅ hotel_settings table created successfully');
    } else {
      // Ensure task_automation_enabled exists for existing tables
      const automationColumnCheck = await client.query(`
        SELECT COLUMN_NAME FROM information_schema.columns 
        WHERE table_name = 'hotel_settings' AND column_name = 'task_automation_enabled'
      `);
      if (automationColumnCheck.rows.length === 0) {
        console.log('🛠️ Altering hotel_settings table: adding task_automation_enabled');
        await client.query('ALTER TABLE hotel_settings ADD COLUMN task_automation_enabled BOOLEAN DEFAULT true');
      }

      await client.query('ALTER TABLE hotel_settings ADD COLUMN IF NOT EXISTS invoice_prefix VARCHAR(10)');
      await client.query('ALTER TABLE hotel_settings ADD COLUMN IF NOT EXISTS invoice_counter INTEGER DEFAULT 0');
      await client.query('ALTER TABLE hotel_settings ADD COLUMN IF NOT EXISTS upi_id TEXT');
      await client.query('ALTER TABLE hotel_settings ADD COLUMN IF NOT EXISTS bank_name TEXT');
      await client.query('ALTER TABLE hotel_settings ADD COLUMN IF NOT EXISTS account_number TEXT');
      await client.query('ALTER TABLE hotel_settings ADD COLUMN IF NOT EXISTS ifsc_code TEXT');
      await client.query('ALTER TABLE hotel_settings ADD COLUMN IF NOT EXISTS upi_qr_code TEXT');
      await client.query('ALTER TABLE hotel_settings ADD COLUMN IF NOT EXISTS support_phone VARCHAR(30)');
      await client.query('ALTER TABLE hotel_settings ADD COLUMN IF NOT EXISTS support_email VARCHAR(255)');
      await client.query('ALTER TABLE hotel_settings ADD COLUMN IF NOT EXISTS support_whatsapp VARCHAR(30)');
    }

    // 2. taxes
    const taxesTableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'taxes'
      );
    `);

    if (!taxesTableCheck.rows[0].exists) {
      console.log('📦 Creating missing table: taxes');
      await client.query(`
        CREATE TABLE taxes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
          name VARCHAR(100) NOT NULL,
          category VARCHAR(50) NOT NULL,
          rate DECIMAL(5, 2) NOT NULL,
          is_inclusive BOOLEAN DEFAULT false,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('✅ taxes table created successfully');
    }

    // Drop legacy strict category check constraints if they exist
    try {
      console.log('🔄 Checking and removing legacy tax constraints...');
      await client.query('ALTER TABLE taxes DROP CONSTRAINT IF EXISTS taxes_category_check;');

      const constraintCheck = await client.query(`
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'taxes'::regclass AND contype = 'c';
      `);
      for (let row of constraintCheck.rows) {
        await client.query(`ALTER TABLE taxes DROP CONSTRAINT IF EXISTS "${row.conname}";`);
        console.log(`✅ Dropped legacy constraint: ${row.conname}`);
      }
    } catch (e) {
      console.log('Notice: Could not modify legacy tax constraints (this is normal if none exist).');
    }

    // 3. booking_taxes (snapshot applied taxes)
    const bookingTaxesTableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'booking_taxes'
      );
    `);

    if (!bookingTaxesTableCheck.rows[0].exists) {
      console.log('📦 Creating missing table: booking_taxes');
      await client.query(`
        CREATE TABLE booking_taxes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
          tax_id UUID REFERENCES taxes(id) ON DELETE SET NULL,
          name VARCHAR(100) NOT NULL,
          rate DECIMAL(5, 2) NOT NULL,
          is_inclusive BOOLEAN NOT NULL,
          amount DECIMAL(10, 2) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX idx_booking_taxes_booking_id ON booking_taxes(booking_id);
      `);
      console.log('✅ booking_taxes table created successfully');
    }

    console.log('✅ Advanced tables and columns verified');

    // Rate Management Tables
    console.log('🔄 Checking for rate management tables...');
    const ratePlansCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'rate_plans'
      );
    `);
    if (!ratePlansCheck.rows[0].exists) {
      console.log('📦 Creating table: rate_plans');
      await client.query(`
        CREATE TABLE rate_plans (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
          name VARCHAR(100) NOT NULL,
          description TEXT,
          is_default BOOLEAN DEFAULT false,
          is_active BOOLEAN DEFAULT true,
          priority INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX idx_rate_plans_hotel ON rate_plans(hotel_id);
      `);
      console.log('✅ rate_plans table created');
    }

    const rateRulesCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'rate_rules'
      );
    `);
    if (!rateRulesCheck.rows[0].exists) {
      console.log('📦 Creating table: rate_rules');
      await client.query(`
        CREATE TABLE rate_rules (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
          rate_plan_id UUID REFERENCES rate_plans(id) ON DELETE CASCADE,
          room_type_id UUID REFERENCES room_types(id) ON DELETE CASCADE,
          name VARCHAR(150),
          start_date DATE NOT NULL,
          end_date DATE NOT NULL,
          price_override DECIMAL(10, 2) NOT NULL,
          adjustment_type VARCHAR(20) DEFAULT 'FIXED' CHECK (adjustment_type IN ('FIXED', 'PERCENTAGE_INCREASE', 'PERCENTAGE_DECREASE')),
          adjustment_value DECIMAL(10, 2),
          day_of_week INTEGER[],
          min_nights INTEGER DEFAULT 1,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX idx_rate_rules_hotel ON rate_rules(hotel_id);
        CREATE INDEX idx_rate_rules_dates ON rate_rules(start_date, end_date);
        CREATE INDEX idx_rate_rules_room_type ON rate_rules(room_type_id);
      `);
      console.log('✅ rate_rules table created');
    }

    // Promotion Tables
    console.log('🔄 Checking for promotion tables...');
    const promotionsCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'promotions'
      );
    `);
    if (!promotionsCheck.rows[0].exists) {
      console.log('📦 Creating table: promotions');
      await client.query(`
        CREATE TABLE promotions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
          name VARCHAR(150) NOT NULL,
          description TEXT,
          discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('PERCENTAGE', 'FLAT')),
          discount_value DECIMAL(10, 2) NOT NULL,
          auto_apply BOOLEAN DEFAULT false,
          start_date DATE,
          end_date DATE,
          min_nights INTEGER DEFAULT 1,
          min_amount DECIMAL(10, 2) DEFAULT 0,
          max_discount DECIMAL(10, 2),
          applicable_room_types UUID[],
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX idx_promotions_hotel ON promotions(hotel_id);
        CREATE INDEX idx_promotions_dates ON promotions(start_date, end_date);
      `);
      console.log('✅ promotions table created');
    }

    const couponCodesCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'coupon_codes'
      );
    `);
    if (!couponCodesCheck.rows[0].exists) {
      console.log('📦 Creating table: coupon_codes');
      await client.query(`
        CREATE TABLE coupon_codes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
          code VARCHAR(50) NOT NULL,
          description TEXT,
          discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('PERCENTAGE', 'FLAT')),
          discount_value DECIMAL(10, 2) NOT NULL,
          max_uses INTEGER,
          used_count INTEGER DEFAULT 0,
          per_booking_limit INTEGER DEFAULT 1,
          start_date DATE,
          end_date DATE,
          min_nights INTEGER DEFAULT 1,
          min_amount DECIMAL(10, 2) DEFAULT 0,
          max_discount DECIMAL(10, 2),
          applicable_room_types UUID[],
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(hotel_id, code)
        );
        CREATE INDEX idx_coupon_codes_hotel ON coupon_codes(hotel_id);
        CREATE INDEX idx_coupon_codes_code ON coupon_codes(code);
      `);
      console.log('✅ coupon_codes table created');
    }

    const promoUsageCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'promo_usage'
      );
    `);
    if (!promoUsageCheck.rows[0].exists) {
      console.log('📦 Creating table: promo_usage');
      await client.query(`
        CREATE TABLE promo_usage (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
          coupon_id UUID REFERENCES coupon_codes(id) ON DELETE CASCADE,
          booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
          discount_amount DECIMAL(10, 2) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX idx_promo_usage_coupon ON promo_usage(coupon_id);
      `);
      console.log('✅ promo_usage table created');
    }

    // ----------------------------------------------------
    // New Feature Tables (Booking Channels, Services, QR)
    // ----------------------------------------------------
    console.log('🔄 Checking for new feature tables (Channels, Services, QR)...');

    // 1. qr_codes
    const qrCodesCheck = await client.query(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'qr_codes');
    `);
    if (!qrCodesCheck.rows[0].exists) {
      console.log('📦 Creating table: qr_codes');
      await client.query(`
        CREATE TABLE qr_codes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
          room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
          purpose VARCHAR(50) NOT NULL,
          token VARCHAR(100) UNIQUE NOT NULL,
          is_active BOOLEAN DEFAULT true,
          created_by UUID REFERENCES users(id) ON DELETE SET NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    }

    // 2. booking_channels
    const bookingChannelsCheck = await client.query(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'booking_channels');
    `);
    if (!bookingChannelsCheck.rows[0].exists) {
      console.log('📦 Creating table: booking_channels');
      await client.query(`
        CREATE TABLE booking_channels (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          channel_type VARCHAR(50) NOT NULL,
          api_key VARCHAR(255),
          api_secret VARCHAR(255),
          property_id VARCHAR(100),
          commission_rate DECIMAL(5,2) DEFAULT 0,
          config JSONB DEFAULT '{}'::jsonb,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(hotel_id, channel_type)
        );
      `);
    }

    // 3. channel_bookings
    const channelBookingsCheck = await client.query(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'channel_bookings');
    `);
    if (!channelBookingsCheck.rows[0].exists) {
      console.log('📦 Creating table: channel_bookings');
      await client.query(`
        CREATE TABLE channel_bookings (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          channel_id UUID REFERENCES booking_channels(id) ON DELETE CASCADE,
          hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
          external_booking_id VARCHAR(100),
          channel_type VARCHAR(50),
          guest_name VARCHAR(255),
          guest_email VARCHAR(255),
          guest_phone VARCHAR(50),
          check_in_date DATE,
          check_out_date DATE,
          room_count INTEGER DEFAULT 1,
          total_amount DECIMAL(10,2),
          commission_amount DECIMAL(10,2) DEFAULT 0,
          status VARCHAR(50) DEFAULT 'PENDING',
          raw_data JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    }

    // 4. service_categories
    const serviceCategoriesCheck = await client.query(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'service_categories');
    `);
    if (!serviceCategoriesCheck.rows[0].exists) {
      console.log('📦 Creating table: service_categories');
      await client.query(`
        CREATE TABLE service_categories (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    }

    // 5. service_items
    const serviceItemsCheck = await client.query(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'service_items');
    `);
    if (!serviceItemsCheck.rows[0].exists) {
      console.log('📦 Creating table: service_items');
      await client.query(`
        CREATE TABLE service_items (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
          category_id UUID REFERENCES service_categories(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          price DECIMAL(10,2),
          max_quantity INTEGER,
          is_available BOOLEAN DEFAULT true,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    }

    // 6. service_requests
    const serviceRequestsCheck = await client.query(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'service_requests');
    `);
    if (!serviceRequestsCheck.rows[0].exists) {
      console.log('📦 Creating table: service_requests');
      await client.query(`
        CREATE TABLE service_requests (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
          room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
          qr_code_id UUID REFERENCES qr_codes(id) ON DELETE SET NULL,
          service_item_id UUID REFERENCES service_items(id) ON DELETE CASCADE,
          guest_name VARCHAR(255),
          guest_phone VARCHAR(50),
          quantity INTEGER DEFAULT 1,
          notes TEXT,
          status VARCHAR(50) DEFAULT 'PENDING',
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    }

    // Migration: ensure order_group_id, is_billed, and invoice_number exist on service_requests
    try {
      await client.query(`ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS order_group_id UUID;`);
      await client.query(`ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS is_billed BOOLEAN DEFAULT false;`);
      await client.query(`ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(100);`);
    } catch (err) { }

    // 7. addons
    const addonsCheck = await client.query(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'addons');
    `);
    if (!addonsCheck.rows[0].exists) {
      console.log('📦 Creating table: addons');
      await client.query(`
        CREATE TABLE addons (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          price DECIMAL(10, 2) NOT NULL,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      try {
        await client.query(`
          CREATE TRIGGER update_addons_updated_at BEFORE UPDATE ON addons
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        `);
      } catch (err) { }
    }

    // 8. booking_addons
    const bookingAddonsCheck = await client.query(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'booking_addons');
    `);
    if (!bookingAddonsCheck.rows[0].exists) {
      console.log('📦 Creating table: booking_addons');
      await client.query(`
        CREATE TABLE booking_addons (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
          addon_id UUID REFERENCES addons(id) ON DELETE CASCADE,
          quantity INTEGER DEFAULT 1,
          price_at_booking DECIMAL(10, 2) NOT NULL,
          total_price DECIMAL(10, 2) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    }

    // ============================================
    // ITEM INVENTORY TABLES (Auto-migration)
    // ============================================
    console.log('🔄 Checking for item inventory tables...');

    const invCatCheck = await client.query(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_categories');
    `);
    if (!invCatCheck.rows[0].exists) {
      console.log('📦 Creating item inventory tables...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS inventory_categories (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
          name VARCHAR(100) NOT NULL,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(hotel_id, name)
        );

        CREATE TABLE IF NOT EXISTS inventory_items (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
          category_id UUID REFERENCES inventory_categories(id) ON DELETE SET NULL,
          name VARCHAR(255) NOT NULL,
          sku VARCHAR(50),
          unit VARCHAR(20) NOT NULL,
          min_stock_level DECIMAL(10, 2) DEFAULT 0,
          price DECIMAL(12, 2) DEFAULT 0,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(hotel_id, name, sku)
        );

        CREATE TABLE IF NOT EXISTS inventory_stores (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
          name VARCHAR(100) NOT NULL,
          description TEXT,
          location VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(hotel_id, name)
        );

        CREATE TABLE IF NOT EXISTS inventory_stock (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
          store_id UUID REFERENCES inventory_stores(id) ON DELETE CASCADE,
          item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
          quantity DECIMAL(12, 2) DEFAULT 0,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(store_id, item_id)
        );

        CREATE TABLE IF NOT EXISTS inventory_suppliers (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          contact_person VARCHAR(255),
          phone VARCHAR(20),
          email VARCHAR(255),
          address TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS inventory_purchase_orders (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
          supplier_id UUID REFERENCES inventory_suppliers(id) ON DELETE SET NULL,
          po_number VARCHAR(50) NOT NULL,
          status VARCHAR(20) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SENT', 'RECEIVED', 'CANCELLED')),
          total_amount DECIMAL(12, 2) DEFAULT 0,
          notes TEXT,
          created_by UUID REFERENCES users(id),
          received_by UUID REFERENCES users(id),
          received_at TIMESTAMP,
          received_amount DECIMAL(12, 2),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(hotel_id, po_number)
        );

        CREATE TABLE IF NOT EXISTS inventory_po_items (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          po_id UUID REFERENCES inventory_purchase_orders(id) ON DELETE CASCADE,
          item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
          quantity DECIMAL(12, 2) NOT NULL,
          received_quantity DECIMAL(12, 2),
          unit_price DECIMAL(12, 2) NOT NULL,
          total_price DECIMAL(12, 2) NOT NULL,
          remarks TEXT,
          UNIQUE(po_id, item_id)
        );

        CREATE TABLE IF NOT EXISTS inventory_stock_movements (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
          item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
          from_store_id UUID REFERENCES inventory_stores(id) ON DELETE SET NULL,
          to_store_id UUID REFERENCES inventory_stores(id) ON DELETE SET NULL,
          quantity DECIMAL(12, 2) NOT NULL,
          movement_type VARCHAR(30) NOT NULL,
          reference_id UUID,
          performed_by UUID REFERENCES users(id),
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS inventory_expenses (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
          category VARCHAR(100) NOT NULL,
          amount DECIMAL(12, 2) NOT NULL,
          description TEXT,
          expense_date DATE DEFAULT CURRENT_DATE,
          payment_method VARCHAR(50),
          created_by UUID REFERENCES users(id),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS inventory_breakage_reports (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
          item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
          store_id UUID REFERENCES inventory_stores(id) ON DELETE CASCADE,
          quantity DECIMAL(12, 2) NOT NULL,
          type VARCHAR(50) NOT NULL,
          reported_by UUID REFERENCES users(id),
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_inv_stock_hotel ON inventory_stock(hotel_id);
        CREATE INDEX IF NOT EXISTS idx_inv_stock_item ON inventory_stock(item_id);
        CREATE INDEX IF NOT EXISTS idx_inv_movements_item ON inventory_stock_movements(item_id);
        CREATE INDEX IF NOT EXISTS idx_inv_movements_hotel ON inventory_stock_movements(hotel_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_inv_po_hotel ON inventory_purchase_orders(hotel_id, status);
        CREATE INDEX IF NOT EXISTS idx_inv_expenses_hotel ON inventory_expenses(hotel_id, expense_date DESC);
      `);
      console.log('✅ Item inventory tables created successfully');
    }

    // Ensure inventory_stores has location column (may be missing from older migration)
    const storeLocCheck = await client.query(`
      SELECT COLUMN_NAME FROM information_schema.columns
      WHERE table_name = 'inventory_stores' AND column_name = 'location'
    `);
    if (storeLocCheck.rows.length === 0) {
      console.log('🛠️ Adding location column to inventory_stores');
      await client.query('ALTER TABLE inventory_stores ADD COLUMN location VARCHAR(255)');
    }

    // Ensure inventory_expenses has payment_method column
    const expPayCheck = await client.query(`
      SELECT COLUMN_NAME FROM information_schema.columns
      WHERE table_name = 'inventory_expenses' AND column_name = 'payment_method'
    `);
    if (expPayCheck.rows.length === 0) {
      console.log('🛠️ Adding payment_method column to inventory_expenses');
      await client.query('ALTER TABLE inventory_expenses ADD COLUMN payment_method VARCHAR(50)');
    }

    // Ensure inventory_items has price column
    const itemPriceCheck = await client.query(`
      SELECT COLUMN_NAME FROM information_schema.columns
      WHERE table_name = 'inventory_items' AND column_name = 'price'
    `);
    if (itemPriceCheck.rows.length === 0) {
      console.log('🛠️ Adding price column to inventory_items');
      await client.query('ALTER TABLE inventory_items ADD COLUMN price DECIMAL(12, 2) DEFAULT 0');
    }

    // Ensure inventory_purchase_orders has received_by and received_at columns
    const poRecByCheck = await client.query(`
      SELECT COLUMN_NAME FROM information_schema.columns
      WHERE table_name = 'inventory_purchase_orders' AND column_name = 'received_by'
    `);
    if (poRecByCheck.rows.length === 0) {
      console.log('🛠️ Adding received_by/received_at columns to inventory_purchase_orders');
      await client.query('ALTER TABLE inventory_purchase_orders ADD COLUMN received_by UUID REFERENCES users(id)');
      await client.query('ALTER TABLE inventory_purchase_orders ADD COLUMN received_at TIMESTAMP');
    }

    // Ensure inventory_purchase_orders has received_amount column
    const poRecAmtCheck = await client.query(`
      SELECT COLUMN_NAME FROM information_schema.columns
      WHERE table_name = 'inventory_purchase_orders' AND column_name = 'received_amount'
    `);
    if (poRecAmtCheck.rows.length === 0) {
      console.log('🛠️ Adding received_amount column to inventory_purchase_orders');
      await client.query('ALTER TABLE inventory_purchase_orders ADD COLUMN received_amount DECIMAL(12, 2)');
    }

    // Ensure inventory_po_items has received_quantity and remarks columns
    const poItemRecQtyCheck = await client.query(`
      SELECT COLUMN_NAME FROM information_schema.columns
      WHERE table_name = 'inventory_po_items' AND column_name = 'received_quantity'
    `);
    if (poItemRecQtyCheck.rows.length === 0) {
      console.log('🛠️ Adding received_quantity/remarks columns to inventory_po_items');
      await client.query('ALTER TABLE inventory_po_items ADD COLUMN received_quantity DECIMAL(12, 2)');
      await client.query('ALTER TABLE inventory_po_items ADD COLUMN remarks TEXT');
    }

    // Seed inventory permissions if missing
    await client.query(`
      INSERT INTO permissions (key, description, module) VALUES
      ('INVENTORY_VIEW', 'View inventory dashboard and stock levels', 'INVENTORY'),
      ('INVENTORY_MANAGE', 'Manage inventory items, categories, and stores', 'INVENTORY'),
      ('INVENTORY_STOCK_UPDATE', 'Manually adjust stock and perform transfers', 'INVENTORY'),
      ('INVENTORY_PO_MANAGE', 'Manage suppliers and purchase orders', 'INVENTORY'),
      ('INVENTORY_BREAKAGE_REPORT', 'Report item breakage or loss', 'INVENTORY'),
      ('INVENTORY_EXPENSE_MANAGE', 'Record and manage operational expenses', 'INVENTORY')
      ON CONFLICT (key) DO NOTHING;
    `);

    // Map inventory permissions to roles
    await client.query(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
      WHERE r.name = 'HOTEL_ADMIN' AND p.key LIKE 'INVENTORY_%'
      ON CONFLICT DO NOTHING;
    `);
    await client.query(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
      WHERE r.name = 'STAFF' AND p.key IN ('INVENTORY_VIEW', 'INVENTORY_BREAKAGE_REPORT')
      ON CONFLICT DO NOTHING;
    `);
    await client.query(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
      WHERE r.name = 'SUPER_ADMIN' AND p.key LIKE 'INVENTORY_%'
      ON CONFLICT DO NOTHING;
    `);

    console.log('✅ Item inventory tables and permissions verified');

    // Auto-seed Inventory
    console.log('🌱 Auto-syncing room inventory for the next 365 days...');
    const seedQuery = `
      WITH room_counts AS (
        SELECT room_type_id, hotel_id, COUNT(*) as count 
        FROM rooms 
        GROUP BY room_type_id, hotel_id
      )
      INSERT INTO room_inventory (hotel_id, room_type_id, inventory_date, total_inventory, booked_count) 
      SELECT rt.hotel_id, rt.id, CURRENT_DATE + i, COALESCE(rc.count, 0), 0 
      FROM room_types rt
      LEFT JOIN room_counts rc ON rc.room_type_id = rt.id
      CROSS JOIN generate_series(0, 365) i 
      ON CONFLICT (hotel_id, room_type_id, inventory_date) 
      DO UPDATE SET total_inventory = EXCLUDED.total_inventory;
    `;
    await client.query(seedQuery);

    console.log('🔄 Repairing booking counts in inventory for all hotels...');
    const fixBookedQuery = `
      UPDATE room_inventory ri
      SET booked_count = COALESCE((
        SELECT SUM(COALESCE(quantity, 1))
        FROM bookings b 
        WHERE b.hotel_id = ri.hotel_id 
          AND b.room_type_id = ri.room_type_id 
          AND ri.inventory_date >= b.check_in_date 
          AND ri.inventory_date < b.check_out_date 
          AND b.status IN ('CREATED', 'CONFIRMED', 'CHECKED_IN')
      ), 0);
    `;
    await client.query(fixBookedQuery);

    // System Configs Table
    console.log('🔄 Checking for system_configs table...');
    const sysConfigCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'system_configs'
      );
    `);
    if (!sysConfigCheck.rows[0].exists) {
      console.log('📦 Creating table: system_configs');
      await client.query(`
        CREATE TABLE system_configs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          config_key VARCHAR(100) UNIQUE NOT NULL,
          config_value TEXT,
          description TEXT,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Seed default configs
      await client.query(`
        INSERT INTO system_configs (config_key, config_value, description) VALUES 
        ('terms_of_service_url', 'https://example.com/terms', 'URL for the platform Terms of Service'),
        ('privacy_policy_url', 'https://example.com/privacy', 'URL for the platform Privacy Policy')
      `);
      console.log('✅ system_configs table created and seeded');
    }

    console.log('🔄 Checking for default SuperAdmin user...');
    const superAdminCheck = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        WHERE r.name = 'SUPER_ADMIN'
      )
    `);

    if (!superAdminCheck.rows[0].exists) {
      console.log('📦 Creating default SuperAdmin user (admin@hotelcms.com)...');
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash('Admin@123', 10);

      const userRes = await client.query(`
        INSERT INTO users (full_name, email, password_hash, phone)
        VALUES ('System Administrator', 'admin@hotelcms.com', $1, '+1234567890')
        RETURNING id
      `, [hashedPassword]);

      const superAdminRoleIdRes = await client.query(`SELECT id FROM roles WHERE name = 'SUPER_ADMIN'`);
      if (superAdminRoleIdRes.rows.length > 0) {
        await client.query(`
          INSERT INTO user_roles (user_id, role_id)
          VALUES ($1, $2)
        `, [userRes.rows[0].id, superAdminRoleIdRes.rows[0].id]);
        console.log('✅ Default SuperAdmin created successfully');
      } else {
        console.error('❌ Could not find SUPER_ADMIN role');
      }
    }

    console.log('✅ Inventory synced and verified successfully');
  } catch (error) {
    console.error('❌ Migration check failed:', error);
  } finally {
    client.release();
  }
};

pool.on('connect', () => {
  if (!isProduction) {
    console.log('✅ Database connected successfully');
  }
});

pool.on('error', (err) => {
  console.error('❌ Unexpected database error:', err);
  process.exit(-1);
});

// Test connection on startup
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection failed:', err);
    process.exit(-1);
  } else {
    if (!isProduction) {
      console.log('✅ Database timestamp:', res.rows[0].now);
    }
    // Run migrations after successful connection test
    ensureMigrations();
  }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  ensureMigrations
};
