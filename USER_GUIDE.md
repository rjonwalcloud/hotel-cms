# Hotel CMS — User Guide

> **Multi-Tenant Hotel Management SaaS**
> Full-stack: Node.js + React | Deployed on Render | PostgreSQL

---

## Table of Contents

1. [Features Overview](#1-features-overview)
2. [Installation & Deployment on Render](#2-installation--deployment-on-render)
3. [Default Credentials & First Login](#3-default-credentials--first-login)
4. [Super Admin Guide](#4-super-admin-guide)
   - 4.1 [Managing Hotels (CRUD)](#41-managing-hotels-crud)
   - 4.2 [Managing Users (CRUD)](#42-managing-users-crud)
   - 4.3 [Subscription Plans & Quotas](#43-subscription-plans--quotas)
   - 4.4 [Global Audit Logs](#44-global-audit-logs)
   - 4.5 [System Backup](#45-system-backup)
   - 4.6 [Support Settings](#46-support-settings)
5. [Hotel Admin Guide](#5-hotel-admin-guide)
   - 5.1 [Dashboard](#51-dashboard)
   - 5.2 [Room Types (Create First!)](#52-room-types-create-first)
   - 5.3 [Rooms](#53-rooms)
   - 5.4 [Amenities](#54-amenities)
   - 5.5 [Bookings: Full Lifecycle](#55-bookings-full-lifecycle)
   - 5.6 [QR Codes & Room Services](#56-qr-codes--room-services)
   - 5.7 [Service Requests (SR) — Booking-Gated](#57-service-requests-sr--booking-gated)
   - 5.8 [Tasks](#58-tasks)
   - 5.9 [Rate Plans & Promotions](#59-rate-plans--promotions)
   - 5.10 [Currency & Tax Settings](#510-currency--tax-settings)
   - 5.11 [Booking Manager (Channels)](#511-booking-manager-channels)
   - 5.12 [Bulk Bookings](#512-bulk-bookings)
   - 5.13 [Room Inventory & Forecast](#513-room-inventory--forecast)
   - 5.14 [Lost & Found](#514-lost--found)
   - 5.15 [Item Inventory System (5 Modules)](#515-item-inventory-system-5-modules)
   - 5.16 [Support Hub](#516-support-hub)
6. [Staff Guide](#6-staff-guide)
   - 6.1 [Logging In](#61-logging-in)
   - 6.2 [Staff Dashboard](#62-staff-dashboard)
   - 6.3 [Features Available to Staff](#63-features-available-to-staff)
7. [Guest QR Experience](#7-guest-qr-experience)
8. [Roles & Permissions Reference](#8-roles--permissions-reference)

---

## 1. Features Overview

| Feature | Description |
|---------|-------------|
| **Multi-tenant Hotels** | SuperAdmin creates and manages multiple hotels, each with its own admin and staff |
| **Room Management** | Room types → Rooms → Floor/status management |
| **Booking Lifecycle** | Create → Confirm → Check-In → Check-Out (with billing, taxes, coupons) |
| **QR Room Services** | Generate QR codes for rooms; guests scan to order services |
| **SR-Booking Integration** | Service requests only available when room has an active (checked-in) booking; each SR linked to booking PNR |
| **Guest Order History** | Guests see their orders + statuses via QR "My Orders" tab |
| **Checkout Guard** | Checkout is blocked if pending service requests exist for the room (prominent modal alert) |
| **Itemized Invoicing** | Detailed tax itemization immediately below each charge (Room, Addon, Service Request) |
| **Service Grouping** | Similar service items are consolidated (e.g., "Burger x2") for a clean invoice layout |
| **Promotions & Coupons** | Percentage/flat discount coupons with usage limits |
| **Taxes** | Per-hotel tax configuration (GST, VAT, etc.) with inclusive/exclusive support |
| **Audit Logging** | Immutable action logs for all critical operations |
| **Staff Dashboard** | Today's check-ins, check-outs, pending SRs, pending tasks at a glance |
| **Role-Based Access** | SuperAdmin, HotelAdmin, Staff — each with granular permissions |
| **SaaS Subscriptions** | Plan-based limits (rooms, bookings) per hotel |
| **Room Forecast** | 30-day visual availability calendar with occupancy stats |
| **Item Inventory** | Full management of hotel supplies, stock, POs, and expenses |
| **Lost & Found** | Detailed tracking of lost/found items with category, cost, and contact info |
| **Support Hub** | Centralized contact points (Phone/Email/WA) configured per hotel with unique HotelID |

---

## 2. Installation & Deployment on Render

### Prerequisites
- A [Render](https://render.com) account
- A GitHub repository with the Hotel CMS codebase

### Step-by-Step Deployment

#### A. Create PostgreSQL Database
1. Go to **Render Dashboard → New → PostgreSQL**
2. Name: `hotel-cms-db` (or any name)
3. Region: Choose the closest to your users
4. Plan: Free / Starter
5. Click **Create Database**
6. Copy the **Internal Database URL** — you'll need it as `DATABASE_URL`

#### B. Deploy Backend (Web Service)
1. Go to **Render Dashboard → New → Web Service**
2. Connect your GitHub repo
3. Configure:
   - **Name**: `hotel-cms-api`
   - **Root Directory**: `backend`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Add **Environment Variables**:

   | Variable | Value |
   |----------|-------|
   | `DATABASE_URL` | (paste from step A) |
   | `JWT_SECRET` | (any strong random string, e.g. `my-super-secret-jwt-key-123!`) |
   | `NODE_ENV` | `production` |
   | `CORS_ORIGIN` | `https://your-frontend-url.onrender.com` (set after frontend deploy) |

5. Click **Create Web Service**
6. Note the deployed URL (e.g., `https://hotel-cms-api.onrender.com`)

#### C. Deploy Frontend (Static Site)
1. Go to **Render Dashboard → New → Static Site**
2. Connect the same GitHub repo
3. Configure:
   - **Name**: `hotel-cms-frontend`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
4. Add **Environment Variable**:

   | Variable | Value |
   |----------|-------|
   | `VITE_API_URL` | `https://hotel-cms-api.onrender.com/api` |

5. Add **Rewrite Rule** (under Redirects/Rewrites):
   - Source: `/*`
   - Destination: `/index.html`
   - Type: **Rewrite**
   
   > This is critical for SPA routing — without it, direct URL access returns 404.

6. Click **Create Static Site**

#### D. Update CORS
1. Go back to the **Backend service → Environment**
2. Set `CORS_ORIGIN` to your frontend URL (e.g., `https://hotel-cms-frontend.onrender.com`)
3. Save → service will redeploy

#### E. Database Auto-Setup
The database tables are **automatically created** on first backend startup via `database.js`. No manual SQL migration is needed.

---

## 3. Default Credentials & First Login

The system automatically creates a default **Super Admin** account on the first startup if no users exist in the database.

### Default Super Admin Credentials:
- **Email**: `admin@hotelcms.com`
- **Password**: `Admin@123`

You no longer need to manually execute SQL updates to assign the `SUPER_ADMIN` role or use a registration page.

### First Login Flow
1. Go to your frontend URL: `https://your-frontend.onrender.com/login`
2. Enter the default credentials above.
3. You will be redirected to the **Super Admin Dashboard**.
4. **Important**: Change the default password immediately after logging in.

> **Note:** The public registration feature is completely disabled. All other users (Hotel Admins, Staff) must be created directly by the Super Admin from the User Management dashboard.

---

## 4. Super Admin Guide

The Super Admin has full system access: managing hotels, users, subscriptions, quotas, audit logs, and system backups.

### 4.1 Managing Hotels (CRUD)

**Navigate to**: Admin → Hotels

#### Create a Hotel
1. Click **"Create Hotel"**
2. Fill in:
   - **Hotel Name** (required)
   - **Address**, **City**, **State**, **Country**
   - **Phone**, **Email**
   - **Short Code** (unique identifier, e.g., `HTL01`)
   - **Hotel ID** (Automatically generated 10-digit alphanumeric code for support)
   - **GST Number** (optional, for tax invoicing)
3. Click **Save**

#### Edit a Hotel
1. Click the **Edit** icon (pencil) on any hotel row
2. Modify the fields
3. Click **Update**

#### Deactivate a Hotel
1. Click the **toggle** or **deactivate** action to set the hotel as inactive
2. Inactive hotels cannot be accessed by their admins/staff

### 4.2 Managing Users (CRUD)

**Navigate to**: Admin → Users

#### Create a User
1. Click **"Add User"**
2. Fill in:
   - **Full Name**, **Email**, **Phone**
   - **Password** (min 6 characters)
   - **Role**: `HOTEL_ADMIN` or `STAFF`
   - **Hotel**: Select the hotel to assign (required for HotelAdmin/Staff)
3. Click **Create**

#### Assign Roles & Permissions
- **HOTEL_ADMIN**: Gets all hotel-scoped permissions automatically
- **STAFF**: Gets mandatory base permissions (`TASK_VIEW`, `TASK_UPDATE`, `SERVICE_REQUEST_VIEW`, `SERVICE_REQUEST_UPDATE`) plus any additional custom permissions you check

#### Edit a User
1. Click **Edit** on a user row
2. Change name, email, role, permissions
3. Click **Update**

#### Deactivate a User
1. Toggle the **Active** switch
2. Deactivated users are immediately logged out of all sessions

### 4.3 Subscription Plans & Quotas

**Navigate to**: Admin → Subscriptions / Quotas

- **Plans**: Create subscription tiers (Free, Basic, Premium) with limits on rooms, bookings, etc.
- **Quotas**: Set per-hotel resource limits. The system enforces these via middleware before allowing resource creation.

### 4.4 Global Audit Logs

**Navigate to**: Admin → Audit

View immutable logs of all critical system actions: user logins, bookings, status changes, etc. Supports filtering and CSV export.

### 4.5 System Backup

**Navigate to**: Admin → System

Download a full database backup (SQL dump) for disaster recovery.

### 4.6 Support Settings

**Navigate to**: Admin → Support Settings

1. Select a **Hotel** from the sidebar list.
2. The hotel's unique **Hotel ID** (10-digit) will be displayed in the header.
3. Configure the following contact points:
   - **Support Phone**: Direct helpline number.
   - **Support Email**: Official support email address.
   - **WhatsApp Business**: Phone number (format: country code + number, e.g., `18001234567`).
4. Click **Save Changes**. These details will immediately appear in the hotel's Support Hub.

---

## 5. Hotel Admin Guide

Hotel Admins manage everything within their assigned hotel: rooms, bookings, services, QR codes, tasks, rates, promotions, and settings.

### 5.1 Dashboard

The Hotel Admin dashboard shows:
- **Today's Stats**: Check-ins, check-outs, revenue
- **Room Occupancy**: Available vs occupied rooms
- **Recent Bookings**: Latest booking activity
- **Charts**: Revenue and occupancy trends

### 5.2 Room Types (Create First!)

**Navigate to**: Hotel → Room Types

> ⚠️ **You must create Room Types BEFORE creating Rooms.** Each room belongs to a room type.

#### Create a Room Type
1. Click **"Add Room Type"**
2. Fill in:
   - **Type Name**: e.g., "Deluxe", "Standard", "Suite"
   - **Base Price**: The default per-night rate
   - **Max Occupancy**: Maximum guests allowed
   - **Description**: Optional details about the room type
3. Click **Save**

#### Example Room Types
| Name | Base Price | Max Occupancy |
|------|-----------|---------------|
| Standard | ₹2,000 | 2 |
| Deluxe | ₹4,000 | 3 |
| Suite | ₹8,000 | 4 |
| Presidential Suite | ₹15,000 | 6 |

### 5.3 Rooms

**Navigate to**: Hotel → Rooms

> **Prerequisite**: At least one Room Type must exist.

#### Create a Room
1. Click **"Add Room"**
2. Fill in:
   - **Room Number**: e.g., "101", "A-201"
   - **Floor**: e.g., "1", "2", "Ground"
   - **Room Type**: Select from previously created room types
   - **Status**: Available (default), Maintenance, or Blocked
3. Click **Save**

#### Room Statuses
| Status | Meaning |
|--------|---------|
| `AVAILABLE` | Ready for booking |
| `OCCUPIED` | Guest checked in |
| `MAINTENANCE` | Under repair/cleaning |
| `BLOCKED` | Temporarily unavailable |

### 5.4 Amenities

**Navigate to**: Hotel → Amenities

Add amenities like WiFi, TV, AC, Mini Bar, etc. These can be associated with room types for display on the booking website.

### 5.5 Bookings: Full Lifecycle

**Navigate to**: Hotel → Bookings

#### Create a Booking
1. Click **"New Booking"**
2. Fill in:
   - **Guest Name**, **Email**, **Phone**
   - **Room Type** → select available rooms
   - **Check-in Date** and **Check-out Date**
   - **Adults** / **Children** count
3. Click **Create**

#### Booking Status Flow

```
PENDING → CONFIRMED → CHECKED_IN → CHECKED_OUT
                    ↘ CANCELLED
```

| Action | Status Change | How |
|--------|--------------|-----|
| **Confirm** | PENDING → CONFIRMED | Click "Confirm" button |
| **Check In** | CONFIRMED → CHECKED_IN | Click "Check In" → enter guest details → assign rooms |
| **Check Out** | CHECKED_IN → CHECKED_OUT | Click "Check Out" → review billing → add extra charges → generate invoice |
| **Cancel** | Any → CANCELLED | Click "Cancel" → enter reason |

#### Check-In Process
1. Click **"Check In"** on a confirmed booking
2. Enter guest details (ID proof, address)
3. Select/confirm room assignments
4. Click **Complete Check-In**
5. Room status changes to OCCUPIED, QR services become available

#### Check-Out Process
1. Click **"Check Out"** on a checked-in booking
2. Review the billing summary (room charges, taxes, extra charges)
3. Add any extra charges (minibar, damages, etc.)
4. Apply coupon codes if applicable
5. Click **Complete Check-Out**

> ⚠️ **Checkout is blocked if there are pending Service Requests** for that room. A centered modal will prompt you to resolve them before proceeding.

6. **Itemized Tax Billing**: The system automatically consolidates all `COMPLETED` service requests. Similar items are grouped (e.g., "Tea (x3)"), and exact taxes (GST/VAT) are displayed immediately below each individual item row for transparency.

7. Room status returns to AVAILABLE, QR services are disabled.

### 5.6 QR Codes & Room Services

#### Generate QR Codes
**Navigate to**: Hotel → QR Codes

1. Click **"Generate QR"** for a specific room, or **"Bulk Generate"** for all rooms
2. Each QR code links to: `https://your-frontend/room-services/<token>`
3. Download or print QR codes to place in hotel rooms

#### Manage Service Categories & Items
**Navigate to**: Hotel → Services

1. **Create Categories**: e.g., "Food & Beverage", "Housekeeping", "Laundry"
2. **Add Service Items** to each category:
   - **Name**: e.g., "Club Sandwich", "Extra Towels"
   - **Price**: Item price
   - **Max Quantity**: Limit per order (optional)
   - **Is Available**: Toggle availability

### 5.7 Service Requests (SR) — Booking-Gated

**Navigate to**: Hotel → Service Requests

#### How SRs Work
1. Guest scans QR in their room → sees the service menu (only if checked in)
2. Guest selects items, enters name/phone, and places order
3. SR appears in this dashboard with status **PENDING**
4. Admin/Staff can update status: **ACCEPTED** → **IN_PROGRESS** → **COMPLETED** (or **CANCELLED**)

#### SR-Booking Integration (Key Feature)
- SRs are **only available when the room has an active CHECKED_IN booking**
- Each SR automatically stores the **Booking PNR** (`booking_ref`)
- After checkout, QR services are **disabled** until the room is re-booked
- The SR table shows the **PNR badge** next to each room number
- The SR details modal shows the **Booking PNR** card

#### Checkout Protection
- If there are pending/accepted/in-progress SRs for a booking, **checkout is blocked**
- Error: *"Cannot checkout: There are X pending service request(s). Please complete or cancel them before checkout."*
- All SRs must be COMPLETED or CANCELLED before the system allows checkout

### 5.8 Tasks

**Navigate to**: Hotel → Tasks

Create and assign tasks to staff (housekeeping, maintenance, etc.):

1. Click **"Create Task"**
2. Fill in: **Title**, **Description**, **Priority** (Low/Medium/High/Urgent)
3. **Assign to**: Select a staff member
4. Optionally link to a **Booking**
5. Set **Due Date** if needed

Task statuses: `PENDING` → `IN_PROGRESS` → `COMPLETED` (or `CANCELLED`)

Each task has a detailed **History** tab showing all status changes with timestamps and who made the change.

### 5.9 Rate Plans & Promotions

#### Rate Plans
**Navigate to**: Hotel → Rates

Create date-based pricing rules for room types:
- **Season rates**: Higher prices during peak season
- **Weekend rates**: Different pricing for weekends
- **Occupancy-based**: Price adjustments based on occupancy

#### Promotions & Coupons
**Navigate to**: Hotel → Promotions

1. Create coupon codes with:
   - **Code**: e.g., `SUMMER20`
   - **Discount Type**: Percentage or Flat amount
   - **Discount Value**: e.g., 20% or ₹500
   - **Usage Limit**: Max number of times the coupon can be used
   - **Valid Dates**: Start and end dates
2. Coupons can be applied during booking or at checkout

### 5.10 Currency & Tax Settings

**Navigate to**: Hotel → Tax & Currency

#### Currency
Set your hotel's currency (INR, USD, EUR, etc.) — this affects all price displays across the application.

#### Taxes
1. Click **"Add Tax"**
2. Configure:
   - **Tax Name**: e.g., "GST", "CGST", "SGST", "Service Tax"
   - **Rate**: Percentage (e.g., 18)
   - **Category**: ROOM, SERVICE, FOOD, BEVERAGE, or ALL
   - **Type**: Inclusive (included in price) or Exclusive (added on top)
3. Taxes are automatically calculated during checkout billing

### 5.11 Booking Manager (Channels)

**Navigate to**: Hotel → Booking Manager

Manage OTA/channel integrations (Booking.com, MakeMyTrip, etc.) for external booking sources.

### 5.12 Bulk Bookings

**Navigate to**: Hotel → Bulk Bookings

Create group/corporate bookings for multiple rooms at once. Useful for conferences, weddings, and corporate events.

### 5.13 Room Inventory & Forecast

**Navigate to**: Hotel → Inventory / Room Forecast

Monitor your daily room availability and front-desk metrics at a glance.

1. **Daily Pulse Stats**:
   - **Rooms Available Now**: Real-time count of vacant rooms.
   - **Rooms Booked/Occupied**: Total rooms locked by active bookings.
   - **Check-ins/Outs**: Progress bars for today's arrivals and departures.

2. **30-Day Forecast Grid**:
   - A scrollable calendar showing every room type's availability for the next month.
   - **Visual Indicators**: 
     - 🟢 Green: High availability.
     - 🟡 Orange: Low stock (less than 30%).
     - 🔴 Red: Sold out.
   - **Date Navigation**: Change the start/end dates to view future month-over-month performance.

### 5.14 Lost & Found

**Navigate to**: Hotel → Lost & Found

Track items lost by guests or found by staff across the property.

1. **Report an Item**:
   - Select **Type** (FOUND or LOST)
   - Choose **Location** (Room, Lobby, Restaurant, etc.) and add details (e.g., Room 302)
   - Select **Category** (Electronics, Bag, Wallet, etc.)
   - Enter **Description** and **Approx. Cost**
   - Add **Contact Info** (Name, Phone, Email) and **Booking PNR** if known
2. **Track Status**:
   - Items move from `OPEN` → `CLAIMED` → `RETURNED` or `DISPOSED`
   - Filter by status, type, or date to manage the backlog
3. **Staff Access**: Staff can also record and view items from their own dashboard.

### 5.15 Item Inventory System (5 Modules)

**Navigate to**: Hotel → Item Inventory (collapsible sidebar submenu with 5 links)

A simplified system to manage all physical assets and supplies.

#### Items (Browse View)
**Navigate to**: Item Inventory → Items

- View all inventory items **grouped by category** (e.g., Kitchen → Forks/Spoons, Bar → Wine Bottles, Toiletries → Soap/Towels)
- Each category section is collapsible and shows item count
- Items display: Name, SKU, Unit, In Stock quantity, and Status (In Stock / Low Stock / Out of Stock)
- Stats cards show: total categories, total items, in-stock count, low/out count
- Use the search bar to quickly find items by name or SKU

#### Stocks (Management Hub)
**Navigate to**: Item Inventory → Stocks

The central management page with three tabs:

**Items tab:**
- View all items with category, unit, stock level, and min stock
- Click **"Add Item"** to create items (Name, Category, SKU, Unit, Min Stock Level)

**Categories tab:**
- View and manage item categories
- Click **"Add Category"** (e.g., Kitchen, Bar, Toiletries, Linen)

**Stock Levels tab:**
- View real-time stock per item per store
- Low stock items highlighted in red with alert icon
- Click **"Adjust Stock"** to manually add (Stock IN) or remove (Stock OUT)
- Click **"Add Store"** to create storage locations (Main Kitchen, Bar Storage, etc.)

#### Breakage & Loss
**Navigate to**: Item Inventory → Breakage & Loss

1. Click **"Report Damage"** to log an incident
2. Select: **Item** (shown with category prefix), **Store**, **Quantity**, **Reason** (Broken, Lost, Expired, Theft, Other)
3. Stock is **automatically deducted** from the selected store
4. Table shows: Date, **Category**, **Item**, Qty Lost, Reason, Reported By
5. Summary cards show: total incidents, total items lost, this month's incidents

#### Expenses
**Navigate to**: Item Inventory → Expenses

1. Click **"Log Expense"** to record operational costs
2. Fill in: **Description**, **Category**, **Amount**, **Date**, **Payment Method**
3. Table shows: Date, Category, Description, Amount, Payment Method
4. Summary cards: total expenses count, this month's spend, all-time total

#### Suppliers (PO + Vendor Management)
**Navigate to**: Item Inventory → Suppliers

**Purchase Orders tab:**
1. Click **"Create PO"** → select Supplier, Item, Quantity, Unit Price
2. PO auto-generates a PO number and starts in `DRAFT` status
3. Click **"Receive Stock"** to receive items into a store (auto-increases stock)
4. Status flow: `DRAFT` → `ORDERED` → `RECEIVED` (or `CANCELLED`)

**Suppliers tab:**
1. Click **"Add Supplier"** → Company Name, Contact Person, Phone, Email
2. View all registered vendors in a table

### 5.16 Support Hub

**Navigate to**: Hotel → Support (or Staff → Support)

The Support Hub provides a premium, interactive way for staff and administrators to get help.

- **Direct Actions**: Clickable cards for "Call Now", "Send Email", and "Chat on WhatsApp".
- **Unique Hotel ID**: Displays your property's 10-digit **Hotel ID** at the bottom. Provide this ID when contacting the system support team for faster identification.
- **Role Awareness**: Shows your current role and context for internal support reference.

---

## 6. Staff Guide

Staff users have limited access focused on daily operations.

### 6.1 Logging In

1. Go to `https://your-frontend/login`
2. Enter your **email** and **password** (provided by your hotel admin)
3. You'll be redirected to the **Staff Dashboard**

### 6.2 Staff Dashboard

The dashboard shows four key metrics for today:
- **Today's Check-ins**: Bookings arriving today
- **Today's Check-outs**: Bookings departing today
- **Pending SRs**: Service requests awaiting action
- **Pending Tasks**: Tasks assigned to you

Three tabs provide quick views:
- **Front Desk**: Today's bookings with room and guest info
- **Service Requests**: Pending SRs with room and service details
- **My Tasks**: Tasks assigned to you with priority and due dates

> The dashboard is **read-only** — for actions, navigate to the dedicated pages.

### 6.3 Features Available to Staff

| Feature | Access | Notes |
|---------|--------|-------|
| **Bookings** | View, check-in/out | Via Staff → Bookings |
| **Service Requests** | View, update status | Mandatory permissions: `SERVICE_REQUEST_VIEW`, `SERVICE_REQUEST_UPDATE` |
| **Tasks** | View, update status | Mandatory permissions: `TASK_VIEW`, `TASK_UPDATE` |
| **Additional** | Custom per user | Hotel admin can assign extra permissions (Room view, etc.) |

Staff do **not** have access to:
- Room management
- Service/amenity creation
- QR code generation
- Rate plans, promotions, or hotel settings

---

## 7. Guest QR Experience

When a guest scans the QR code in their room:

### If Room is NOT Occupied (no CHECKED_IN booking)
- Shows a **"Room Not Occupied"** screen with a lock icon
- Message: *"Services are only available during an active stay. Please check in at the front desk first."*

### If Room IS Occupied (active CHECKED_IN booking)
The guest sees a mobile-friendly service page with:

#### Menu Tab
1. **Hotel name** and **room number** in the header
2. **Booking PNR** displayed
3. **Category filter** (All, Food & Beverage, Housekeeping, etc.)
4. **Service items** as selectable cards with price, description, and quantity controls
5. **Checkout sheet** slides up from bottom: enter name, phone, apply coupon, and place order

#### My Orders Tab
1. Shows **all orders placed during the current stay**
2. Each order displays: service name, quantity, status badge, price, and timestamp
3. Status badges: ⏳ PENDING → 🔵 ACCEPTED → 🟣 IN PROGRESS → ✅ COMPLETED / ❌ CANCELLED
4. **History resets** automatically for the next guest (scoped to booking_id)

---

## 8. Roles & Permissions Reference

### Role Hierarchy

| Role | Scope | Description |
|------|-------|-------------|
| **SUPER_ADMIN** | Global | Full system access. Can create/manage hotels, users, subscriptions. Bypasses all quotas. |
| **HOTEL_ADMIN** | Hotel-level | All permissions within assigned hotel. Also recognized via legacy `'admin'` role identifier. |
| **STAFF** | Hotel-level | Customizable permissions. Base mandatory permissions for tasks and service requests. |

### Staff Mandatory Permissions
These cannot be removed from any staff user:
- `TASK_VIEW` — View assigned tasks
- `TASK_UPDATE` — Update task status
- `SERVICE_REQUEST_VIEW` — View service requests
- `SERVICE_REQUEST_UPDATE` — Update SR status

### Additional Assignable Permissions (Staff)
| Permission | Module | Description |
|------------|--------|-------------|
| `ROOM_VIEW` | Room | View room list and details |
| `ROOM_CREATE` | Room | Create new rooms |
| `ROOM_UPDATE` | Room | Edit room details |
| `BOOKING_VIEW` | Booking | View bookings |
| `BOOKING_CREATE` | Booking | Create new bookings |
| `BOOKING_UPDATE` | Booking | Update booking status |
| `QRCODE_VIEW` | QR Code | View QR codes |
| `QRCODE_GENERATE` | QR Code | Generate QR codes |
| `INVENTORY_VIEW` | Item Inventory | View items, categories, stock levels, stores |
| `INVENTORY_MANAGE` | Item Inventory | Create/edit items, categories, stores |
| `INVENTORY_STOCK_UPDATE` | Item Inventory | Adjust stock manually |
| `INVENTORY_PO_MANAGE` | Item Inventory | Manage suppliers and purchase orders |
| `INVENTORY_BREAKAGE_REPORT` | Item Inventory | Report breakage/loss incidents |
| `INVENTORY_EXPENSE_MANAGE` | Item Inventory | Log and view expenses |
| ... | ... | (and more per module) |

---

*Last updated: April 7, 2026*
