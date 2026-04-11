# Hotel CMS - Codebase Context Tree

> **Multi-tenant Hotel Management SaaS** — Full-stack Node.js + React application  
> **Repo**: `rjonwalcloud/hotel-claude`  
> **Branches**: `demo1` (primary), `claude/test-env` (staging), `master`  
> **Deployment**: Render (Backend API + Frontend Static Site + PostgreSQL)

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Backend** | Node.js + Express | REST API, `src/server.js` entry |
| **Database** | PostgreSQL (pg) | UUID PKs, `pgcrypto` extension |
| **Auth** | JWT + bcrypt | Token-based, role-scoped |
| **Frontend** | React 18 + Vite | SPA, `index.html` entry |
| **Styling** | Tailwind CSS 3.4 | Config in `tailwind.config.js` |
| **State** | Zustand | Persisted to localStorage |
| **HTTP Client** | Axios | Interceptors for auth & errors |
| **Icons** | Lucide React | |
| **Charts** | Recharts | Dashboard stats |
| **Forms** | React Hook Form | |
| **Dates** | date-fns | |
| **Toasts** | react-hot-toast | |
| **QR Codes** | qrcode (backend) | SVG/PNG generation |
| **Deploy** | Render | `render.yaml` blueprint |

---

## Project Root Structure

```
hotel-cms/
├── backend/                  # Express API server
│   ├── package.json          # Node deps (express, pg, bcrypt, jwt, etc.)
│   ├── src/
│   │   ├── server.js         # App entry — middleware + route mounting
│   │   ├── config/
│   │   │   └── database.js   # PostgreSQL pool + auto-migration (CREATE TABLE IF NOT EXISTS)
│   │   ├── middleware/       # 4 middleware files
│   │   ├── modules/          # 18 domain modules (controller/service/route pattern)
│   │   └── utils/
│   │       └── dateUtils.js
│   └── scripts/              # CLI utilities
│       ├── diagnostics.js    # DB health checker
│       ├── migrate.js        # Schema migrations
│       ├── seed.js           # Seed data
│       ├── postinstall.js    # Post-install hook
│       ├── validate-password.js
│       └── add-short-code.js
│
├── frontend/                 # React SPA (Vite)
│   ├── package.json          # React deps (zustand, axios, tailwind, etc.)
│   ├── index.html            # SPA entry
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── src/
│       ├── main.jsx          # React DOM root
│       ├── App.jsx           # Router + role-based routing
│       ├── index.css         # Tailwind directives
│       ├── services/api.js   # ALL API client functions (axios)
│       ├── store/            # Zustand stores
│       ├── components/       # 10 shared components
│       └── pages/            # 29 pages across 4 role groups
│
├── schema.sql                # Full PostgreSQL schema (28 tables + seeds)
├── seed.sql                  # Additional seed data
├── render.yaml               # Render deployment blueprint
├── docker-compose.yml        # Local dev with Docker
├── nginx.conf                # Production reverse proxy config
└── start.sh                  # Production start script
```

---

## Backend Architecture

### Middleware Stack (`backend/src/middleware/`)

| File | Purpose |
|------|---------|
| `auth.middleware.js` | JWT verification → fetches user + roles from DB → attaches `req.user` |
| `rbac.middleware.js` | `requirePermission(key)` — checks user's role permissions |
| `quota.middleware.js` | Enforces hotel-level resource limits (rooms, bookings) |
| `subscription.middleware.js` | Checks hotel's active subscription status |

### API Route Mounts (`server.js`)

