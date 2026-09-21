-- Hotel CMS - Complete PostgreSQL Schema
-- Run this file to set up the entire database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- IAM TABLES
-- ============================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    module VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Hotels table (needed before user_roles)
CREATE TABLE hotels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(255),
    description TEXT,
    gst_number VARCHAR(50),
    logo TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by UUID REFERENCES users(id),
    custom_permissions JSONB,
    hidden_menu_items JSONB DEFAULT '[]'::jsonb,
    UNIQUE(user_id, role_id, hotel_id)
);

CREATE TABLE role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(role_id, permission_id)
);

-- ============================================
-- POLICY & QUOTA TABLES
-- ============================================

CREATE TABLE policy_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) UNIQUE NOT NULL,
    scope VARCHAR(20) NOT NULL CHECK (scope IN ('GLOBAL', 'HOTEL')),
    description TEXT,
    default_max_value INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE hotel_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
    policy_limit_id UUID REFERENCES policy_limits(id) ON DELETE CASCADE,
    max_value INTEGER NOT NULL,
    set_by UUID REFERENCES users(id),
    set_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(hotel_id, policy_limit_id)
);

CREATE TABLE usage_counters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
    policy_limit_id UUID REFERENCES policy_limits(id) ON DELETE CASCADE,
    current_value INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(hotel_id, policy_limit_id)
);

-- ============================================
-- DOMAIN TABLES
-- ============================================

CREATE TABLE room_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    short_code VARCHAR(10),
    description TEXT,
    base_price DECIMAL(10, 2) NOT NULL,
    max_occupancy INTEGER NOT NULL,
    amenities JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(hotel_id, name)
);

CREATE TABLE amenities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    icon VARCHAR(50),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
    room_type_id UUID REFERENCES room_types(id) ON DELETE CASCADE,
    room_number VARCHAR(20) NOT NULL,
    floor INTEGER,
    status VARCHAR(20) DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'BLOCKED')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(hotel_id, room_number)
);

CREATE TABLE service_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_restaurant BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(hotel_id, name)
);

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

