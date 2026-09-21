# Hotel CMS - SaaS Hotel Management Platform


A full-stack, multi-tenant SaaS platform for hotel management built with **Node.js/Express**, **React**, and **PostgreSQL**. Supports multiple hotels, role-based access control, QR code room services, external booking channel integration, subscription management, and audit logging.

---demo2

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Roles & Permissions](#roles--permissions)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Quick Start with Docker](#quick-start-with-docker)
  - [Manual Setup](#manual-setup)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [Deployment](#deployment)
  - [Docker Compose](#docker-compose-production)
  - [Render.com](#rendercom)
  - [VPS / Linux Server](#vps--linux-server)
- [Default Credentials](#default-credentials)
- [Project Structure](#project-structure)
- [License](#license)
- [Disclaimer](#disclaimer)

---

## Features

### Hotel CRUD (SuperAdmin)
- Create, update, activate/deactivate hotels
- Hotel statistics (rooms, bookings, revenue)
- Multi-hotel support with per-hotel isolation

### Room CRUD (SuperAdmin + HotelAdmin)
- Create/update/delete rooms with room types
- Room status management: Available, Occupied, Maintenance, Blocked
- Floor-based organization, pricing, and occupancy tracking

### Bookings (HotelAdmin + Staff)
- Create, update, cancel bookings
- Full booking lifecycle: Created -> Confirmed -> Checked-In -> Checked-Out
- Availability checking, guest management, payment tracking
- Booking status history with audit trail

### Booking Manager (HotelAdmin)
- External booking channel integration: **OYO**, **Booking.com**, **MakeMyTrip**, **Goibibo**, **Agoda**, **Expedia**, **Airbnb**
- Channel CRUD with API key/secret and commission rate configuration
- Channel bookings tracking and status management
- Revenue analytics and commission reports per channel

### QR Code for Rooms (HotelAdmin)
- Generate unique QR codes for each room
- Bulk generation for all rooms at once
- **Public guest-facing page** (`/room-services/:token`) - no login required
- Guests scan QR to browse and request hotel services (room cleaning, food, amenities)
- Service request queue with status workflow: Pending -> Accepted -> In Progress -> Completed
- Download QR codes as PNG for printing

### Services CRUD (SuperAdmin + HotelAdmin)
- Service categories (e.g., Food & Beverage, Housekeeping, Spa)
- Service items with pricing and availability toggles
- 5-star hotel amenity management (room cleaning, food delivery, laundry, etc.)

### Audit Logs (SuperAdmin)
- Immutable audit trail for all system actions
- Filter by user, action type, entity, date range
- Entity change history tracking (old data vs new data)
- CSV export capability
- Database triggers prevent log modification/deletion

### Subscription Management (SuperAdmin)
- **4 built-in plans**: Free ($0), Starter ($29.99), Professional ($79.99), Enterprise ($199.99)
- Plan CRUD with configurable limits (max hotels, rooms, bookings, staff)
- Activate/renew/cancel subscriptions per hotel
- Subscription history with status tracking
- Auto-updates hotel quota limits based on plan tier

### Operations & Billing
- **Restaurant POS System**: Premium Point of Sale for hotel staff with guest search, cart, and payment options (Post to Room or Pay Now).
- **Advanced Analytics**: Real-time dashboards for revenue, occupancy, ADR, and RevPAR with interactive charts and PDF/CSV exports.
- **Sequential Invoicing**: Automated, formatted invoice numbering (e.g., `PREFIX/inv/YYYY/MM/0001`) with per-hotel counters and tax itemization.
- **Task Management**: Staff task assignment and booking-linked operational workflows.
- **Quota Management**: Per-hotel resource limits with real-time usage tracking.

---

## Tech Stack

### Backend
| Technology | Purpose |
|---|---|
| Node.js (>=18) | Runtime |
| Express.js 4 | HTTP framework |
| PostgreSQL 15 | Database |
| JWT | Authentication |
| bcrypt | Password hashing |
| Joi | Input validation |
| qrcode | QR code generation |
| Helmet | Security headers |
| Morgan | HTTP logging |
| Compression | Response compression |

### Frontend
| Technology | Purpose |
|---|---|
| React 18 | UI framework |
| Vite 5 | Build tool |
| React Router 6 | Client-side routing |
| Zustand | State management |
| Axios | HTTP client |
| Tailwind CSS 3 | Styling |
| Recharts | Charts/graphs |
| Lucide React | Icons |
| React Hook Form | Form management |
| React Hot Toast | Notifications |

### Infrastructure
| Technology | Purpose |
|---|---|
| Docker & Docker Compose | Containerization |
| Nginx | Reverse proxy |
| PM2 | Process management |
| Render.com | Cloud deployment |

---

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────>│   Backend    │────>│  PostgreSQL   │
│  React/Vite  │     │  Express.js  │     │   Database    │
│  Port 3000   │     │  Port 5000   │     │   Port 5432   │
└─────────────┘     └──────────────┘     └──────────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────────┐  ┌─────────┐  ┌──────────┐
        │   IAM   │  │  Hotel  │  │  Booking │
        │ Module  │  │ Module  │  │  Module  │
        └─────────┘  └─────────┘  └──────────┘
              │            │            │
        ┌─────────┐  ┌─────────┐  ┌──────────┐
        │  Room   │  │ Service │  │  Audit   │
        │ Module  │  │ Module  │  │  Module  │
        └─────────┘  └─────────┘  └──────────┘
              │            │            │
        ┌─────────┐  ┌─────────┐  ┌──────────┐
        │ QR Code │  │Subscript│  │ Booking  │
        │ Module  │  │  Module │  │ Manager  │
        └─────────┘  └─────────┘  └──────────┘
```

---

## Roles & Permissions

| Feature | SuperAdmin | Hotel Admin | Staff |
|---|:---:|:---:|:---:|
| Hotel CRUD | Yes | - | - |
| Room CRUD | Yes | Yes | - |
| Bookings (Create/Update/Cancel) | - | Yes | Yes |
| Restaurant POS | - | Yes | Yes |
| Analytics & Reports | - | Yes | - |
| Booking Manager (OTA Sync) | - | Yes | - |
| QR Code (Room Services) | - | Yes | - |
| Services & Amenities | Yes | Yes | - |
| Audit Logs | Yes | - | - |
| Subscription Management | Yes | - | - |

### Staff Permissions Detail
Staff members can perform operational booking tasks:
- View rooms and update room status
- Create, update, and cancel bookings
- Check-in and check-out guests
- View services and tasks

---

## Getting Started

### Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **PostgreSQL** 15+
- **Docker** & **Docker Compose** (optional, recommended)

### Quick Start with Docker

```bash
# Clone the repository
git clone <repository-url>
cd hotel-cms

# Start all services (PostgreSQL + Backend + Frontend)
docker-compose up -d

# The database schema is auto-applied on first run
# Backend: http://localhost:5000
# Frontend: http://localhost:3000
```

### Manual Setup

#### 1. Database Setup

```bash
# Create database
createdb hotel_cms

# Apply schema (creates tables, roles, permissions, seed data)
psql -U postgres -d hotel_cms -f schema.sql
```

#### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Copy environment file and configure
cp .env.example .env
# Edit .env with your database credentials and JWT secret

# Start development server
npm run dev

# Server runs on http://localhost:5000
```

#### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev

# App runs on http://localhost:3000
```

---

## Environment Variables

Create `backend/.env` from `.env.example`:

```env
# Server
NODE_ENV=development
PORT=5000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=hotel_cms
DB_USER=postgres
DB_PASSWORD=postgres

# Authentication
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# CORS
CORS_ORIGIN=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

Frontend environment (optional, defaults work for local dev):

```env
VITE_API_URL=http://localhost:5000/api
```

---

## API Reference

### Authentication
| Method | Endpoint | Description | Auth |
|---|---|---|---|
| POST | `/api/auth/register` | Register new user | Public |
| POST | `/api/auth/login` | Login (returns JWT) | Public |
| GET | `/api/auth/me` | Get current user | Required |
| POST | `/api/auth/change-password` | Change password | Required |

### Hotels
| Method | Endpoint | Description | Permission |
|---|---|---|---|
| POST | `/api/hotels` | Create hotel | HOTEL_CREATE |
| GET | `/api/hotels` | List all hotels | HOTEL_VIEW |
| GET | `/api/hotels/:id` | Get hotel details | HOTEL_VIEW |
| PUT | `/api/hotels/:id` | Update hotel | HOTEL_UPDATE |
| PATCH | `/api/hotels/:id/status` | Toggle active status | HOTEL_UPDATE |
| GET | `/api/hotels/:id/stats` | Get statistics | HOTEL_VIEW |

### Rooms
| Method | Endpoint | Description | Permission |
|---|---|---|---|
| POST | `/api/rooms` | Create room | ROOM_CREATE |
| GET | `/api/rooms/hotel/:hotel_id` | List hotel rooms | ROOM_VIEW |
| GET | `/api/rooms/:id` | Get room details | ROOM_VIEW |
| PUT | `/api/rooms/:id` | Update room | ROOM_UPDATE |
| PATCH | `/api/rooms/:id/status` | Update status | ROOM_UPDATE_STATUS |
| DELETE | `/api/rooms/:id` | Delete room | ROOM_DELETE |

### Bookings
| Method | Endpoint | Description | Permission |
|---|---|---|---|
| GET | `/api/bookings/check-availability` | Check availability | BOOKING_VIEW |
| POST | `/api/bookings` | Create booking | BOOKING_CREATE |
| GET | `/api/bookings/hotel/:hotel_id` | List bookings | BOOKING_VIEW |
| GET | `/api/bookings/:id` | Get booking | BOOKING_VIEW |
| PATCH | `/api/bookings/:id/status` | Update status | BOOKING_UPDATE |
| POST | `/api/bookings/:id/cancel` | Cancel booking | BOOKING_CANCEL |
| POST | `/api/bookings/:id/checkin` | Check-in guest | BOOKING_CHECKIN |
| POST | `/api/bookings/:id/checkout` | Check-out guest | BOOKING_CHECKOUT |
| POST | `/api/bookings/:id/payment` | Add payment | BOOKING_UPDATE |

### QR Codes
| Method | Endpoint | Description | Permission |
|---|---|---|---|
| POST | `/api/qrcodes/generate` | Generate room QR | QRCODE_GENERATE |
| POST | `/api/qrcodes/bulk-generate` | Generate all room QRs | QRCODE_GENERATE |
| GET | `/api/qrcodes/hotel/:hotel_id` | List hotel QR codes | QRCODE_VIEW |
| GET | `/api/qrcodes/scan/:token` | **Public** - Scan QR | None |
| POST | `/api/qrcodes/scan/:token/request` | **Public** - Request service | None |
| GET | `/api/qrcodes/requests/hotel/:hotel_id` | List service requests | QRCODE_VIEW |
| PATCH | `/api/qrcodes/requests/:id/status` | Update request status | QRCODE_GENERATE |
| DELETE | `/api/qrcodes/:id` | Deactivate QR code | QRCODE_DELETE |

### Subscriptions
| Method | Endpoint | Description | Permission |
|---|---|---|---|
| GET | `/api/subscriptions/plans` | List plans | SUBSCRIPTION_VIEW |
| POST | `/api/subscriptions/plans` | Create plan | SUPER_ADMIN |
| PUT | `/api/subscriptions/plans/:id` | Update plan | SUPER_ADMIN |
| POST | `/api/subscriptions/activate` | Activate subscription | SUBSCRIPTION_ACTIVATE |
| POST | `/api/subscriptions/:id/renew` | Renew subscription | SUBSCRIPTION_ACTIVATE |
| POST | `/api/subscriptions/:id/cancel` | Cancel subscription | SUBSCRIPTION_CANCEL |
| GET | `/api/subscriptions/hotel/:hotel_id` | Get hotel subscription | SUBSCRIPTION_VIEW |
| GET | `/api/subscriptions` | List all subscriptions | SUPER_ADMIN |

### Booking Manager
| Method | Endpoint | Description | Permission |
|---|---|---|---|
| POST | `/api/booking-manager/channels` | Add channel | CHANNEL_CREATE |
| GET | `/api/booking-manager/channels/hotel/:hotel_id` | List channels | CHANNEL_VIEW |
| PUT | `/api/booking-manager/channels/:id` | Update channel | CHANNEL_UPDATE |
| PATCH | `/api/booking-manager/channels/:id/status` | Toggle active | CHANNEL_UPDATE |
| DELETE | `/api/booking-manager/channels/:id` | Delete channel | CHANNEL_DELETE |
| POST | `/api/booking-manager/bookings` | Add channel booking | CHANNEL_CREATE |
| GET | `/api/booking-manager/bookings/hotel/:hotel_id` | List bookings | CHANNEL_VIEW |
| PATCH | `/api/booking-manager/bookings/:id/status` | Update status | CHANNEL_UPDATE |
| GET | `/api/booking-manager/stats/hotel/:hotel_id` | Channel analytics | CHANNEL_VIEW |

### Services
| Method | Endpoint | Description | Permission |
|---|---|---|---|
| GET | `/api/services/categories/hotel/:hotel_id` | List categories | SERVICE_VIEW |
| POST | `/api/services/categories` | Create category | SERVICE_CREATE |
| PUT | `/api/services/categories/:id` | Update category | SERVICE_UPDATE |
| DELETE | `/api/services/categories/:id` | Delete category | SERVICE_DELETE |
| GET | `/api/services/items/hotel/:hotel_id` | List services | SERVICE_VIEW |
| POST | `/api/services/items` | Create service | SERVICE_CREATE |
| PUT | `/api/services/items/:id` | Update service | SERVICE_UPDATE |
| PATCH | `/api/services/items/:id/availability` | Toggle availability | SERVICE_UPDATE |

### Audit Logs
| Method | Endpoint | Description | Permission |
|---|---|---|---|
| GET | `/api/audit/hotel/:hotel_id` | Hotel audit logs | AUDIT_VIEW |
| GET | `/api/audit/all` | All system logs | SUPER_ADMIN |
| GET | `/api/audit/hotel/:hotel_id/stats` | Audit statistics | AUDIT_VIEW |
| GET | `/api/audit/hotel/:hotel_id/export` | Export CSV | AUDIT_VIEW |

### Policy / Quotas
| Method | Endpoint | Description | Permission |
|---|---|---|---|
| GET | `/api/policy/limits` | All policy limits | LIMIT_OVERRIDE |
| GET | `/api/policy/hotel/:hotel_id/limits` | Hotel limits | HOTEL_VIEW |
| POST | `/api/policy/hotel/:hotel_id/limits` | Set limit | SUPER_ADMIN |
| GET | `/api/policy/hotel/:hotel_id/usage` | Usage stats | HOTEL_VIEW |
| GET | `/api/policy/quota-summary` | Quota summary | SUPER_ADMIN |

### Health Check
| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Returns `{ status: "OK" }` |

---

## Database Schema

### Core Tables (20 total)

**IAM**: `users`, `roles`, `permissions`, `user_roles`, `role_permissions`

**Hotels & Rooms**: `hotels`, `room_types`, `rooms`

**Bookings**: `bookings`, `booking_status_history`

**Services**: `service_categories`, `service_items`, `service_requests`

**QR Codes**: `room_qr_codes`

**Subscriptions**: `subscription_plans`, `hotel_subscriptions`, `subscription_history`

**Booking Channels**: `booking_channels`, `channel_bookings`

**Operations**: `tasks`, `policy_limits`, `hotel_limits`, `usage_counters`

**Audit**: `audit_logs` (immutable - triggers prevent UPDATE/DELETE)

### Views
- `user_permissions_view` - Denormalized user + roles + permissions
- `room_availability_view` - Room availability status

---

## Deployment

### Docker Compose (Production)

```bash
# Start all services
docker-compose up -d

# Check service health
docker-compose ps

# View logs
docker-compose logs -f backend

# Stop services
docker-compose down

# Reset database (caution: destroys data)
docker-compose down -v
docker-compose up -d
```

Services:
- **PostgreSQL**: `localhost:5432` (auto-initializes with `schema.sql`)
- **Backend API**: `localhost:5000`
- **Frontend**: `localhost:3000`

### Render.com

1. Fork or push the repository to GitHub
2. Create a new **Blueprint** on Render.com
3. Connect your GitHub repository
4. Render will auto-detect `render.yaml` and create:
   - PostgreSQL database (Starter plan)
   - Backend web service (Node.js)
5. After deployment, run the schema:
   ```bash
   # Connect to Render PostgreSQL and run schema.sql
   psql $DATABASE_URL -f schema.sql
   ```
6. The `JWT_SECRET` is auto-generated by Render

### VPS / Linux Server

#### 1. Install Dependencies

```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL 15
sudo apt install -y postgresql postgresql-contrib

# Install Nginx
sudo apt install -y nginx

# Install PM2 (process manager)
sudo npm install -g pm2
```

#### 2. Setup Database

```bash
sudo -u postgres createdb hotel_cms
sudo -u postgres psql -d hotel_cms -f schema.sql
```

#### 3. Configure Backend

```bash
cd backend
npm install --production
cp .env.example .env
# Edit .env with production values:
#   NODE_ENV=production
#   DB_HOST=localhost
#   JWT_SECRET=<generate-a-strong-random-key>
#   CORS_ORIGIN=https://your-domain.com
```

#### 4. Configure Frontend

```bash
cd frontend
npm install
VITE_API_URL=https://your-domain.com/api npm run build
# Serve the dist/ folder via Nginx
```

#### 5. Configure Nginx

```bash
sudo cp nginx.conf /etc/nginx/sites-available/hotel-cms
sudo ln -s /etc/nginx/sites-available/hotel-cms /etc/nginx/sites-enabled/
# Edit the file: replace "your-domain.com" with your actual domain
sudo nginx -t
sudo systemctl reload nginx
```

#### 6. Setup SSL (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

#### 7. Start with PM2

```bash
cd backend
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

#### 8. Verify

```bash
# Check backend health
curl https://your-domain.com/health

# Check PM2 status
pm2 status

# View logs
pm2 logs hotel-cms-api
```

---

## Default Credentials

| Role | Email | Password |
|---|---|---|
| Super Admin | `admin@hotelcms.com` | `Admin@123` |

> **Important**: Change the default admin password immediately after first login.

---

## Project Structure

```
hotel-cms/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── database.js              # PostgreSQL connection pool
│   │   ├── middleware/
│   │   │   ├── auth.middleware.js        # JWT authentication
│   │   │   ├── rbac.middleware.js        # Role-based access control
│   │   │   ├── quota.middleware.js       # Resource quota enforcement
│   │   │   ├── subscription.middleware.js # Active subscription checks
│   │   │   └── errorHandler.js          # Centralized error handling & AppError class
│   │   ├── modules/
│   │   │   ├── iam/                      # Identity & Access Management
│   │   │   │   ├── controllers/
│   │   │   │   ├── services/
│   │   │   │   ├── routes/
│   │   │   │   └── tests/
│   │   │   ├── hotel/                    # Hotel CRUD
│   │   │   ├── room/                     # Room management
│   │   │   ├── booking/                  # Booking lifecycle
│   │   │   ├── service/                  # Hotel services/amenities
│   │   │   ├── policy/                   # Quota management
│   │   │   ├── audit/                    # Audit logging
│   │   │   ├── qrcode/                   # QR code generation & scanning
│   │   │   ├── subscription/             # Subscription plans & management
│   │   │   ├── booking-manager/          # External booking channels
│   │   │   ├── rate/                     # Rate plans & pricing
│   │   │   ├── promotion/                # Promotions & coupons
│   │   │   ├── addon/                    # Room addons
│   │   │   ├── task/                     # Task management
│   │   │   ├── analytics/                # Hotel analytics
│   │   │   ├── settings/                 # Hotel settings & taxes
│   │   │   ├── amenities/                # Hotel amenities
│   │   │   ├── inventory/                # Room inventory calendar
│   │   │   ├── item-inventory/           # Physical supplies & stock
│   │   │   ├── credit-note/              # Credit note management
│   │   │   ├── lost-found/               # Lost & found items
│   │   │   ├── system/                   # System backup & config
│   │   │   └── public/                   # Unauthenticated endpoints
│   │   └── server.js                     # Express app entry point
│   ├── scripts/                          # Migration & seeding scripts
│   ├── package.json
│   └── ecosystem.config.js              # PM2 configuration
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout.jsx               # Main layout wrapper
│   │   │   ├── Sidebar.jsx              # Role-aware navigation
│   │   │   ├── Header.jsx               # Top bar with user menu
│   │   │   ├── ProtectedRoute.jsx       # Route guards
│   │   │   ├── DataTable.jsx            # Reusable data table
│   │   │   ├── Modal.jsx                # Dialog component
│   │   │   └── StatsCard.jsx            # Dashboard stats card
│   │   ├── pages/
│   │   │   ├── SuperAdmin/
│   │   │   │   ├── Dashboard.jsx        # System overview
│   │   │   │   ├── HotelsList.jsx       # Hotel management
│   │   │   │   ├── SubscriptionManagement.jsx  # Plans & subscriptions
│   │   │   │   ├── QuotaManagement.jsx  # Quota configuration
│   │   │   │   └── GlobalAudit.jsx      # System audit logs
│   │   │   ├── HotelAdmin/
│   │   │   │   ├── Dashboard.jsx        # Hotel overview
│   │   │   │   ├── RoomManagement.jsx   # Room CRUD
│   │   │   │   ├── BookingManagement.jsx # Booking operations
│   │   │   │   ├── BookingManager.jsx   # External channels
│   │   │   │   ├── QRCodeManagement.jsx # QR code management
│   │   │   │   ├── ServiceManagement.jsx # Services/amenities
│   │   │   │   └── HotelSettings.jsx    # Hotel configuration
│   │   │   ├── Staff/
│   │   │   │   ├── Dashboard.jsx        # Staff overview
│   │   │   │   ├── Bookings.jsx         # Check-in/check-out
│   │   │   │   └── Rooms.jsx            # Room status
│   │   │   ├── Public/
│   │   │   │   └── RoomServices.jsx     # QR landing page (no auth)
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   └── Profile.jsx
│   │   ├── services/
│   │   │   └── api.js                   # Axios API client
│   │   ├── store/
│   │   │   └── authStore.js             # Zustand auth state
│   │   └── App.jsx                      # Router configuration
│   ├── vite.config.js
│   └── package.json
├── schema.sql                            # Complete database schema
├── docker-compose.yml                    # Local dev environment
├── render.yaml                           # Render.com deployment
├── nginx.conf                            # Reverse proxy config
├── start.sh                              # Startup script
└── .gitignore
```

---

| Plan | Price | Hotels | Rooms/Hotel | Bookings/Mo | Staff/Hotel | Included Features |
|---|---|---|---|---|---|---|
| Free | $0 | 1 | 10 | 50 | 5 | Basic Room Mgmt |
| Starter | $29.99/mo | 1 | 25 | 200 | 10 | + QR Room Services |
| Professional | $79.99/mo | 3 | 100 | 1,000 | 30 | + Restaurant POS, Analytics |
| Enterprise | $199.99/mo | 10 | 500 | 5,000 | 100 | + Multi-hotel Sync, Custom Reports |

---

## Supported Booking Channels

| Channel | Type Code |
|---|---|
| OYO | `OYO` |
| Booking.com | `BOOKING_COM` |
| MakeMyTrip | `MAKEMYTRIP` |
| Goibibo | `GOIBIBO` |
| Agoda | `AGODA` |
| Expedia | `EXPEDIA` |
| Airbnb | `AIRBNB` |
| Direct Bookings | `DIRECT` |
| Other | `OTHER` |

---

## Security

- **JWT Authentication** with 7-day token expiration
- **bcrypt** password hashing (10 salt rounds)
- **Helmet.js** security headers (CSP in production)
- **CORS** with environment-based origin restriction (`CORS_ORIGIN` in production, permissive in development)
- **Rate Limiting** (100 req/15min per IP)
- **Parameterized SQL queries** (no raw string interpolation)
- **Immutable audit logs** (DB triggers prevent modification)
- **RBAC** with granular permission checks on every endpoint
- **Input validation** via Joi schemas
- **Centralized error handling** — operational errors (4xx) vs unexpected errors (5xx) with stack trace stripping in production
- **Graceful shutdown** with forced exit timeout to prevent zombie processes
- **Unhandled rejection/exception handlers** to catch silent crashes

---

## License

This project is licensed under the **Apache License 2.0** — see the [LICENSE](file:///Users/dev/hotel-cms/LICENSE) file for details.

```
Copyright 2026 RjonWalCloud

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0
```

You are free to use, modify, and distribute this software, provided that:
- The original copyright notice and license are retained
- Changes are clearly marked
- The `NOTICE` file (if present) is included in redistributions

---

## Disclaimer

> **⚠️ USE AT YOUR OWN RISK**
>
> This software is provided **"AS IS"**, without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose, and non-infringement.
>
> In no event shall the authors or copyright holders (**RjonWalCloud**) be liable for any claim, damages, or other liability, whether in an action of contract, tort, or otherwise, arising from, out of, or in connection with the software or the use or other dealings in the software.
>
> **Before deploying to production**, you are solely responsible for:
> - Conducting your own security audit
> - Changing all default credentials
> - Configuring proper environment variables
> - Ensuring compliance with local data protection regulations (GDPR, etc.)
> - Performing adequate testing for your specific use case
>
> The authors assume **no responsibility** for data loss, security breaches, or any damages resulting from the use of this software.