| Mount Path | Module | Route File |
|-----------|--------|-----------|
| `/api/auth` | IAM | `auth.routes.js` |
| `/api/users` | IAM | `user.routes.js` |
| `/api/hotels` | Hotel | `hotel.routes.js` |
| `/api/rooms` | Room | `room.routes.js` |
| `/api/bookings` | Booking | `booking.routes.js` |
| `/api/bulk-bookings` | Booking | `bulk-booking.routes.js` |
| `/api/services` | Service | `service.routes.js` |
| `/api/policy` | Policy | `policy.routes.js` |
| `/api/audit` | Audit | `audit.routes.js` |
| `/api/qrcodes` | QR Code | `qrcode.routes.js` |
| `/api/subscriptions` | Subscription | `subscription.routes.js` |
| `/api/booking-manager` | Booking Manager | `booking-manager.routes.js` |
| `/api/system` | System | `system.routes.js` |
| `/api/public` | Public | `public.routes.js` |
| `/api/amenities` | Amenities | `amenity.routes.js` |
| `/api/inventory` | Room Inventory | `inventory.routes.js` |
| `/api/item-inventory` | Item Inventory | `inventory.routes.js` (item-inventory module) |
| `/api/settings` | Settings | `settings.routes.js` |
| `/api/rates` | Rate | `rate.routes.js` |
| `/api/promotions` | Promotion | `promotion.routes.js` |
| `/api/quote` | Rate | `quote.routes.js` |
| `/api/tasks` | Task | `task.routes.js` |
| `/api/analytics` | Analytics | `analytics.routes.js` |
| `/api/addons` | Addon | `addon.routes.js` |
| `/api/financials` | Invoices | `invoice.routes.js` |
| `/api/credit-notes` | Credit Notes | `credit-note.routes.js` |
| `/api/lost-found` | Lost & Found | `lost-found.routes.js` |

### Backend Modules (`backend/src/modules/`)

Each module follows the **Controller → Service → Route** pattern:

