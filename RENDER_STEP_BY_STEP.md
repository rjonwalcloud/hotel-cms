# 🚀 Render Deployment - Complete Step-by-Step Guide

## Overview

This guide will walk you through deploying the Hotel CMS to Render.com with:
- PostgreSQL Database
- Backend API (Node.js)
- Automatic SSL
- Environment Variables
- Database Migrations

**Total Time:** 15-20 minutes
**Cost:** $14/month (Starter) or Free for testing

---

## 📋 Prerequisites

Before starting, you need:
- [ ] GitHub account
- [ ] Render.com account (sign up at https://render.com)
- [ ] Your Hotel CMS code in a GitHub repository

---

## Part 1: Push Code to GitHub

### Step 1.1: Initialize Git Repository

Open terminal in your `hotel-cms` folder:

```bash
cd hotel-cms

# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - Hotel CMS ready for deployment"
```

### Step 1.2: Create GitHub Repository

1. Go to https://github.com
2. Click **"+"** (top right) → **"New repository"**
3. Fill in:
   - **Repository name:** `hotel-cms`
   - **Description:** `Hotel Management System - SaaS Platform`
   - **Visibility:** Private or Public
   - **DO NOT** initialize with README (you already have code)
4. Click **"Create repository"**

### Step 1.3: Push to GitHub

Copy the commands from GitHub (under "push an existing repository"):

```bash
git remote add origin https://github.com/YOUR_USERNAME/hotel-cms.git
git branch -M main
git push -u origin main
```

**Verify:** Refresh your GitHub page - you should see all files uploaded.

---

## Part 2: Create PostgreSQL Database on Render

### Step 2.1: Login to Render

1. Go to https://dashboard.render.com
2. Login with your account
3. You'll see the Render Dashboard

### Step 2.2: Create New PostgreSQL Database

1. Click **"New +"** button (top right)
2. Select **"PostgreSQL"**

### Step 2.3: Configure Database

Fill in the form:

**Basic Info:**
- **Name:** `hotel-cms-db`
- **Database:** `hotel_cms`
- **User:** `hotel_admin`
- **Region:** Select closest to your users
  - Oregon (US West)
  - Ohio (US East)
  - Frankfurt (Europe)
  - Singapore (Asia)

**Plan Selection:**
- **Free** (for testing only - expires after 90 days)
- **Starter** ($7/month - recommended for production)
- **Standard** ($20/month - for serious production)

**Advanced Settings (expand):**
- **PostgreSQL Version:** 15 (default)
- Leave other settings as default

### Step 2.4: Create Database

1. Click **"Create Database"**
2. Wait 2-3 minutes for provisioning
3. You'll see a success message

### Step 2.5: Save Database Connection Info

Once created, you'll see the database dashboard. **Copy these values** (you'll need them):

1. Click on **"Info"** tab
2. Copy these values to a text file:

```
Internal Database URL: postgres://hotel_admin:xxxxx@dpg-xxxxx/hotel_cms
External Database URL: postgres://hotel_admin:xxxxx@dpg-xxxxx-a.oregon-postgres.render.com/hotel_cms
Hostname: dpg-xxxxx-a.oregon-postgres.render.com
Port: 5432
Database: hotel_cms
Username: hotel_admin
Password: [long random string]
```

**Important:** 
- **Internal URL** = Use for Render services
- **External URL** = Use for local database tools (TablePlus, DBeaver)

---

## Part 3: Create Backend API Service

### Step 3.1: Create New Web Service

1. Go back to Dashboard (click "Render" logo)
2. Click **"New +"** → **"Web Service"**

### Step 3.2: Connect GitHub Repository

You'll see "Create a new Web Service" page:

1. Click **"Connect account"** under GitHub (if first time)
2. Authorize Render to access your GitHub
3. You'll see list of repositories
4. Find **"hotel-cms"** and click **"Connect"**

**If you don't see your repo:**
- Click "Configure account" 
- Select repositories to give Render access
- Save

### Step 3.3: Configure Web Service

Fill in the form carefully:

**Basic Info:**
- **Name:** `hotel-cms-api` (this becomes your URL)
- **Region:** **SAME as database** (important!)
- **Branch:** `main`
- **Root Directory:** `backend` ⚠️ **Important!**
- **Runtime:** `Node`

**Build & Deploy:**
- **Build Command:** `npm install`
- **Start Command:** `npm start`

