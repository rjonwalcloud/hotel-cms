-- Lost & Found Items Table Migration
-- Run: psql -U <user> -d <db> -f migrate_lost_found.sql

CREATE TABLE IF NOT EXISTS lost_found_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
    type VARCHAR(10) NOT NULL CHECK (type IN ('FOUND', 'LOST')),
    location VARCHAR(50) NOT NULL CHECK (location IN ('ROOM', 'LOBBY', 'RESTAURANT', 'POOL', 'GYM', 'PARKING', 'CONFERENCE', 'OTHER')),
    location_detail VARCHAR(255),
    found_lost_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    item_category VARCHAR(50) NOT NULL CHECK (item_category IN ('ELECTRONICS', 'BAG', 'WALLET', 'JEWELLERY', 'CLOTHING', 'DOCUMENTS', 'KEYS', 'OTHERS')),
    item_description TEXT NOT NULL,
    item_cost DECIMAL(10, 2),
    contact_name VARCHAR(255),
    contact_phone VARCHAR(20),
    contact_email VARCHAR(255),
    booking_pnr VARCHAR(50),
    notes TEXT,
    status VARCHAR(20) DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLAIMED', 'RETURNED', 'DISPOSED')),
    reported_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lost_found_hotel ON lost_found_items(hotel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lost_found_status ON lost_found_items(hotel_id, status);
CREATE INDEX IF NOT EXISTS idx_lost_found_type ON lost_found_items(hotel_id, type);

-- Add permissions for Lost & Found
INSERT INTO permissions (key, description, module) VALUES
('LOST_FOUND_VIEW', 'View lost & found items', 'LOST_FOUND'),
('LOST_FOUND_CREATE', 'Create lost & found entries', 'LOST_FOUND'),
('LOST_FOUND_UPDATE', 'Update lost & found entries', 'LOST_FOUND'),
('LOST_FOUND_DELETE', 'Delete lost & found entries', 'LOST_FOUND')
ON CONFLICT (key) DO NOTHING;

-- Grant to HOTEL_ADMIN
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'HOTEL_ADMIN' AND p.module = 'LOST_FOUND'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Grant view & create to STAFF
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'STAFF' AND p.key IN ('LOST_FOUND_VIEW', 'LOST_FOUND_CREATE', 'LOST_FOUND_UPDATE')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Grant to SUPER_ADMIN
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'SUPER_ADMIN' AND p.module = 'LOST_FOUND'
ON CONFLICT (role_id, permission_id) DO NOTHING;

DO $$ BEGIN RAISE NOTICE '✅ Lost & Found migration complete!'; END $$;