```
modules/
├── iam/                    # Identity & Access Management
│   ├── controllers/
│   │   ├── auth.controller.js      # Login, me, change-password
│   │   └── user.controller.js      # CRUD users, assign roles
│   ├── services/
│   │   ├── auth.service.js
│   │   └── user.service.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   └── user.routes.js
│   └── tests/
│
├── hotel/                  # Hotel CRUD + stats
│   ├── controllers/hotel.controller.js
│   ├── services/hotel.service.js
│   └── routes/hotel.routes.js
│
├── room/                   # Room + Room Type management
│   ├── controllers/
│   │   ├── room.controller.js
│   │   └── room-type.controller.js
│   ├── services/
│   │   ├── room.service.js
│   │   └── room-type.service.js
│   └── routes/room.routes.js       # Both rooms & types
│
├── booking/                # Bookings + Bulk Bookings
│   ├── controllers/
│   │   ├── booking.controller.js   # CRUD, check-in/out, billing, cancel
│   │   └── bulk-booking.controller.js
│   ├── services/
│   │   ├── booking.service.js      # Status FSM, availability checks, occupancy-aware billing/invoices. Filters out bulk children.
│   │   └── bulk-booking.service.js # Consolidated billing engine, group check-in/out, extra charges/promo logic.
│   └── routes/
│       ├── booking.routes.js
│       └── bulk-booking.routes.js
│
├── task/                   # Task assignments & history tracking
│   ├── controllers/task.controller.js
│   ├── services/task.service.js
│   └── routes/task.routes.js
│
├── addon/                  # Room addons for bookings
│   ├── controllers/addon.controller.js
│   ├── services/addon.service.js
│   └── routes/addon.routes.js
│
├── booking-manager/        # Channel integrations (OTA, walk-in, etc.)
│   ├── controllers/booking-manager.controller.js
│   ├── services/booking-manager.service.js
│   └── routes/booking-manager.routes.js
│
├── service/                # Hotel services (F&B, laundry, etc.)
│   ├── controllers/service.controller.js
│   ├── services/service.service.js     # Categories + Items + Requests
│   └── routes/service.routes.js
│
├── settings/               # Hotel settings + Tax management
│   ├── controllers/settings.controller.js  # ⚠️ Uses arrow functions for 'this' binding
│   ├── services/settings.service.js        # Currency, taxes CRUD
│   └── routes/settings.routes.js
│
├── rate/                   # Rate plans + pricing rules
│   ├── controllers/rate.controller.js
│   ├── services/
│   │   ├── rate.service.js
│   │   └── quote.service.js        # Price calculation engine (handles occupancy-based pricing & surcharges)
│   └── routes/
│       ├── rate.routes.js
│       └── quote.routes.js
│
├── promotion/              # Promotions + Coupon codes
│   ├── controllers/promotion.controller.js
│   ├── services/promotion.service.js
│   └── routes/promotion.routes.js
│
├── amenities/              # Hotel amenities
│   ├── controllers/amenity.controller.js
│   ├── services/amenity.service.js
│   └── routes/amenity.routes.js
│
├── inventory/              # Room inventory calendar (availability dashboard + 30-day grid)
│   ├── controllers/inventory.controller.js   # getDashboardStats, getInventoryCalendar
│   ├── services/inventory.service.js         # Queries room_inventory table
│   └── routes/inventory.routes.js            # GET /hotel/:id/dashboard, /hotel/:id/calendar
│
├── item-inventory/         # Physical supplies & stock management (10 DB tables)
│   ├── controllers/inventory.controller.js   # 17 endpoints: CRUD for items, categories, stores, stock, suppliers, POs, breakage, expenses
│   ├── services/inventory.service.js         # Business logic + transaction handling (PO receive, breakage deductions)
│   └── routes/inventory.routes.js            # RBAC: INVENTORY_VIEW, INVENTORY_MANAGE, INVENTORY_STOCK_UPDATE, INVENTORY_PO_MANAGE, INVENTORY_BREAKAGE_REPORT, INVENTORY_EXPENSE_MANAGE
│
├── qrcode/                 # QR code generation + scanning + booking-gated SRs
│   ├── controllers/qrcode.controller.js
│   ├── services/qrcode.service.js      # Token gen, scan, SR CRUD, booking occupancy checks, guest orders
│   └── routes/qrcode.routes.js         # Public: scan, orders, SR create; Protected: admin CRUD
│
├── subscription/           # SaaS subscription plans
│   ├── controllers/subscription.controller.js
│   ├── services/subscription.service.js
│   └── routes/subscription.routes.js
│
├── policy/                 # Quota/limit enforcement
│   ├── controllers/policy.controller.js
│   ├── services/policy.service.js
│   └── routes/policy.routes.js
│
├── audit/                  # Audit logging
│   ├── controllers/audit.controller.js
│   ├── services/audit.service.js
│   └── routes/audit.routes.js
│
├── system/                 # System backup + config
│   ├── controllers/system.controller.js
│   ├── services/system.service.js
│   └── routes/system.routes.js
│
├── analytics/              # Hotel analytics & performance metrics
│   ├── controllers/analytics.controller.js
│   ├── services/analytics.service.js   # Aggregation logic with generate_series
│   └── routes/analytics.routes.js
│
├── lost-found/             # Lost & Found items tracking
│   ├── controllers/lost-found.controller.js  # CRUD + status updates
│   ├── services/lost-found.service.js        # Filtering, search, hotel-scoped queries
│   └── routes/lost-found.routes.js           # RBAC: SUPER_ADMIN, HOTEL_ADMIN, STAFF
│
└── public/                 # Unauthenticated endpoints
    ├── controllers/public.controller.js  # Hotel info, availability, public booking
    ├── services/public.service.js
    └── routes/public.routes.js           # Also has /diagnostics endpoint
```

---

## Frontend Architecture

### State Management (`frontend/src/store/`)

| Store | Key State | Purpose |
|-------|----------|---------|
| `authStore.js` | `user`, `token`, `activeHotelId`, `isAuthenticated` | Auth, login/logout, hotel switching, role checking |
| `currencyStore.js` | `currencyCode`, `currencySymbol` | Hotel currency settings cache |

### API Service (`frontend/src/services/api.js`)

Single file exporting **15 API client objects**, each with methods mapping to backend endpoints:

| Export | Prefix | Backend Module |
|--------|--------|---------------|
| `authAPI` | `/auth` | IAM |
| `hotelAPI` | `/hotels` | Hotel |
| `roomAPI` | `/rooms` | Room |
| `bookingAPI` | `/bookings` | Booking |
| `bulkBookingAPI` | `/bulk-bookings` | Booking |
| `rateAPI` | `/rates` | Rate |
| `promotionAPI` | `/promotions` | Promotion |
| `quoteAPI` | `/quote` | Rate/Quote |
| `serviceAPI` | `/services` | Service |
| `amenityAPI` | `/amenities` | Amenities |
| `roomInventoryAPI` | `/inventory` | Room Inventory (calendar + dashboard) |
| `itemInventoryAPI` | `/item-inventory` | Item Inventory (17 methods: items, stock, POs, suppliers, breakage, expenses) |
| `policyAPI` | `/policy` | Policy |
| `auditAPI` | `/audit` | Audit |
| `qrcodeAPI` | `/qrcodes` | QR Code |
| `subscriptionAPI` | `/subscriptions` | Subscription |
| `bookingManagerAPI` | `/booking-manager` | Booking Manager |
| `systemAPI` | `/system` | System |
| `publicAPI` | `/public` | Public |
| `settingsAPI` | `/settings` | Settings/Tax |
| `adminUserAPI` | `/users` | IAM/Users |
| `addonAPI` | `/addons` | Addon |
| `analyticsAPI` | `/analytics` | Analytics |
| `lostFoundAPI` | `/lost-found` | Lost & Found |

**Interceptors**: Auto-attaches Bearer token; auto-redirects to `/login` on 401.

### Shared Components (`frontend/src/components/`)

| Component | Purpose |
|-----------|---------|
| `Layout.jsx` | Main layout wrapper (Sidebar + Header + content) |
| `Sidebar.jsx` | Left navigation menu (role-aware, scrollable) |
| `Header.jsx` | Top header bar |
| `ProtectedRoute.jsx` | Route guard (auth + role check) |
| `HotelSwitcher.jsx` | Hotel context switcher (SuperAdmin) |
| `DataTable.jsx` | Reusable data table with sorting/pagination |
| `Modal.jsx` | Generic modal dialog |
| `ConfirmModal.jsx` | Confirmation dialog |
| `PromptModal.jsx` | Input prompt dialog |
| `StatsCard.jsx` | Dashboard statistics card |

### Pages by Role (`frontend/src/pages/`)

#### Super Admin (`/admin/*`)
| Page | Route | Purpose |
|------|-------|---------|
| `Dashboard.jsx` | `/admin/dashboard` | System-wide stats |
| `HotelsList.jsx` | `/admin/hotels` | Hotel CRUD |
| `SubscriptionManagement.jsx` | `/admin/subscriptions` | Plan management |
| `QuotaManagement.jsx` | `/admin/quotas` | Hotel limits |
| `GlobalAudit.jsx` | `/admin/audit` | System-wide audit logs |
| `SystemBackup.jsx` | `/admin/system` | DB backup/restore |
| `SystemSettings.jsx` | `/admin/settings` | Global config |
| `UserManagement.jsx` | `/admin/users` | User CRUD + role assignment |
| `SupportSettings.jsx` | `/admin/support` | Global support contact config |

