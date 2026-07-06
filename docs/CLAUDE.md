# CLAUDE.md — Hotel CMS AI Assistant Guide

> This file provides context, conventions, and rules for AI assistants working on this codebase.

---

## Project Overview

**Hotel CMS** is a multi-tenant SaaS hotel management platform.  
- **Backend**: Node.js 18+ / Express 4 / PostgreSQL 15 (raw SQL via `pg`, no ORM)  
- **Frontend**: React 18 / Vite 5 / Tailwind CSS 3 / Zustand / Axios  
- **Auth**: JWT (7-day expiry) + bcrypt + RBAC with granular permissions  
- **Deployment**: Render (primary), Docker Compose (local dev), VPS with Nginx + PM2  

---

## Quick Start

```bash
# Backend (port 5000)
cd backend && npm install && cp .env.example .env && npm run dev

# Frontend (port 3000)
cd frontend && npm install && npm run dev

# Docker (all-in-one)
docker-compose up -d
```

**Default login**: `admin@hotelcms.com` / `Admin@123`

---

## Architecture Rules

### Backend Module Pattern (MANDATORY)

Every backend feature follows the **Controller → Service → Route** triad inside `backend/src/modules/<module-name>/`:

```
modules/<module-name>/
├── controllers/<name>.controller.js   # HTTP layer — parse req, call service, send res
├── services/<name>.service.js         # Business logic — DB queries, validations, transactions
└── routes/<name>.routes.js            # Express Router — middleware chain + handler binding
```

