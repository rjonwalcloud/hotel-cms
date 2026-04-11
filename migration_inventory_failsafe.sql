-- MIGRATION: Inventory System & Missing Core Columns
-- Failsafe: Uses IF NOT EXISTS and DO blocks to ensure idempotency.

DO $$ 
BEGIN
    -- 1. HOTEL_SETTINGS UPDATES
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hotel_settings' AND column_name='invoice_counter') THEN
        ALTER TABLE hotel_settings ADD COLUMN invoice_counter INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hotel_settings' AND column_name='invoice_prefix') THEN
        ALTER TABLE hotel_settings ADD COLUMN invoice_prefix VARCHAR(10);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hotel_settings' AND column_name='upi_id') THEN
        ALTER TABLE hotel_settings ADD COLUMN upi_id VARCHAR(100);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hotel_settings' AND column_name='bank_name') THEN
        ALTER TABLE hotel_settings ADD COLUMN bank_name VARCHAR(255);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hotel_settings' AND column_name='account_number') THEN
        ALTER TABLE hotel_settings ADD COLUMN account_number VARCHAR(100);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hotel_settings' AND column_name='ifsc_code') THEN
        ALTER TABLE hotel_settings ADD COLUMN ifsc_code VARCHAR(50);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hotel_settings' AND column_name='upi_qr_code') THEN
        ALTER TABLE hotel_settings ADD COLUMN upi_qr_code TEXT;
    END IF;

    -- 2. BOOKINGS UPDATES
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='invoice_number') THEN
        ALTER TABLE bookings ADD COLUMN invoice_number VARCHAR(50);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='payment_status') THEN
        ALTER TABLE bookings ADD COLUMN payment_status VARCHAR(20) DEFAULT 'UNPAID';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='payment_method') THEN
        ALTER TABLE bookings ADD COLUMN payment_method VARCHAR(50);
    END IF;

    -- 3. SERVICE_REQUESTS UPDATES
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='service_requests' AND column_name='is_billed') THEN
        ALTER TABLE service_requests ADD COLUMN is_billed BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='service_requests' AND column_name='invoice_number') THEN
        ALTER TABLE service_requests ADD COLUMN invoice_number VARCHAR(50);
    END IF;

    -- 4. SERVICE_CATEGORIES UPDATES
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='service_categories' AND column_name='is_restaurant') THEN
        ALTER TABLE service_categories ADD COLUMN is_restaurant BOOLEAN DEFAULT false;
    END IF;

END $$;

-- 5. NEW INVENTORY TABLES

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
    unit VARCHAR(20) NOT NULL, -- e.g., Pcs, Kg, Ltr, Pack
    min_stock_level DECIMAL(10, 2) DEFAULT 0,
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(hotel_id, po_number)
);

CREATE TABLE IF NOT EXISTS inventory_po_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID REFERENCES inventory_purchase_orders(id) ON DELETE CASCADE,
    item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
    quantity DECIMAL(12, 2) NOT NULL,
    unit_price DECIMAL(12, 2) NOT NULL,
    total_price DECIMAL(12, 2) NOT NULL,
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
    reference_id UUID, -- Can be PO ID, Breakage ID, etc.
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

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_inv_stock_hotel ON inventory_stock(hotel_id);
CREATE INDEX IF NOT EXISTS idx_inv_stock_item ON inventory_stock(item_id);
CREATE INDEX IF NOT EXISTS idx_inv_movements_item ON inventory_stock_movements(item_id);
CREATE INDEX IF NOT EXISTS idx_inv_movements_hotel ON inventory_stock_movements(hotel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inv_po_hotel ON inventory_purchase_orders(hotel_id, status);
CREATE INDEX IF NOT EXISTS idx_inv_expenses_hotel ON inventory_expenses(hotel_id, expense_date DESC);

-- 6. PERMISSIONS for Inventory System

INSERT INTO permissions (key, description, module) VALUES
('INVENTORY_VIEW', 'View inventory dashboard and stock levels', 'INVENTORY'),
('INVENTORY_MANAGE', 'Manage inventory items, categories, and stores', 'INVENTORY'),
('INVENTORY_STOCK_UPDATE', 'Manually adjust stock and perform transfers', 'INVENTORY'),
('INVENTORY_PO_MANAGE', 'Manage suppliers and purchase orders', 'INVENTORY'),
('INVENTORY_BREAKAGE_REPORT', 'Report item breakage or loss', 'INVENTORY'),
('INVENTORY_EXPENSE_MANAGE', 'Record and manage operational expenses', 'INVENTORY')
ON CONFLICT (key) DO NOTHING;

-- Map to HOTEL_ADMIN
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'HOTEL_ADMIN'
AND p.key IN (
    'INVENTORY_VIEW', 'INVENTORY_MANAGE', 'INVENTORY_STOCK_UPDATE', 
    'INVENTORY_PO_MANAGE', 'INVENTORY_BREAKAGE_REPORT', 'INVENTORY_EXPENSE_MANAGE'
)
ON CONFLICT DO NOTHING;

-- Map to STAFF (limited)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'STAFF'
AND p.key IN (
    'INVENTORY_VIEW', 'INVENTORY_BREAKAGE_REPORT'
)
ON CONFLICT DO NOTHING;

-- Map to SUPER_ADMIN (already covered by catch-all usually, but for consistency)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'SUPER_ADMIN'
AND p.key LIKE 'INVENTORY_%'
ON CONFLICT DO NOTHING;