#### Hotel Admin (`/hotel/*`)
| Page | Route | Purpose |
|------|-------|---------|
| `Dashboard.jsx` | `/hotel/dashboard` | Hotel-specific stats |
| `RoomManagement.jsx` | `/hotel/rooms` | Room CRUD |
| `RoomTypeManagement.jsx` | `/hotel/room-types` | Room type CRUD |
| `AmenityManagement.jsx` | `/hotel/amenities` | Amenity CRUD |
| `InventoryManagement.jsx` | `/hotel/room-inventory` | Room inventory calendar (30-day grid) |
| `InventoryApp.jsx` | `/hotel/inventory/*` | Item inventory sub-router (5 child routes) |
| — `ItemManagement.jsx` | `/hotel/inventory/items` | Browse items grouped by category with stock status |
| — `StockManagement.jsx` | `/hotel/inventory/stock` | CRUD categories/items/stores + stock adjustments (tabbed) |
| — `BreakageLoss.jsx` | `/hotel/inventory/breakage` | Breakage/loss reporting showing category + item |
| — `ExpenseManagement.jsx` | `/hotel/inventory/expenses` | Expense tracking (category, amount, date, payment) |
| — `Suppliers.jsx` | `/hotel/inventory/suppliers` | Purchase orders + supplier management (tabbed) |
| `BookingManagement.jsx` | `/hotel/bookings` | Booking lifecycle (create → check-in → check-out) |
| `BulkBookings.jsx` | `/hotel/bulk-bookings` | Group/corporate bookings |
| `CustomerManagement.jsx` | `/hotel/customers` | Guest records |
| `BookingManager.jsx` | `/hotel/booking-manager` | Channel management (OTA integration) |
| `QRCodeManagement.jsx` | `/hotel/qrcodes` | Room QR code generation |
| `ServiceManagement.jsx` | `/hotel/services` | Service categories + items |
| `ServiceRequests.jsx` | `/hotel/service-requests` | Guest service requests |
| `RateManagement.jsx` | `/hotel/rates` | Rate plans + pricing rules |
| `PromotionManagement.jsx` | `/hotel/promotions` | Promotions + coupons |
| `HotelSettings.jsx` | `/hotel/settings` | Hotel profile settings |
| `CurrencyTaxManagement.jsx` | `/hotel/tax-currency` | Currency + tax config |
| `TaskManagement.jsx` | `/hotel/tasks` | Task CRUD + booking-style history timeline |
| `AddonManagement.jsx` | `/hotel/addons` | Room Addon CRUD |
| `InvoiceManagement.jsx` | `/hotel/invoices` | Consolidated billing dashboard with Month/Year PDF Reports |
| `RestaurantPOS.jsx` | `/hotel/pos` | Premium POS interface with item grid, cart, and guest assignment |
| `Analytics.jsx` | `/hotel/analytics` | Performance dashboard with Recharts |
| `CreditNotes.jsx` | `/hotel/credit-notes` | Credit note management |
| `LostFound.jsx` | `/hotel/lost-found` | Lost & Found items CRUD (found/lost, location, category, contact info) |
| `Support.jsx` | `/hotel/support` | Contextual support Hub (Click-to-Call/WA) |

#### Staff (`/staff/*`)
| Page | Route | Purpose |
|------|-------|---------|
| `Dashboard.jsx` | `/staff/dashboard` | Tabbed overview (Check-ins, Check-outs, SRs, Tasks) |
| `Bookings.jsx` | `/staff/bookings` | View/update bookings |
| `Rooms.jsx` | `/staff/rooms` | View room status |
| `LostFound.jsx` | `/staff/lost-found` | Lost & Found items (shared component from HotelAdmin) |
| `Support.jsx` | `/staff/support` | View-only support hub |

#### Public (No auth)
| Page | Route | Purpose |
|------|-------|---------|
| `RoomServices.jsx` | `/room-services/:token` | QR scan → Menu / My Orders tabs (booking-gated) |

#### Shared
| Page | Route | Purpose |
|------|-------|---------|
| `Login.jsx` | `/login` | Login form |
| `Profile.jsx` | `/profile` | User profile + password change |
| `NotFound.jsx` | `*` | 404 page |

---

## Database Schema (38 Tables)

### IAM & Access Control
| Table | Purpose | Key Relationships |
|-------|---------|-------------------|
| `users` | User accounts | Has many `user_roles` |
| `roles` | SUPER_ADMIN, HOTEL_ADMIN, STAFF | Has many `role_permissions` |
| `permissions` | Granular permissions (ROOM_CREATE, etc.) | Linked via `role_permissions` |
| `user_roles` | User ↔ Role ↔ Hotel mapping | FK: `users`, `roles`, `hotels` |
| `role_permissions` | Role ↔ Permission mapping | FK: `roles`, `permissions` |