CREATE TABLE service_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
    category_id UUID REFERENCES service_categories(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    max_quantity INTEGER,
    dietary_type VARCHAR(20) DEFAULT 'ALL' CHECK (dietary_type IN ('VEG', 'NON_VEG', 'ALL')),
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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
    total_amount DECIMAL(10, 2) NOT NULL,
    paid_amount DECIMAL(10, 2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'CREATED' CHECK (status IN ('CREATED', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW', 'REFUNDED')),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_ref VARCHAR(30) UNIQUE,
    hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
    bulk_booking_id UUID REFERENCES bulk_bookings(id) ON DELETE SET NULL,
    room_id UUID REFERENCES rooms(id) ON DELETE SET NULL, -- Nullable for multi-room support
    room_type_id UUID REFERENCES room_types(id) ON DELETE SET NULL,
    guest_name VARCHAR(255) NOT NULL,
    guest_email VARCHAR(255),
    guest_phone VARCHAR(20) NOT NULL,
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    adults INTEGER DEFAULT 1,
    children INTEGER DEFAULT 0,
    quantity INTEGER DEFAULT 1,
    total_amount DECIMAL(10, 2),
    paid_amount DECIMAL(10, 2) DEFAULT 0,
    invoice_number VARCHAR(50),
    payment_status VARCHAR(20) DEFAULT 'UNPAID',
    payment_method VARCHAR(50),
    room_rate NUMERIC(10,2),
    room_subtotal NUMERIC(10,2),
    service_charge NUMERIC(10,2) DEFAULT 0,
    promo_discount DECIMAL(10,2) DEFAULT 0,
    coupon_discount DECIMAL(10,2) DEFAULT 0,
    applied_coupon VARCHAR(50),
    applied_promotion VARCHAR(150),
    rate_plan_name VARCHAR(100),
    rate_rule_name VARCHAR(150),
    status VARCHAR(20) DEFAULT 'CREATED' CHECK (status IN ('CREATED', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW', 'REFUNDED')),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE booking_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(booking_id, room_id)
);

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

CREATE TABLE booking_addons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    addon_id UUID REFERENCES addons(id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 1,
    price_at_booking DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE booking_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    from_status VARCHAR(20),
    to_status VARCHAR(20) NOT NULL,
    changed_by UUID REFERENCES users(id),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reason TEXT
);

CREATE TABLE booking_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES bookings(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    assigned_to UUID REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    priority VARCHAR(20) DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    due_date TIMESTAMP,
    created_by UUID REFERENCES users(id),
    comments TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE TABLE task_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    from_status VARCHAR(20),
    to_status VARCHAR(20) NOT NULL,
    changed_by UUID REFERENCES users(id),
    comments TEXT,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- SUBSCRIPTION TABLES
-- ============================================

CREATE TABLE subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    duration_days INTEGER NOT NULL DEFAULT 30,
    max_hotels INTEGER DEFAULT 1,
    max_rooms_per_hotel INTEGER DEFAULT 50,
    max_bookings_per_month INTEGER DEFAULT 100,
    max_staff_per_hotel INTEGER DEFAULT 20,
    features JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE hotel_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES subscription_plans(id),
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXPIRED', 'CANCELLED', 'SUSPENDED', 'PENDING')),
    start_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    end_date TIMESTAMP NOT NULL,
    auto_renew BOOLEAN DEFAULT false,
    activated_by UUID REFERENCES users(id),
    cancelled_at TIMESTAMP,
    cancelled_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE subscription_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID REFERENCES hotel_subscriptions(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    from_status VARCHAR(20),
    to_status VARCHAR(20),
    changed_by UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- BOOKING CHANNEL TABLES
-- ============================================

CREATE TABLE booking_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    channel_type VARCHAR(50) NOT NULL CHECK (channel_type IN ('OYO', 'BOOKING_COM', 'MAKEMYTRIP', 'GOIBIBO', 'AGODA', 'EXPEDIA', 'AIRBNB', 'DIRECT', 'OTHER')),
    api_key VARCHAR(500),
    api_secret VARCHAR(500),
    property_id VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    commission_rate DECIMAL(5, 2) DEFAULT 0,
    config JSONB DEFAULT '{}',
    last_sync_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(hotel_id, channel_type)
);

CREATE TABLE channel_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID REFERENCES booking_channels(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
    external_booking_id VARCHAR(255) NOT NULL,
    channel_type VARCHAR(50) NOT NULL,
    guest_name VARCHAR(255) NOT NULL,
    guest_email VARCHAR(255),
    guest_phone VARCHAR(20),
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    room_count INTEGER DEFAULT 1,
    total_amount DECIMAL(10, 2) NOT NULL,
    commission_amount DECIMAL(10, 2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW')),
    raw_data JSONB,
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- QR CODE TABLES
-- ============================================

CREATE TABLE room_qr_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
    qr_token VARCHAR(100) UNIQUE NOT NULL,
    qr_data TEXT,
    is_active BOOLEAN DEFAULT true,
    scan_count INTEGER DEFAULT 0,
    last_scanned_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(room_id)
);

CREATE TABLE service_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
    room_id UUID REFERENCES rooms(id),
    qr_code_id UUID REFERENCES room_qr_codes(id),
    service_item_id UUID REFERENCES service_items(id),
    guest_name VARCHAR(255),
    guest_phone VARCHAR(20),
    quantity INTEGER DEFAULT 1,
    notes TEXT,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    booking_id UUID REFERENCES bookings(id),
    booking_ref VARCHAR(50),
    order_group_id UUID,
    is_billed BOOLEAN DEFAULT false,
    invoice_number VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sr_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID REFERENCES service_requests(id) ON DELETE CASCADE,
    from_status VARCHAR(20),
    to_status VARCHAR(20) NOT NULL,
    changed_by UUID REFERENCES users(id),
    note TEXT,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE booking_guests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    age INTEGER,
    id_proof_type VARCHAR(50),
    id_proof_number VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE hotel_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE UNIQUE,
    currency_code VARCHAR(10) DEFAULT 'USD',
    currency_symbol VARCHAR(5) DEFAULT '$',
    task_automation_enabled BOOLEAN DEFAULT true,
    invoice_counter INTEGER DEFAULT 0,
    invoice_prefix VARCHAR(10),
    upi_id VARCHAR(100),
    bank_name VARCHAR(255),
    account_number VARCHAR(100),
    ifsc_code VARCHAR(50),
    upi_qr_code TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- REVENUE & TAX TABLES
-- ============================================

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

CREATE TABLE promo_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
    coupon_id UUID REFERENCES coupon_codes(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    discount_amount DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE system_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value TEXT,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- AUDIT & LOGS
-- ============================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID REFERENCES hotels(id),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    old_data JSONB,
    new_data JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- LOST & FOUND
-- ============================================

CREATE TABLE lost_found_items (
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

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_audit_logs_hotel ON audit_logs(hotel_id, created_at DESC);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_bookings_hotel_dates ON bookings(hotel_id, check_in_date, check_out_date);
CREATE INDEX idx_rooms_hotel_status ON rooms(hotel_id, status);
CREATE INDEX idx_tasks_assigned ON tasks(assigned_to, status);
CREATE INDEX idx_hotel_subscriptions_hotel ON hotel_subscriptions(hotel_id, status);
CREATE INDEX idx_hotel_subscriptions_dates ON hotel_subscriptions(end_date, status);
CREATE INDEX idx_channel_bookings_hotel ON channel_bookings(hotel_id, created_at DESC);
CREATE INDEX idx_channel_bookings_channel ON channel_bookings(channel_id, status);
CREATE INDEX idx_room_qr_codes_hotel ON room_qr_codes(hotel_id);
CREATE INDEX idx_service_requests_hotel ON service_requests(hotel_id, status);
CREATE INDEX idx_service_requests_room ON service_requests(room_id, status);
CREATE INDEX idx_room_inventory_dates ON room_inventory(hotel_id, room_type_id, inventory_date);
CREATE INDEX idx_booking_taxes_booking_id ON booking_taxes(booking_id);
CREATE INDEX idx_rate_plans_hotel ON rate_plans(hotel_id);
CREATE INDEX idx_rate_rules_hotel ON rate_rules(hotel_id);
CREATE INDEX idx_rate_rules_dates ON rate_rules(start_date, end_date);
CREATE INDEX idx_rate_rules_room_type ON rate_rules(room_type_id);
CREATE INDEX idx_promotions_hotel ON promotions(hotel_id);
CREATE INDEX idx_promotions_dates ON promotions(start_date, end_date);
CREATE INDEX idx_coupon_codes_hotel ON coupon_codes(hotel_id);
CREATE INDEX idx_coupon_codes_code ON coupon_codes(code);
CREATE INDEX idx_promo_usage_coupon ON promo_usage(coupon_id);
CREATE INDEX idx_booking_events_booking_id ON booking_events(booking_id);
CREATE INDEX idx_lost_found_hotel ON lost_found_items(hotel_id, created_at DESC);
CREATE INDEX idx_lost_found_status ON lost_found_items(hotel_id, status);
CREATE INDEX idx_lost_found_type ON lost_found_items(hotel_id, type);

-- ============================================
-- SEED DATA - ROLES
-- ============================================

INSERT INTO roles (name, description) VALUES
('SUPER_ADMIN', 'Full system access - manages all hotels and settings'),
('HOTEL_ADMIN', 'Hotel owner - manages their hotel completely'),
('STAFF', 'Hotel staff - operational tasks only');

-- ============================================
-- SEED DATA - PERMISSIONS
-- ============================================

-- IAM Permissions
INSERT INTO permissions (key, description, module) VALUES
('USER_CREATE', 'Create new users', 'IAM'),
('USER_UPDATE', 'Update user details', 'IAM'),
('USER_DELETE', 'Delete users', 'IAM'),
('USER_VIEW', 'View users', 'IAM'),
('ROLE_ASSIGN', 'Assign roles to users', 'IAM'),
('LIMIT_OVERRIDE', 'Override quota limits (Super Admin only)', 'IAM');

-- Hotel Permissions
INSERT INTO permissions (key, description, module) VALUES
('HOTEL_CREATE', 'Create new hotels', 'HOTEL'),
('HOTEL_UPDATE', 'Update hotel details', 'HOTEL'),
('HOTEL_DELETE', 'Delete hotels', 'HOTEL'),
('HOTEL_VIEW', 'View hotel details', 'HOTEL');

-- Room Permissions
INSERT INTO permissions (key, description, module) VALUES
('ROOM_CREATE', 'Create new rooms', 'ROOM'),
('ROOM_UPDATE', 'Update room details', 'ROOM'),
('ROOM_DELETE', 'Delete rooms', 'ROOM'),
('ROOM_VIEW', 'View rooms', 'ROOM'),
('ROOM_UPDATE_STATUS', 'Update room status only', 'ROOM');

-- Booking Permissions
INSERT INTO permissions (key, description, module) VALUES
('BOOKING_CREATE', 'Create bookings', 'BOOKING'),
('BOOKING_UPDATE', 'Update bookings', 'BOOKING'),
('BOOKING_CANCEL', 'Cancel bookings', 'BOOKING'),
('BOOKING_VIEW', 'View bookings', 'BOOKING'),
('BOOKING_CHECKIN', 'Check-in guests', 'BOOKING'),
('BOOKING_CHECKOUT', 'Check-out guests', 'BOOKING');

-- Service Permissions
INSERT INTO permissions (key, description, module) VALUES
('SERVICE_CREATE', 'Create services', 'SERVICE'),
('SERVICE_UPDATE', 'Update services', 'SERVICE'),
('SERVICE_DELETE', 'Delete services', 'SERVICE'),
('SERVICE_VIEW', 'View services', 'SERVICE');

-- Task Permissions
INSERT INTO permissions (key, description, module) VALUES
('TASK_CREATE', 'Create tasks', 'TASK'),
('TASK_ASSIGN', 'Assign tasks', 'TASK'),
('TASK_UPDATE', 'Update task status', 'TASK'),
('TASK_VIEW', 'View tasks', 'TASK');

-- Report Permissions
INSERT INTO permissions (key, description, module) VALUES
('REPORT_VIEW', 'View reports', 'REPORT'),
('AUDIT_VIEW', 'View audit logs', 'AUDIT');

-- QR Code Permissions
INSERT INTO permissions (key, description, module) VALUES
('QRCODE_GENERATE', 'Generate QR codes for rooms', 'QRCODE'),
('QRCODE_VIEW', 'View QR codes', 'QRCODE'),
('QRCODE_DELETE', 'Delete QR codes', 'QRCODE');

-- Subscription Permissions
INSERT INTO permissions (key, description, module) VALUES
('SUBSCRIPTION_CREATE', 'Create subscription plans', 'SUBSCRIPTION'),
('SUBSCRIPTION_UPDATE', 'Update subscriptions', 'SUBSCRIPTION'),
('SUBSCRIPTION_VIEW', 'View subscriptions', 'SUBSCRIPTION'),
('SUBSCRIPTION_ACTIVATE', 'Activate hotel subscriptions', 'SUBSCRIPTION'),
('SUBSCRIPTION_CANCEL', 'Cancel subscriptions', 'SUBSCRIPTION');

-- Booking Manager Permissions
INSERT INTO permissions (key, description, module) VALUES
('CHANNEL_CREATE', 'Create booking channels', 'CHANNEL'),
('CHANNEL_UPDATE', 'Update booking channels', 'CHANNEL'),
('CHANNEL_DELETE', 'Delete booking channels', 'CHANNEL'),
('CHANNEL_VIEW', 'View booking channels', 'CHANNEL'),
('CHANNEL_SYNC', 'Sync channel bookings', 'CHANNEL'),
('BULK_BOOKING_CREATE', 'Create bulk bookings', 'BOOKING'),
('BULK_BOOKING_VIEW', 'View bulk bookings', 'BOOKING'),
('SERVICE_REQUEST_VIEW', 'View service requests', 'SERVICE'),
('SERVICE_REQUEST_UPDATE', 'Update service requests', 'SERVICE');

-- Lost & Found Permissions
INSERT INTO permissions (key, description, module) VALUES
('LOST_FOUND_VIEW', 'View lost & found items', 'LOST_FOUND'),
('LOST_FOUND_CREATE', 'Create lost & found entries', 'LOST_FOUND'),
('LOST_FOUND_UPDATE', 'Update lost & found entries', 'LOST_FOUND'),
('LOST_FOUND_DELETE', 'Delete lost & found entries', 'LOST_FOUND');

-- ============================================
-- SEED DATA - ROLE PERMISSIONS MAPPING
-- ============================================

-- Super Admin gets ALL permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'SUPER_ADMIN';

-- Hotel Admin permissions (per image: Room CRUD, Bookings, Booking Manager, QR Code, Services)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'HOTEL_ADMIN'
AND p.key NOT IN (
    'LIMIT_OVERRIDE', 'HOTEL_CREATE', 'HOTEL_DELETE',
    'SUBSCRIPTION_CREATE', 'SUBSCRIPTION_ACTIVATE', 'SUBSCRIPTION_CANCEL',
    'AUDIT_VIEW'
);

-- Staff permissions (per image: Bookings Create/Update/Cancel only)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'STAFF'
AND p.key IN (
    'ROOM_VIEW',
    'ROOM_UPDATE_STATUS',
    'BOOKING_CREATE',
    'BOOKING_UPDATE',
    'BOOKING_CANCEL',
    'BOOKING_VIEW',
    'BOOKING_CHECKIN',
    'BOOKING_CHECKOUT',
    'SERVICE_VIEW',
    'SERVICE_REQUEST_VIEW',
    'SERVICE_REQUEST_UPDATE',
    'TASK_VIEW',
    'TASK_UPDATE',
    'LOST_FOUND_VIEW',
    'LOST_FOUND_CREATE',
    'LOST_FOUND_UPDATE'
);

-- ============================================
-- SEED DATA - POLICY LIMITS
-- ============================================

INSERT INTO policy_limits (key, scope, description, default_max_value) VALUES
('hotel_create', 'GLOBAL', 'Maximum hotels a user can create', 1),
('room_create', 'HOTEL', 'Maximum rooms per hotel', 50),
('user_create', 'HOTEL', 'Maximum users per hotel', 20),
('booking_create', 'HOTEL', 'Maximum active bookings', 100);

-- ============================================
-- SEED DATA - SAMPLE SUPER ADMIN USER
-- ============================================
-- Password: Admin@123 (hashed with bcrypt)

INSERT INTO users (email, password_hash, full_name, phone) VALUES
('admin@hotelcms.com', '$2b$10$y6FU0cVGwXBvO2hA7B987RqlPUz3PzwH2cjxaLb.9apO', 'System Administrator', '+1234567890');

-- Assign Super Admin role
INSERT INTO user_roles (user_id, role_id, hotel_id)
SELECT u.id, r.id, NULL
FROM users u
CROSS JOIN roles r
WHERE u.email = 'admin@hotelcms.com'
AND r.name = 'SUPER_ADMIN';

-- ============================================
-- SEED DATA - SUBSCRIPTION PLANS
-- ============================================

INSERT INTO subscription_plans (name, description, price, duration_days, max_hotels, max_rooms_per_hotel, max_bookings_per_month, max_staff_per_hotel, features) VALUES
('Free', 'Basic plan for getting started', 0, 30, 1, 10, 50, 5, '["Basic room management", "Manual bookings", "Basic reports"]'),
('Starter', 'For small hotels and guesthouses', 29.99, 30, 1, 25, 200, 10, '["Room management", "Booking management", "QR codes", "Basic services"]'),
('Professional', 'For medium-sized hotels', 79.99, 30, 3, 100, 1000, 30, '["All Starter features", "Booking channels", "Advanced reports", "Priority support", "Service management"]'),
('Enterprise', 'For large hotel chains', 199.99, 30, 10, 500, 5000, 100, '["All Professional features", "Custom integrations", "Dedicated support", "White-label", "API access"]');

-- ============================================
-- SEED DATA - SYSTEM CONFIGS
-- ============================================

INSERT INTO system_configs (config_key, config_value, description) VALUES 
('terms_of_service_url', 'https://example.com/terms', 'URL for the platform Terms of Service'),
('privacy_policy_url', 'https://example.com/privacy', 'URL for the platform Privacy Policy');

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hotels_updated_at BEFORE UPDATE ON hotels
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON rooms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hotel_subscriptions_updated_at BEFORE UPDATE ON hotel_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscription_plans_updated_at BEFORE UPDATE ON subscription_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_booking_channels_updated_at BEFORE UPDATE ON booking_channels
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_channel_bookings_updated_at BEFORE UPDATE ON channel_bookings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_room_qr_codes_updated_at BEFORE UPDATE ON room_qr_codes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_service_requests_updated_at BEFORE UPDATE ON service_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_addons_updated_at BEFORE UPDATE ON addons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lost_found_items_updated_at BEFORE UPDATE ON lost_found_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Prevent audit log modification
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are immutable and cannot be modified or deleted';
END;
$$ language 'plpgsql';

CREATE TRIGGER prevent_audit_update BEFORE UPDATE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();

CREATE TRIGGER prevent_audit_delete BEFORE DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();

-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- User with roles and permissions
CREATE VIEW user_permissions_view AS
SELECT 
    u.id as user_id,
    u.email,
    u.full_name,
    r.name as role_name,
    ur.hotel_id,
    json_agg(DISTINCT p.key) as permissions
FROM users u
JOIN user_roles ur ON ur.user_id = u.id
JOIN roles r ON r.id = ur.role_id
JOIN role_permissions rp ON rp.role_id = r.id
JOIN permissions p ON p.id = rp.permission_id
WHERE u.is_active = true
GROUP BY u.id, u.email, u.full_name, r.name, ur.hotel_id;

-- Room availability
CREATE VIEW room_availability_view AS
SELECT 
    r.id as room_id,
    r.hotel_id,
    r.room_number,
    rt.name as room_type,
    rt.base_price,
    r.status,
    CASE 
        WHEN r.status = 'AVAILABLE' THEN true
        ELSE false
    END as is_available
FROM rooms r
JOIN room_types rt ON rt.id = r.room_type_id;

-- ============================================
-- INVENTORY TABLES
-- ============================================

CREATE TABLE inventory_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(hotel_id, name)
);

CREATE TABLE inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
    category_id UUID REFERENCES inventory_categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(50),
    unit VARCHAR(20) NOT NULL,
    min_stock_level DECIMAL(10, 2) DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(hotel_id, name, sku)
);

CREATE TABLE inventory_stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(hotel_id, name)
);

CREATE TABLE inventory_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
    store_id UUID REFERENCES inventory_stores(id) ON DELETE CASCADE,
    item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
    quantity DECIMAL(12, 2) DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(store_id, item_id)
);

CREATE TABLE inventory_suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    phone VARCHAR(20),
    email VARCHAR(255),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE inventory_purchase_orders (
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

CREATE TABLE inventory_po_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID REFERENCES inventory_purchase_orders(id) ON DELETE CASCADE,
    item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
    quantity DECIMAL(12, 2) NOT NULL,
    unit_price DECIMAL(12, 2) NOT NULL,
    total_price DECIMAL(12, 2) NOT NULL,
    UNIQUE(po_id, item_id)
);

CREATE TABLE inventory_stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
    item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
    from_store_id UUID REFERENCES inventory_stores(id) ON DELETE SET NULL,
    to_store_id UUID REFERENCES inventory_stores(id) ON DELETE SET NULL,
    quantity DECIMAL(12, 2) NOT NULL,
    movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('IN', 'OUT', 'TRANSFER', 'ADJUSTMENT', 'PO_RECEIVE', 'BREAKAGE', 'SALE')),
    reference_id UUID,
    performed_by UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE inventory_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    description TEXT,
    expense_date DATE DEFAULT CURRENT_DATE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE inventory_breakage_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
    item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
    store_id UUID REFERENCES inventory_stores(id) ON DELETE CASCADE,
    quantity DECIMAL(12, 2) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('BREAKAGE', 'MISPLACEMENT', 'THEFT')),
    reported_by UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INDEXES (CONTINUED)
-- ============================================

CREATE INDEX idx_inv_stock_hotel ON inventory_stock(hotel_id);
CREATE INDEX idx_inv_stock_item ON inventory_stock(item_id);
CREATE INDEX idx_inv_movements_item ON inventory_stock_movements(item_id);
CREATE INDEX idx_inv_movements_hotel ON inventory_stock_movements(hotel_id, created_at DESC);
CREATE INDEX idx_inv_po_hotel ON inventory_purchase_orders(hotel_id, status);
CREATE INDEX idx_inv_expenses_hotel ON inventory_expenses(hotel_id, expense_date DESC);

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '✅ Hotel CMS Database Schema Created Successfully!';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Tables Created:';
    RAISE NOTICE '   - IAM: users, roles, permissions, user_roles, role_permissions';
    RAISE NOTICE '   - Policy: policy_limits, hotel_limits, usage_counters';
    RAISE NOTICE '   - Domain: hotels, rooms, room_types, room_qr_codes, amenities, service_categories, service_items, addons, bookings, booking_rooms, booking_addons, room_inventory, bulk_bookings';
    RAISE NOTICE '   - Operations: tasks, task_history, service_requests, sr_history, booking_status_history, booking_events';
    RAISE NOTICE '   - Revenue & Tax: taxes, booking_taxes, rate_plans, rate_rules, promotions, coupon_codes, promo_usage';
    RAISE NOTICE '   - System: booking_channels, channel_bookings, hotel_settings, system_configs, hotel_subscriptions, subscription_plans';
    RAISE NOTICE '   - Inventory: inventory_categories, inventory_items, inventory_stores, inventory_stock, inventory_suppliers, inventory_purchase_orders, inventory_po_items, inventory_stock_movements, inventory_expenses, inventory_breakage_reports';
    RAISE NOTICE '   - Lost & Found: lost_found_items';
    RAISE NOTICE '   - Audit: audit_logs';
    RAISE NOTICE '';
    RAISE NOTICE '👤 Default Super Admin:';
    RAISE NOTICE '   Email: admin@hotelcms.com';
    RAISE NOTICE '   Password: Admin@123';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 Next Steps:';
    RAISE NOTICE '   1. Update admin password';
    RAISE NOTICE '   2. Create your first hotel';
    RAISE NOTICE '   3. Configure hotel limits';
END $$;
