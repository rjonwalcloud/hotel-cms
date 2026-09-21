# Hotel CMS — Changes Log

> **Date**: 2026-07-29  
> **Branch**: `claude_test`  
> **Author**: Code Audit (Automated)

---

## Table of Contents

- [Security Fixes](#security-fixes)
- [Code Quality Fixes](#code-quality-fixes)
- [Error Handling Improvements](#error-handling-improvements)
- [New Feature Proposals](#new-feature-proposals)

---

## Security Fixes

### 1. CORS Configuration Hardened (`backend/src/server.js`)

**Problem**: CORS was configured with `origin: true`, which reflects any request origin — effectively allowing **all domains** to make authenticated API calls.

**Fix**: Changed CORS to use the `CORS_ORIGIN` environment variable in production. In development, it continues to allow all origins for convenience. Supports comma-separated multiple origins.

```diff
-const corsOptions = {
-  origin: true, // Reflect request origin (useful for multi-domain debugging)
-  credentials: true,
-  optionsSuccessStatus: 200
-};
+const corsOrigin = process.env.CORS_ORIGIN;
+const corsOptions = {
+  origin: process.env.NODE_ENV === 'production' && corsOrigin
+    ? corsOrigin.split(',').map(o => o.trim())
+    : true,
+  credentials: true,
+  optionsSuccessStatus: 200
+};
```

**Action Required**: Ensure `CORS_ORIGIN` is set in production environment variables (e.g., `CORS_ORIGIN=https://your-domain.com`).

---

### 2. JWT Secret Removed from Docker Compose (`docker-compose.yml`)

**Problem**: A hardcoded JWT secret was committed in `docker-compose.yml`, making it visible to anyone with repo access.

**Fix**: Replaced with an environment variable reference with a default fallback:

```diff
-JWT_SECRET: q8K7v9pT4zL2mW1xY0bR5nH6sF3dJ8uE
+JWT_SECRET: ${JWT_SECRET:-change-this-secret-in-production}
```

**Action Required**: Set `JWT_SECRET` in your `.env` file or shell environment before running `docker-compose up`.

---

## Code Quality Fixes

### 3. React Hooks Violation Fixed (`frontend/src/App.jsx`)

**Problem**: `useEffect` was called inside a conditional branch within the `RoleDashboard` component:

```jsx
// ❌ ILLEGAL — violates Rules of Hooks
if (user.roles?.length === 0 && !user.hotel_id) {
  useEffect(() => {
    logout();
  }, [logout]);
  return <Navigate to="/login" replace />;
}
```

React Hooks must always be called in the **same order** on every render. Placing `useEffect` inside an `if` block means it only runs conditionally, which can cause state corruption and crashes.

**Fix**: Since `logout()` is a synchronous Zustand state setter, it can be called directly without `useEffect`:

```jsx
// ✅ FIXED — direct call, no hook violation
if (user.roles?.length === 0 && !user.hotel_id) {
  logout();
  return <Navigate to="/login" replace />;
}
```

---

### 4. Duplicate Route Removed (`frontend/src/App.jsx`)

**Problem**: The `invoices` route was registered **twice** under Staff routes:

```jsx
<Route path="invoices" element={<InvoiceManagement />} />
<Route path="invoices" element={<InvoiceManagement />} />  // ← duplicate
```

**Fix**: Removed the duplicate line. Only one `invoices` route remains.

---

### 5. Improved Graceful Shutdown (`backend/src/server.js`)

**Problem**: The original shutdown handlers had duplicated code between `SIGTERM` and `SIGINT`, and no timeout safeguard — a stuck DB connection could prevent the process from ever exiting.

**Fix**:
- Consolidated into a single `gracefulShutdown()` function
- Added a **10-second forced exit timeout** to prevent zombie processes
- Added `unhandledRejection` and `uncaughtException` handlers to catch silent crashes

```javascript
const SHUTDOWN_TIMEOUT_MS = 10000;

function gracefulShutdown(signal) {
  console.log(`${signal} received: closing HTTP server`);
  const forceExit = setTimeout(() => {
    console.error('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  server.close(() => {
    const db = require('./config/database');
    db.pool.end(() => {
      clearTimeout(forceExit);
      process.exit(0);
    });
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('unhandledRejection', (reason, promise) => { /* logged */ });
process.on('uncaughtException', (error) => { gracefulShutdown('uncaughtException'); });
```

---

## Error Handling Improvements

### 6. Centralized Error Handler (`backend/src/middleware/errorHandler.js`) — NEW

**What**: Created a reusable `AppError` class and centralized error handling middleware.

**Why**: The existing error handler treated all errors equally — logging everything and potentially leaking stack traces. The new handler:
- Classifies errors as **operational** (4xx, expected) vs **unexpected** (5xx, bugs)
- Only logs unexpected errors to reduce noise
- Strips stack traces and internal details in production
- Provides an `AppError` class for throwing typed errors from services

**Usage example**:
```javascript
const { AppError } = require('../../../middleware/errorHandler');

// In a service method:
if (!hotel) {
  throw new AppError('Hotel not found', 404);
}
```

### 7. Improved Error Handler in server.js

**What**: The global Express error handler now distinguishes between operational and programming errors.

**Before**: All errors returned `err.message` (potentially leaking internal details).  
**After**: 5xx errors return a generic "Internal Server Error" in production.

---

## New Feature Proposals

The following features are recommended for future development based on the codebase audit:

### High Priority

| # | Feature | Description | Effort |
|---|---------|-------------|--------|
| 1 | **API Versioning** | Prefix all routes with `/api/v1/` to allow non-breaking evolution. New versions can coexist (e.g., `/api/v2/bookings`). | Medium |
| 2 | **Centralized Validation Middleware** | Create a reusable Joi validation middleware (`validate(schema)`) instead of repeating validation logic in each controller. Many controllers currently lack input validation. | Medium |
| 3 | **Enhanced Health Check** | Upgrade `/health` to include database connectivity, memory usage, and uptime. Useful for monitoring and orchestration (K8s readiness probes). | Low |
| 4 | **Structured Logging** | Replace `console.log` / `console.error` with a structured logger (e.g., `pino` or `winston`) that outputs JSON with timestamps, log levels, and request IDs. | Medium |

### Medium Priority

| # | Feature | Description | Effort |
|---|---------|-------------|--------|
| 5 | **Per-Endpoint Rate Limiting** | Auth endpoints (`/api/auth/login`) should have stricter rate limits (e.g., 10 req/15min) than general API endpoints (100 req/15min). Currently uses a single global limiter. | Low |
| 6 | **Password Strength Rules** | Add Joi-based password complexity enforcement (min length, uppercase, numbers, special chars) in auth service and user management. Currently no password strength validation exists. | Low |
| 7 | **JWT Token Blacklist** | Implement server-side token invalidation on logout using an in-memory store (or Redis). Currently, JWT tokens remain valid for their full 7-day lifetime after logout. | Medium |
| 8 | **Email Notifications** | Send automated emails for booking confirmations, check-in/out, payment receipts, and password resets. Use a service like Nodemailer + SMTP or SendGrid. | High |

### Feature Expansion

| # | Feature | Description | Effort |
|---|---------|-------------|--------|
| 9 | **Guest Feedback System** | Post-checkout guest surveys accessible via the existing QR code infrastructure. Collect star ratings and comments per stay. | Medium |
| 10 | **Housekeeping Module** | Room cleaning schedules, assignment to staff, status tracking (Dirty → In Progress → Clean → Inspected). Ties into room status management. | High |
| 11 | **Night Audit Reports** | Automated end-of-day financial summaries: occupancy rate, revenue collected, outstanding payments, room reconciliation. Scheduled via cron or triggered manually. | Medium |
| 12 | **Multi-Language Backend** | i18n support for error messages, email templates, and PDF invoices. The frontend already has i18next set up — extend to backend responses. | Medium |
| 13 | **Webhook System** | Event-driven notifications (e.g., `booking.created`, `checkout.completed`) via configurable webhook URLs. Enables third-party integrations without polling. | High |
| 14 | **Real-Time Dashboard** | WebSocket-based live updates for dashboards, service request queues, and room status changes. Replace periodic polling with push notifications. | High |

---

## Files Changed

| File | Action | Summary |
|------|--------|---------|
| `backend/src/server.js` | Modified | Fixed CORS, improved error handler, consolidated graceful shutdown, added process error handlers, restored system health monitor |
| `backend/src/middleware/errorHandler.js` | **New** | Centralized `AppError` class and error handler middleware |
| `frontend/src/App.jsx` | Modified | Fixed React Hooks violation in `RoleDashboard`, removed duplicate staff invoices route |
| `docker-compose.yml` | Modified | Replaced hardcoded JWT secret with env var reference |
| `docs/changes.md` | **New** | This file — documents all changes and feature proposals |

---

## How to Verify

```bash
# 1. Check backend starts without errors
cd backend && npm start

# 2. Verify no CORS issues in production (set CORS_ORIGIN first)
CORS_ORIGIN=https://your-domain.com NODE_ENV=production npm start

# 3. Verify frontend compiles cleanly
cd frontend && npm run build

# 4. Run existing tests
cd backend && npm test
```