### Hotels & Policy
| Table | Purpose |
|-------|---------|
| `hotels` | Hotel profiles (name, address, contact, etc.) and unique 10-digit `hotel_id_code` |
| `hotel_settings` | Per-hotel currency config, custom invoice prefixes, and sequential counters |
| `policy_limits` | Global limit definitions (max_rooms, max_bookings) |
| `hotel_limits` | Per-hotel limit overrides |
| `usage_counters` | Current usage tracking per hotel |

### Rooms & Inventory
| Table | Purpose |
|-------|---------|
| `room_types` | Room type definitions (base_price, max_occupancy) |
| `rooms` | Individual room records (number, floor, status) |
| `room_inventory` | Date-wise room type availability calendar |
| `service_categories` | Service category groupings |
| `service_items` | Individual service items (F&B, laundry, etc.) |

### Bookings
| Table | Purpose |
|-------|---------|
| `bookings` | Core booking records (guest, dates, status, pricing, invoice_number, payment_status, payment_method) |
| `booking_rooms` | Booking ↔ Room many-to-many |
| `booking_status_history` | Status change audit trail |
| `addons` | Room addons definitions |
| `booking_addons` | Addons attached to specific bookings |
| `bulk_bookings` | Group/corporate booking headers. Attributes: `promo_discount`, `applied_promotion`, `extra_charges` (JSONB), `corporate_gst`, `paid_amount`, `total_amount`. |
| `tasks` | Task assignments (cleaning, prep, etc.) |
| `task_history` | Task status change audit trail |

### Channels & QR
| Table | Purpose |
|-------|---------|
| `booking_channels` | OTA/channel integrations (Booking.com, etc.) |
| `channel_bookings` | Channel-sourced booking records |
| `room_qr_codes` | QR code tokens for rooms |
| `service_requests` | Guest service requests (via QR scan). Columns include `booking_id` and `booking_ref` for booking linkage. SRs are only creatable when room has a CHECKED_IN booking. |
| `sr_history` | Service request status change audit trail |

### Subscriptions & Billing
| Table | Purpose |
|-------|---------|
| `subscription_plans` | SaaS plan definitions |
| `hotel_subscriptions` | Active hotel subscriptions |
| `subscription_history` | Subscription change log |

### Taxes
| Table | Purpose |
|-------|---------|
| `taxes` | Per-hotel tax entries (GST, VAT, etc.) |

### Item Inventory (10 tables)
| Table | Purpose |
|-------|---------|
| `inventory_categories` | Item groupings (Toiletries, Linen, etc.) |
| `inventory_items` | Supply catalog (name, SKU, unit, min_stock_level) |
| `inventory_stores` | Storage locations (Main Store, Kitchen, etc.) |
| `inventory_stock` | Current quantity per item per store (UPSERT on adjust) |
| `inventory_suppliers` | Vendor database (contact info) |
| `inventory_purchase_orders` | PO headers (supplier, status: DRAFT→ORDERED→RECEIVED) |
| `inventory_po_items` | PO line items (item, quantity, unit_price) |
| `inventory_stock_movements` | Movement audit trail (IN, OUT, PO_RECEIVE, BREAKAGE, TRANSFER) |
| `inventory_breakage_reports` | Damage/loss incidents (auto-deducts stock) |
| `inventory_expenses` | Operational spending records (category, payment_method) |

### Lost & Found
| Table | Purpose |
|-------|---------|
| `lost_found_items` | Lost/found item records with location, category, cost, contact info, status tracking (OPEN→CLAIMED→RETURNED/DISPOSED) |

### Audit
| Table | Purpose |
|-------|---------|
| `audit_logs` | Immutable action logs (protected by trigger) |

---