**When adding a new module:**
1. Create the three files above
2. Register the route in `backend/src/server.js` with `require()` + `app.use('/api/<path>', routes)`
3. Add auto-migration for any new tables in `backend/src/config/database.js` → `ensureMigrations()`
4. Add the API client methods to `frontend/src/services/api.js`
5. Never forget step 2 — orphaned `require()` calls or missing ones crash production (see common error #1)

### Frontend Pattern

- **Pages** live in `frontend/src/pages/<RoleGroup>/` — `SuperAdmin/`, `HotelAdmin/`, `Staff/`, `Public/`
- **Shared components** go in `frontend/src/components/`
- **API clients** are in `frontend/src/services/api.js` — one exported object per backend module
- **State** uses Zustand stores in `frontend/src/store/` — `authStore.js`, `currencyStore.js`
- **Routing** is role-based in `App.jsx` using `<ProtectedRoute role="...">` wrappers

---

## Database Conventions

### IDs
- **All IDs are UUIDs** (via `gen_random_uuid()` from `pgcrypto`). NEVER use `parseInt()` on an ID.

### SQL Style
- Use **parameterized queries** (`$1, $2, ...`) — NEVER interpolate variables into SQL strings.
- Use **single quotes** for SQL string literals (`'RECEIVED'`), NEVER double quotes (those are for identifiers).
- Use `CREATE TABLE IF NOT EXISTS` and `ADD COLUMN IF NOT EXISTS` for all auto-migrations.

### Transactions
- Acquire a client via `const client = await db.pool.connect()` → `BEGIN` → do work → `COMMIT` or `ROLLBACK` → `client.release()` in `finally`.
- Always use transactions for multi-step mutations (e.g., creating a booking + assigning rooms + audit log).

### Audit Logging
- Most services have a `createAuditLog()` helper. Call it inside the transaction after every mutation.
- The `audit_logs` table is immutable — DB triggers prevent UPDATE and DELETE.

---

## Auth & RBAC

### Roles
| Role | Scope | Notes |
|------|-------|-------|
| `SUPER_ADMIN` | Global (no hotel_id) | Full system access, manages users/roles |
| `HOTEL_ADMIN` | Per-hotel | All hotel-scoped features except subscriptions/audit |
| `STAFF` | Per-hotel | Customizable permissions via `custom_permissions` JSONB on `user_roles` |

### Middleware Chain (typical route)
```javascript
router.post('/', authMiddleware, requirePermission('ROOM_CREATE'), quotaMiddleware('rooms'), controller.create);
```
- `auth.middleware.js` — verifies JWT, loads user + roles + permissions from DB into `req.user`
- `rbac.middleware.js` — `requirePermission(key)`, `requireRole(name)`, `requireAnyRole([...])`, `requireAnyPermission([...])`
- `quota.middleware.js` — checks `usage_counters` before resource creation
- `subscription.middleware.js` — checks active subscription status

### Hotel Context
- `req.user.hotel_id` is auto-extracted from the first role with a `hotel_id`
- Frontend: `useAuthStore().getHotelId()` returns `activeHotelId` → `user.hotel_id` → first role's `hotel_id`
- SuperAdmin switches hotels via the `HotelSwitcher` component; `activeHotelId` is persisted in Zustand
- Most API calls pass `hotel_id` as a URL param or query param — never assume it from the session alone

---

## Frontend Conventions

### API Service (`api.js`)
- **Response interceptor** strips the Axios wrapper: `response => response.data` — so callers get the data directly.
- **401 interceptor** auto-clears auth and redirects to `/login` (except for login endpoint itself).
- When adding a new API method, export it as part of the relevant API object (e.g., `bookingAPI.newMethod`).

### DataTable Component
Columns must use this format:
```javascript
// ✅ Correct
{ key: 'name', label: 'Item Name', render: (cellValue, row) => <span>{row.name}</span> }

// ❌ Wrong (legacy format — will partially work but is deprecated)
{ header: 'Item Name', accessor: 'name', render: (row) => <span>{row.name}</span> }
```

### Icons (Lucide React)
- Every icon component used in JSX **must** have a matching import.
- Mismatched or missing icon imports cause blank-screen runtime crashes.
```javascript
// ✅ Always verify
import { Plus, Users, Tag } from 'lucide-react';
```

### State Management
- `authStore.js` — auth, login/logout, role checking, hotel switching, permissions
- `currencyStore.js` — hotel currency settings cache
- Both use `zustand/middleware/persist` → serialized to `localStorage`
- **Always destructure** the exact store methods you need — omitting one causes `ReferenceError` crashes (e.g., `currencySymbol` for PDF exports).

### Role-Based Routing
- `App.jsx` nests routes under `<ProtectedRoute role="SUPER_ADMIN">`, `<ProtectedRoute role="HOTEL_ADMIN">`, `<ProtectedRoute role="STAFF">`
- The `hasRole()` function in authStore maps legacy role `ADMIN` → `HOTEL_ADMIN` for compatibility
- Public routes (QR scan page) are outside the ProtectedRoute wrapper

---

## Key Business Logic

### Booking Lifecycle
`CREATED` → `CONFIRMED` → `CHECKED_IN` → `CHECKED_OUT`  
- Also supports: `CANCELLED`, `NO_SHOW`, `REFUNDED`
- Check-in collects guest details and assigns physical rooms
- Check-out generates a sequential invoice and blocks if pending SRs exist
- Payment settlement is a separate step after checkout (`PAID` / `NOT_PAID`)

### Bulk Bookings
- Parent record in `bulk_bookings`, children in `bookings` with `bulk_booking_id` FK
- Children are **hidden** from the main dashboard via `AND b.bulk_booking_id IS NULL`
- Group check-in maps guests to rooms in a multi-step modal
- Always pass `null` for `room_assignments` when not needed (arg-position matters!)

### Service Requests (QR Flow)
- QR scan hits public endpoints (no auth) → shows room menu
- SRs are gated by `CHECKED_IN` booking for the room
- Each SR stores `booking_id` + `booking_ref`
- Completed SRs appear on checkout invoice with itemized taxes
- Guest order history resets on new check-in

### Invoice Numbering
- Format: `PREFIX/invoice/YYYY/MM/NNN`
- Prefix from hotel initials, counter per-hotel in `hotel_settings`
- Generated at checkout (bookings) and service completion (standalone SRs)

### Two Inventory Systems (CRITICAL)
- **Room Inventory** (`/api/inventory`, `modules/inventory/`): Room type availability per date (calendar + dashboard)
- **Item Inventory** (`/api/item-inventory`, `modules/item-inventory/`): Physical supplies, 10 DB tables, stock management
- These are **completely separate** — never confuse or merge them

---

## Common Pitfalls & Gotchas

> See `common_errors.md` for the full catalogue. Key ones to always watch for:

1. **`parseInt(uuid)` → NaN** — All IDs are UUIDs. Never parse them as integers.
2. **Missing `require()` in server.js** — Every module must be imported AND mounted. Orphaned requires crash on boot.
3. **SQL double-quotes** — PostgreSQL reserves `"..."` for identifiers. String literals use `'single quotes'`.
4. **Controller `this` binding** — Class-based controllers with Express must use arrow functions or explicit `.bind()`.
5. **String math** — `"2" + "2" = "22"`. Always `parseInt()` / `Number()` incoming numeric params.
6. **DataTable column format** — Use `{ key, label, render(val, row) }`, not `{ header, accessor, render(row) }`.
7. **Lucide icon imports** — Missing imports cause blank screen crashes, not helpful error messages.
8. **API method sync** — Adding a service call in a component but forgetting it in `api.js` → `TypeError: not a function`.
9. **Bulk booking arg order** — `bulkBookingAPI.updateStatus(id, status, room_assignments, hotelId)` — pass `null` for unused args.
10. **Auto-migration completeness** — `database.js` must have ALL tables/columns. New tables on Render won't exist otherwise.
11. **`is_billed` filter on paid invoices** — Use "historical mode" (no filter) when viewing finalized records.

---

## Testing

```bash
# Backend unit tests (Jest)
cd backend && npm test

# Run specific test
cd backend && npx jest path/to/test.spec.js

# API testing examples
node test-public.js
node test-create.js
```

- Test files live in `backend/src/modules/<module>/tests/`
- Uses Jest + Supertest
- No frontend test setup currently

---

## Deployment

### Render (Production)
- `render.yaml` defines the blueprint (Backend web service + PostgreSQL)
- Frontend is a separate static site on Render
- `DATABASE_URL` is the full PostgreSQL connection string
- Schema auto-applies via `database.js` migrations on boot

### Docker Compose (Local)
```bash
docker-compose up -d     # Start all
docker-compose down -v   # Reset (destroys data)
```
- PostgreSQL: 5432, Backend: 5000, Frontend: 3000

### VPS
- Nginx reverse proxy → `nginx.conf`
- PM2 process manager → `ecosystem.config.js`
- SSL via Let's Encrypt / Certbot

---

## File Change Checklist

When making changes, verify these files are in sync:

| Change | Files to Update |
|--------|----------------|
| New backend module | `server.js` (require + mount), `database.js` (table migration), `api.js` (client), `App.jsx` (route), `Sidebar.jsx` (nav) |
| New API endpoint | Route file, Controller, Service, `api.js` client |
| New DB table/column | `schema.sql`, `database.js` `ensureMigrations()`, Service layer |
| New frontend page | Page component, `App.jsx` (route), `Sidebar.jsx` (nav item), `api.js` (if new API calls) |
| New permission | `database.js` seed block, `schema.sql` permissions insert, RBAC middleware usage |
| New role capability | `rbac.middleware.js`, `ProtectedRoute` in `App.jsx`, `Sidebar.jsx` role checks |
