# 🏨 Hotel CMS - SaaS-Grade Admin Platform

A production-ready hotel management system built with MERN stack + PostgreSQL, featuring proper IAM, quota management, and audit logging.

## 🎯 Architecture Highlights

- ✅ **Modular Monolith** - SaaS-ready architecture
- ✅ **Proper RBAC** - Permissions ≠ Limits
- ✅ **Quota System** - Usage tracking & enforcement
- ✅ **Immutable Audit Logs** - Complete action history
- ✅ **Hotel Isolation** - Multi-tenancy at DB level
- ✅ **State Machines** - For booking workflows

## 📚 Tech Stack

**Backend:**
- Node.js + Express
- PostgreSQL (with ACID compliance)
- JWT Authentication
- bcrypt for password hashing

**Frontend:**
- React (to be implemented)
- Vite
- Tailwind CSS

**DevOps:**
- Docker & Docker Compose
- PostgreSQL in container

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 18+ (if running locally)
- PostgreSQL 15+ (if not using Docker)

### Option 1: Docker (Recommended)

```bash
# 1. Clone and navigate
cd hotel-cms

# 2. Start all services
docker-compose up -d

# 3. Database will auto-initialize with schema
# Wait for services to be healthy
docker-compose ps

# 4. API will be available at:
#    http://localhost:5000
```

### Option 2: Local Development

```bash
# 1. Install PostgreSQL locally and create database
createdb hotel_cms

# 2. Run the schema
psql -U postgres -d hotel_cms -f schema.sql

# 3. Setup backend
cd backend
npm install
cp .env.example .env
# Edit .env with your settings
npm run dev

# 4. Backend runs on http://localhost:5000
```

## 📊 Database Schema

The schema includes:

- **IAM Tables**: users, roles, permissions, user_roles, role_permissions
- **Policy Tables**: policy_limits, hotel_limits, usage_counters
- **Domain Tables**: hotels, rooms, room_types, bookings, services, tasks
- **Audit Tables**: audit_logs (immutable)

### Default Super Admin

```
Email: admin@hotelcms.com
Password: Admin@123
```

**⚠️ CHANGE THIS IMMEDIATELY IN PRODUCTION**

## 🔑 API Authentication

All protected endpoints require JWT token in header:

```
Authorization: Bearer <your-jwt-token>
```

### Get Token

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@hotelcms.com",
    "password": "Admin@123"
  }'
```

## 📝 API Endpoints

### Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/register` | Register new user | No |
| POST | `/api/auth/login` | Login and get token | No |
| GET | `/api/auth/me` | Get current user | Yes |
| POST | `/api/auth/change-password` | Change password | Yes |

### Rooms

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| POST | `/api/rooms` | Create room | ROOM_CREATE |
| GET | `/api/rooms/hotel/:hotel_id` | List rooms | ROOM_VIEW |
| GET | `/api/rooms/:room_id` | Get room details | ROOM_VIEW |
| PATCH | `/api/rooms/:room_id/status` | Update status | ROOM_UPDATE_STATUS |
| PUT | `/api/rooms/:room_id` | Update room | ROOM_UPDATE |
| DELETE | `/api/rooms/:room_id` | Delete room | ROOM_DELETE |

### Example: Create a Room

```bash
curl -X POST http://localhost:5000/api/rooms \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "hotel_id": "uuid-here",
    "room_type_id": "uuid-here",
    "room_number": "101",
    "floor": 1,
    "status": "AVAILABLE"
  }'
```

## 🔒 Roles & Permissions

### Roles

1. **SUPER_ADMIN**
   - Full system access
   - Manages all hotels
   - Can override quotas
   - No hotel restrictions

2. **HOTEL_ADMIN**
   - Manages their assigned hotel
   - Full CRUD on hotel resources
   - Cannot delete hotel
   - Subject to quotas

3. **STAFF**
   - Operational tasks only
   - View bookings/rooms
   - Update room status
   - Check-in/check-out guests

### Permission Examples

```
HOTEL_CREATE, HOTEL_UPDATE, HOTEL_VIEW
ROOM_CREATE, ROOM_UPDATE, ROOM_DELETE, ROOM_VIEW, ROOM_UPDATE_STATUS
BOOKING_CREATE, BOOKING_UPDATE, BOOKING_CANCEL, BOOKING_VIEW
USER_CREATE, USER_UPDATE, USER_DELETE
LIMIT_OVERRIDE (Super Admin only)
```

## 📊 Quota System

### How It Works

1. **Policy Limits** define what can be limited
2. **Hotel Limits** set actual limits per hotel
3. **Usage Counters** track current usage
4. **Middleware** enforces before action