## Auth & RBAC System

### Roles & Permissions
- **SUPER_ADMIN**: Full system access, no hotel scope (Can manage users + roles globally)
- **HOTEL_ADMIN**: All hotel-scoped permissions except LIMIT_OVERRIDE, HOTEL_CREATE/DELETE, SUBSCRIPTION_*, AUDIT_VIEW
- **STAFF**: Customizable granular permissions. Mandatory base permissions include `TASK_VIEW`, `TASK_UPDATE`, `SERVICE_REQUEST_VIEW`, `SERVICE_REQUEST_UPDATE`. Additional permissions can be assigned per staff member (Custom Permissions).

### Auth Flow
1. `POST /api/auth/login` → validates credentials → returns JWT + user object
2. Frontend stores token in `localStorage`, user/hotel in Zustand (persisted)
3. Every API call includes `Authorization: Bearer <token>` via axios interceptor
4. `auth.middleware.js` verifies JWT → queries DB for user + roles + permissions → attaches to `req.user`
5. `rbac.middleware.js` checks `req.user.roles[].permissions` against required permission key
6. `hotel_id` is scoped via `req.user.hotel_id` (from first role with hotel_id)

### Hotel Context
- `authStore.getHotelId()`: Returns `activeHotelId` → `user.hotel_id` → first `role.hotel_id`
- SuperAdmin can switch hotels via `HotelSwitcher` component
- Most API calls pass `hotel_id` as URL param or query param

---

## Deployment (Render)

```yaml
# render.yaml
services:
  - Backend API (Node.js web service)
    Build: cd backend && npm install
    Start: cd backend && npm start
    Health: /health
  - Frontend (Static site, separate Render service)
    Build: cd frontend && npm install && npm run build
    Publish: frontend/dist

databases:
  - PostgreSQL (hotel_cms)
```

### Environment Variables
| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Token signing secret |
| `CORS_ORIGIN` | Allowed origins |
| `NODE_ENV` | `production` / `development` |
| `PORT` | Server port (default: 5000) |
| `VITE_API_URL` | Frontend → Backend API base URL |

---

## Key Patterns & Gotchas