**Plan:**
- **Free** (for testing - sleeps after 15 min inactivity)
- **Starter** ($7/month - recommended, always on)
- **Standard** ($25/month - production)

### Step 3.4: Configure Environment Variables

Scroll down to **"Environment Variables"** section.

Click **"Add Environment Variable"** and add each one:

#### Variable 1: NODE_ENV
```
Key: NODE_ENV
Value: production
```

#### Variable 2: PORT
```
Key: PORT
Value: 5000
```

#### Variable 3: DB_HOST
```
Key: DB_HOST
Value: [Copy from database Internal URL - the part after @ and before /]
Example: dpg-xxxxx-a.oregon-postgres.render.com
```

#### Variable 4: DB_PORT
```
Key: DB_PORT
Value: 5432
```

#### Variable 5: DB_NAME
```
Key: DB_NAME
Value: hotel_cms
```

#### Variable 6: DB_USER
```
Key: DB_USER
Value: hotel_admin
```

#### Variable 7: DB_PASSWORD
```
Key: DB_PASSWORD
Value: [Copy from database Password field]
```

#### Variable 8: DB_SSL
```
Key: DB_SSL
Value: true
```

#### Variable 9: JWT_SECRET

Generate a secure random string:

**Option A - Online:**
1. Go to https://www.random.org/strings/
2. Generate 1 string of 64 characters
3. Copy the result

**Option B - Terminal:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

```
Key: JWT_SECRET
Value: [Your 64-character random string]
```

#### Variable 10: CORS_ORIGIN
```
Key: CORS_ORIGIN
Value: *
```

**Note:** Change `*` to your frontend domain later in production

#### Variable 11: RATE_LIMIT_WINDOW_MS
```
Key: RATE_LIMIT_WINDOW_MS
Value: 900000
```

#### Variable 12: RATE_LIMIT_MAX_REQUESTS
```
Key: RATE_LIMIT_MAX_REQUESTS
Value: 100
```

**Summary - You should have 12 environment variables:**
1. NODE_ENV
2. PORT
3. DB_HOST
4. DB_PORT
5. DB_NAME
6. DB_USER
7. DB_PASSWORD
8. DB_SSL
9. JWT_SECRET
10. CORS_ORIGIN
11. RATE_LIMIT_WINDOW_MS
12. RATE_LIMIT_MAX_REQUESTS

### Step 3.5: Advanced Settings (Optional)

Expand **"Advanced"** section:

- **Auto-Deploy:** Yes (recommended)
- **Health Check Path:** `/health`
- **Docker Command:** Leave empty

### Step 3.6: Create Web Service

1. Review all settings
2. Click **"Create Web Service"**
3. You'll be taken to the deployment page

---

## Part 4: Monitor Deployment

### Step 4.1: Watch Build Progress

You'll see the **"Logs"** tab showing real-time deployment:

```
==> Cloning from https://github.com/YOUR_USERNAME/hotel-cms...
==> Checking out commit xxxxx in branch main
==> Installing dependencies
==> Running 'npm install'
==> Running postinstall script
==> Starting server
==> Your service is live 🎉
```

**This takes 3-5 minutes.**

### Step 4.2: Check for Errors

If you see errors:

**Common Error 1: Database Connection Failed**
```
Error: ECONNREFUSED
```
**Fix:** Check DB_HOST, DB_PASSWORD are correct

**Common Error 2: Module Not Found**
```
Error: Cannot find module 'express'
```
**Fix:** Check "Root Directory" is set to `backend`

**Common Error 3: Migration Failed**
```
Error: relation "users" does not exist
```
**Fix:** Run migrations manually (see Step 5)

### Step 4.3: Verify Deployment Success

Once you see **"Your service is live"**:

1. Click on the URL at top (something like `https://hotel-cms-api.onrender.com`)
2. You should see:
```json
{"status":"OK","message":"Hotel CMS API"}
```

---

## Part 5: Run Database Migrations

### Step 5.1: Check if Auto-Migration Worked

The `postinstall` script should auto-run migrations. Let's verify:

Test the login endpoint:
```bash
curl -X POST https://hotel-cms-api.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hotelcms.com","password":"Admin@123"}'
```

**If you get a valid response with token:** ✅ Migrations worked!

**If you get database errors:** Continue to manual migration.

### Step 5.2: Manual Migration (if needed)

1. In your Render service dashboard, click **"Shell"** tab
2. Click **"Connect"** (opens a terminal)
3. Run migration:

```bash
cd backend
npm run migrate
```

Wait for:
```
✅ Schema applied successfully
✅ Created 15 tables
```

### Step 5.3: Verify Database Tables

Check if tables were created:

1. Go to your PostgreSQL database dashboard
2. Click **"Connect"** → Copy the **PSQL Command**
3. Open terminal on your computer
4. Paste and run the command
5. Once connected:

```sql
\dt
```

You should see 15 tables:
- users
- roles
- permissions
- hotels
- rooms
- bookings
- etc.

Type `\q` to exit.

---

## Part 6: Test the Deployment

### Step 6.1: Health Check

```bash
curl https://hotel-cms-api.onrender.com/health
```

Expected response:
```json
{"status":"OK","timestamp":"2024-02-09T..."}
```

### Step 6.2: Login Test

```bash
curl -X POST https://hotel-cms-api.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hotelcms.com","password":"Admin@123"}'
```

Expected response:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "...",
    "email": "admin@hotelcms.com",
    ...
  }
}
```

**Save the token for next tests!**

### Step 6.3: Test Protected Endpoint

Replace `YOUR_TOKEN` with the token from previous step:

```bash
curl https://hotel-cms-api.onrender.com/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Expected: Your user details

### Step 6.4: Test Creating a Hotel

```bash
curl -X POST https://hotel-cms-api.onrender.com/api/hotels \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Hotel",
    "city": "New York",
    "country": "USA",
    "phone": "+1234567890",
    "email": "test@hotel.com"
  }'
```

Expected: Hotel created response with ID

---

## Part 7: Configure Custom Domain (Optional)

### Step 7.1: Add Custom Domain

1. In your service dashboard, click **"Settings"**
2. Scroll to **"Custom Domain"**
3. Click **"Add Custom Domain"**
4. Enter your domain: `api.yourdomain.com`

### Step 7.2: Configure DNS

Render will show you DNS records to add:

**Option A: CNAME (Recommended)**
```
Type: CNAME
Name: api
Value: hotel-cms-api.onrender.com
```

**Option B: A Record**
```
Type: A
Name: api
Value: [IP address shown by Render]
```

Go to your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.):
1. Add the DNS record
2. Save changes
3. Wait 5-60 minutes for DNS propagation

### Step 7.3: Verify Custom Domain

Once DNS propagates:

```bash
curl https://api.yourdomain.com/health
```

### Step 7.4: Update CORS

In Render dashboard:
1. Go to **"Environment"** tab
2. Find **CORS_ORIGIN**
3. Click **"Edit"**
4. Change value to: `https://yourdomain.com`
5. Click **"Save"**

Service will auto-redeploy.

---

## Part 8: Security & Production Setup

### Step 8.1: Change Default Admin Password

```bash
# 1. Login to get token
TOKEN=$(curl -s -X POST https://hotel-cms-api.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hotelcms.com","password":"Admin@123"}' \
  | jq -r '.token')

# 2. Change password
curl -X POST https://hotel-cms-api.onrender.com/api/auth/change-password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "oldPassword": "Admin@123",
    "newPassword": "YourNewSecurePassword123!"
  }'
```

### Step 8.2: Enable Automatic Backups

1. Go to your PostgreSQL database dashboard
2. Click **"Settings"** tab
3. Find **"Backups"** section
4. Click **"Enable Backups"** (requires paid plan)

**Free Plan Alternative:**
- Manually export database weekly
- Use the External Database URL with pg_dump

```bash
pg_dump "postgres://hotel_admin:password@host/hotel_cms" > backup.sql
```

### Step 8.3: Set Up Monitoring

1. In service dashboard, click **"Metrics"** tab
2. Review:
   - Request count
   - Response time
   - Memory usage
   - CPU usage

**Optional:** Integrate with:
- Sentry (error tracking)
- Datadog (advanced monitoring)
- LogDNA (log management)

### Step 8.4: Enable Alerts

1. Go to **"Settings"** → **"Notifications"**
2. Enable:
   - Deploy notifications
   - Service health alerts
3. Add email/webhook

---

## Part 9: Database Management

### Step 9.1: Connect with GUI Tool

Use **TablePlus**, **DBeaver**, or **pgAdmin**:

**Connection Settings:**
- **Host:** [From External Database URL]
- **Port:** 5432
- **Database:** hotel_cms
- **Username:** hotel_admin
- **Password:** [From database dashboard]
- **SSL:** Require