### Example Flow

```
Hotel Admin creates a room
     ↓
Auth Middleware → Verified
     ↓
RBAC Middleware → Has ROOM_CREATE permission
     ↓
Quota Middleware → Checks current rooms vs limit
     ↓
     If under limit: Allow
     If at/over limit: 403 Forbidden
     ↓
Service Layer → Creates room + increments counter
```

### Default Limits

```sql
hotel_create: 1 (global)
room_create: 50 (per hotel)
user_create: 20 (per hotel)
booking_create: 100 (per hotel)
```

## 🔍 Audit Logging

Every critical action is logged:

- Who did it (`user_id`)
- What was done (`action`)
- On which entity (`entity_type`, `entity_id`)
- Old vs new data (JSON)
- When (`created_at`)
- From where (`ip_address`, `user_agent`)

**Audit logs are immutable** - protected by database triggers.

## 🏗️ Project Structure

```
hotel-cms/
├── schema.sql              # Complete PostgreSQL schema
├── docker-compose.yml      # Full stack orchestration
├── backend/
│   ├── src/
│   │   ├── server.js      # Express app entry
│   │   ├── config/
│   │   │   └── database.js # PostgreSQL connection
│   │   ├── middleware/
│   │   │   ├── auth.middleware.js    # JWT verification
│   │   │   ├── rbac.middleware.js    # Permission checks
│   │   │   └── quota.middleware.js   # Limit enforcement
│   │   └── modules/
│   │       ├── iam/        # Identity & Access
│   │       ├── policy/     # Quota management
│   │       ├── room/       # Room management (COMPLETE)
│   │       ├── hotel/      # Hotel management (TODO)
│   │       ├── booking/    # Booking system (TODO)
│   │       └── audit/      # Audit logs (TODO)
│   ├── package.json
│   └── .env.example
└── frontend/               # React app (TODO)
```

## ✅ What's Implemented

- ✅ Complete PostgreSQL schema with all tables
- ✅ Auth system (register, login, JWT)
- ✅ Auth middleware
- ✅ RBAC middleware (permission & role checks)
- ✅ Quota middleware (with enforcement)
- ✅ Complete Room module (service, controller, routes)
- ✅ Audit logging helpers
- ✅ Docker setup
- ✅ Database triggers for updated_at
- ✅ Immutable audit log protection

## 🚧 TODO Modules

### High Priority

1. **Hotel Management**
   - Create/update hotels
   - Assign hotel admins
   - Hotel settings

2. **Booking System**
   - State machine (CREATED → CONFIRMED → CHECKED_IN → COMPLETED)
   - Booking status history (immutable)
   - Payment tracking

3. **Policy/Quota Module**
   - View usage stats
   - Update limits (Super Admin)
   - Usage reports

### Medium Priority

4. **Service Management**
   - Service categories
   - Service items
   - Menu management

5. **Task Management**
   - Create tasks from bookings
   - Assign to staff
   - Status tracking

6. **Reports Module**
   - Daily/monthly reports
   - Revenue summaries
   - Occupancy rates

### Frontend (All)

- Super Admin dashboard
- Hotel Admin dashboard
- Staff interface
- Quota usage widgets
- Booking calendar
- Audit log viewer

## 🧪 Testing

```bash
# Test database connection
psql -U postgres -d hotel_cms -c "SELECT NOW();"

# Test API health
curl http://localhost:5000/health

# Test login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hotelcms.com","password":"Admin@123"}'
```

## 🔐 Security Features

- ✅ Password hashing with bcrypt
- ✅ JWT with expiration
- ✅ Permission-based access control
- ✅ Hotel-level data isolation
- ✅ SQL injection prevention (parameterized queries)
- ✅ Immutable audit logs
- ✅ Database triggers for data integrity

## 📈 Scalability

- Horizontal scaling ready (stateless API)
- PostgreSQL connection pooling
- Hotel-level sharding potential
- Row-level security (future)
- Redis caching (future)

## 🤝 Contributing

This is a reference implementation. To extend:

1. Copy a working module (e.g., `room`)
2. Adapt service, controller, routes
3. Add permissions to seed data
4. Add policy limits if needed
5. Implement audit logging

## 📄 License

MIT

## 🎓 Learning Resources

This project demonstrates:

- RBAC vs Quota systems
- Audit logging patterns
- Multi-tenancy in PostgreSQL
- State machines in bookings
- Modular monolith architecture
- SaaS-ready design patterns

---

**Built with ❤️ for proper hotel management**

Need help? Check the implementation guide in `hotel-cms-guide.md`