### Backend Patterns
- **All IDs are UUIDs** — never use `parseInt()` on IDs
- **Controller `this` binding** — when using class-based controllers with Express, methods must be arrow functions or explicitly bound (see `settings.controller.js` fix)
- **Auto-migration on boot** — `database.js` runs `CREATE TABLE IF NOT EXISTS` for all tables during startup
- **Audit logging** — most services call `this.createAuditLog()` after mutations
- **Quota enforcement** — `quota.middleware.js` checks `usage_counters` before allowing resource creation
- **Detailed History Timelines** — Core flows (Bookings, Tasks, Service Requests) use dedicated history tables (`booking_status_history`, `task_history`, `sr_history`) to track robust status transitions and user attribution, displayed in booking-style vertical timelines on the frontend.
- **SR-Booking Integration** — Service Requests via QR are gated by room occupancy (`CHECKED_IN` booking required). Each SR stores `booking_id` and `booking_ref`. After checkout, the room's QR SR functionality is disabled until re-booked. `checkOutWithBilling()` blocks if pending/in-progress SRs exist. `COMPLETED` service requests are automatically appended to the checkout invoice with itemized tax breakdowns.
- **Itemized Invoice Taxes** — The billing engine calculates and displays taxes (GST/VAT) immediately below each relevant line item (Room, Addons, Manual Charges, and Room Service). Supports both Inclusive and Exclusive taxes with clear labeling.
- **Consolidated Billing Items** — Similar service items ordered multiple times are automatically grouped into single rows (e.g., "Sandwich x2") in the final invoice to ensure a clean and professional presentation.
- **Guest Order History** — Public QR page has a "My Orders" tab showing past SRs scoped to the active `booking_id`. History automatically resets for the next guest on new check-in.
- **Incremental Invoicing** — Every checkout and standalone service completion generates a unique, sequential invoice number (format: `PREFIX/invoice/YYYY/MM/NNN`). Prefixes are derived from hotel initials, and counters are managed per-hotel in `hotel_settings`.
- **Unified Invoice Dashboard** — A consolidated view in the Hotel Admin panel merging Bookings and QR Service requests into a single, searchable financial record.
- **Post-Checkout Payment Settlement** — Check-out transitions a booking to `CHECKED_OUT` and generates an invoice, but payment status defaults to `NOT_PAID`. A mandatory settlement step records the payment method (UPI, Cash, CC, DC) and marks the invoice as `PAID`. Paid invoices consistently display itemized service requests by removing the pre-checkout `is_billed` filter.
- **Restaurant POS Workflow** — Staff can place orders for checked-in guests via a dedicated POS interface. Supports "Post to Room" (links to booking) and "Pay Now" (immediate settlement). Includes dual-format printing (Kitchen Ticket vs Guest Receipt), **Restaurant Category Labeling** for item filtering, and unified tracking for walk-in orders without room IDs. Service receipts now display dynamic payment status labels (Paid POS vs Paid Booking vs Unpaid).
- **Auto-Generated Hotel IDs** — Every hotel is assigned a unique, 10-digit alphanumeric `hotel_id_code` (e.g., `A1B2C3D4E5`) for user-friendly support identification. Existing properties were retrofitted during the April 7th migration.
- **Support Hub Integration** — Dynamic support contact points (Phone/Email/WhatsApp) configured by SuperAdmin per hotel; accessible to HotelAdmin/Staff via a premium interactive hub that also exposes the system HotelID.
- **Bulk Booking Lifecycle** — Decoupled from the regular bookings menu. Bulk bookings act as "Parent" records for billing and group status. Children are hidden from the main dashboard via `bulk_booking_id IS NULL` filter. Supports occupancy-based room suggestions, group check-in with physical room assignment, and consolidated billing (extras, discounts, corporate GST).

### Frontend Patterns
- **Role-based routing** — `App.jsx` uses nested `<ProtectedRoute role="...">` wrappers
- **Sidebar navigation** — `Sidebar.jsx` renders different menu items based on user role
- **API error handling** — axios interceptor catches 401 → auto-logout; components catch specific errors
- **Currency context** — `currencyStore.js` caches hotel currency for formatting
- **`Promise.all` data loading** — most pages load multiple APIs concurrently on mount

### Item Inventory Patterns
- **Two separate inventory systems**: Room Inventory (`/api/inventory`) tracks room_types availability per date. Item Inventory (`/api/item-inventory`) tracks physical supplies.
- **InventoryApp.jsx sub-router**: `<Route path="inventory/*">` in App.jsx delegates to InventoryApp.jsx which renders 6 child routes.
- **Collapsible sidebar submenu**: Sidebar.jsx has `openMenus` state with submenu support for Item Inventory (5 links: Items, Stocks, Breakage, Expenses, Suppliers).
- **Stock UPSERT**: `adjustStock()` uses `INSERT ... ON CONFLICT (store_id, item_id) DO UPDATE` to atomically update quantities.
- **Transaction-based PO receive**: `receivePO()` wraps stock updates + status change in a single DB transaction.
- **Breakage auto-deduction**: `reportBreakage()` inserts report + calls `adjustStock()` with negative quantity in same transaction.
- **DataTable compatibility**: DataTable uses `{ key, label, render(cellValue, row) }` format. All column definitions must match this signature.

### Common Issues (Resolved)
- `parseInt(uuid)` → `NaN` — breaks hotel_id comparisons
- Class method `this` lost in Express routes — use arrow functions
- Missing DB tables on Render — `database.js` must have all `CREATE TABLE IF NOT EXISTS`
- Sidebar not scrollable — needs `min-h-0` + `overflow-hidden` on flex parents
- DataTable column format mismatch — inventory pages used `header/accessor/render(row)` instead of `key/label/render(val, row)`