### Step 9.2: Backup Database

**Via Render Dashboard:**
1. Go to PostgreSQL database
2. Click **"Backups"** tab (paid plans)
3. Click **"Create Backup"**
4. Download when ready

**Via Command Line:**
```bash
# Export
pg_dump "EXTERNAL_DATABASE_URL" > backup_$(date +%Y%m%d).sql

# Import
psql "EXTERNAL_DATABASE_URL" < backup_20240209.sql
```

### Step 9.3: View Database Logs

1. Go to PostgreSQL database dashboard
2. Click **"Logs"** tab
3. Monitor queries and errors

---

## Part 10: Troubleshooting

### Issue: Build Fails

**Error:** `Module not found`

**Solution:**
1. Check package.json exists in `backend/` folder
2. Verify "Root Directory" is set to `backend`
3. Re-deploy

### Issue: Database Connection Fails

**Error:** `ECONNREFUSED` or `password authentication failed`

**Solution:**
1. Check all DB_* environment variables
2. Ensure DB_SSL=true
3. Verify database is in same region
4. Check database is running (not paused)

### Issue: Migrations Don't Run

**Error:** `relation "users" does not exist`

**Solution:**
1. Use Shell to manually run: `npm run migrate`
2. Check logs for migration errors
3. Verify database user has CREATE privileges

### Issue: Service Won't Start

**Error:** `Application failed to respond`

**Solution:**
1. Check logs for errors
2. Verify PORT=5000 is set
3. Ensure Health Check Path is `/health`
4. Check node version in package.json

### Issue: Slow Response (Free Tier)

**Problem:** First request takes 30+ seconds

**Explanation:** Free tier spins down after 15 minutes of inactivity

**Solutions:**
- Upgrade to Starter plan ($7/month)
- Use a ping service (https://uptimerobot.com)
- Accept the delay for testing

---

## Part 11: Deployment Checklist

Before going live, verify:

### Technical
- [ ] Database created and running
- [ ] All 12 environment variables set
- [ ] Migrations completed successfully
- [ ] Health check passing
- [ ] Login working
- [ ] CRUD operations tested
- [ ] SSL certificate active (automatic)

### Security
- [ ] JWT_SECRET is random and secure
- [ ] Admin password changed from default
- [ ] CORS_ORIGIN set to your domain (not *)
- [ ] Database backups enabled
- [ ] Environment variables are private

### Optional
- [ ] Custom domain configured
- [ ] Monitoring enabled
- [ ] Alerts configured
- [ ] Error tracking (Sentry) setup

---

## Part 12: Costs Summary

### Free Tier (Testing Only)
- Web Service: Free (spins down after 15 min)
- PostgreSQL: Free for 90 days
- **Total: $0/month** (limited, not for production)

### Starter Plan (Recommended)
- Web Service: $7/month (512MB RAM, always on)
- PostgreSQL: $7/month (256MB RAM, 1GB storage)
- **Total: $14/month**

### Standard Plan (Production)
- Web Service: $25/month (2GB RAM)
- PostgreSQL: $20/month (4GB RAM, 10GB storage)
- **Total: $45/month**

---

## Part 13: Next Steps

### Immediate
1. Test all API endpoints
2. Create test hotel, room, booking
3. Verify quota system works
4. Check audit logs

### Within 24 Hours
1. Monitor error logs
2. Check response times
3. Verify backups
4. Test password reset

### Within 1 Week
1. Load testing
2. Frontend deployment (if applicable)
3. User testing
4. Documentation update

---

## 📞 Support

**Render Support:**
- Documentation: https://render.com/docs
- Community: https://community.render.com
- Email: support@render.com

**Database Issues:**
- Check PostgreSQL logs
- Verify connection strings
- Test with psql command line

**Application Issues:**
- Check service logs in dashboard
- Use Shell for debugging
- Review environment variables

---

## ✅ Success Checklist

Your deployment is successful when:

- [ ] Can access: `https://your-service.onrender.com/health`
- [ ] Can login and get JWT token
- [ ] Can create hotel (Super Admin)
- [ ] Can create room (Hotel Admin)
- [ ] Can create booking
- [ ] Database persists data
- [ ] Logs show no errors
- [ ] Response time <500ms

---

**🎉 Congratulations! Your Hotel CMS is live on Render!**

Your API URL: `https://hotel-cms-api.onrender.com`

Save this guide for future reference and updates.
