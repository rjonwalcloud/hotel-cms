# 🚀 Deploy to Render.com

Complete guide for deploying Hotel CMS to Render with PostgreSQL database.

## 📋 Prerequisites

- GitHub account
- Render account (free tier available)
- Git repository with this code

---

## 🎯 Option 1: One-Click Deploy (Recommended)

### Step 1: Push to GitHub

```bash
cd hotel-cms
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/hotel-cms.git
git push -u origin main
```

### Step 2: Deploy via Blueprint

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"Blueprint"**
3. Connect your GitHub repository
4. Select the `hotel-cms` repository
5. Render will detect `render.yaml` automatically
6. Click **"Apply"**

**That's it!** Render will:
- Create PostgreSQL database
- Deploy backend API
- Run migrations automatically
- Generate secure JWT secret
- Configure environment variables

### Step 3: Access Your API

After deployment completes (~5 minutes):

```
API URL: https://hotel-cms-api.onrender.com
Database: Auto-configured (internal connection)
```

### Step 4: Get Database Credentials

1. Go to your PostgreSQL service in Render dashboard
2. Copy **Internal Database URL**
3. Use these credentials to connect from local tools if needed

### Step 5: Test the Deployment

```bash
# Health check
curl https://hotel-cms-api.onrender.com/health

# Login
curl -X POST https://hotel-cms-api.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hotelcms.com","password":"Admin@123"}'
```

---

## 🔧 Option 2: Manual Setup

### Step 1: Create PostgreSQL Database

1. In Render Dashboard, click **"New +"** → **"PostgreSQL"**
2. Configure:
   - **Name:** `hotel-cms-db`
   - **Database:** `hotel_cms`
   - **User:** `hotel_admin`
   - **Region:** Choose closest to you
   - **Plan:** Free or Starter
3. Click **"Create Database"**
4. Wait for provisioning (~2 minutes)
5. Copy **Internal Database URL**

### Step 2: Create Web Service

1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository
3. Configure:
   - **Name:** `hotel-cms-api`
   - **Environment:** Node
   - **Region:** Same as database
   - **Branch:** `main`
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free or Starter

### Step 3: Configure Environment Variables

Add these in the "Environment" tab:

```
NODE_ENV=production
PORT=5000
DB_HOST=[Internal Database Host from Step 1]
DB_PORT=5432
DB_NAME=hotel_cms
DB_USER=hotel_admin
DB_PASSWORD=[Password from Step 1]
DB_SSL=true
JWT_SECRET=[Generate random 32+ char string]
CORS_ORIGIN=*
```

**Generate JWT Secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 4: Deploy

1. Click **"Create Web Service"**
2. Wait for build & deployment (~5 minutes)
3. Render will run migrations automatically via `postinstall` script

### Step 5: Manual Migration (if needed)

If automatic migration fails:

1. Go to your PostgreSQL service
2. Click **"Connect"** → **"PSQL Command"**
3. Run migrations:

```bash
# From Render Shell
cd backend
npm run migrate
```

---

## 🔒 Production Configuration

### Environment Variables to Update

After deployment, update these:

1. **JWT_SECRET** - Generate new secure secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

2. **CORS_ORIGIN** - Set to your frontend domain:
```
CORS_ORIGIN=https://your-frontend.com
```

3. **Change Default Admin Password**

```bash
# Login first
TOKEN=$(curl -s -X POST https://your-api.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hotelcms.com","password":"Admin@123"}' | jq -r '.token')

# Change password
curl -X POST https://your-api.onrender.com/api/auth/change-password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"oldPassword":"Admin@123","newPassword":"YourNewSecurePassword123!"}'
```

---

## 📊 Database Management

### Access Database

**Via Render Dashboard:**
1. Go to PostgreSQL service
2. Click "Connect" → "PSQL Command"
3. Copy and run in terminal

**Via GUI (TablePlus, DBeaver):**
- Use **External Database URL** from Render
- Enable SSL connection

### Backup Database

Render auto-backups on paid plans. For free tier:

```bash
# From local machine
pg_dump "postgresql://user:pass@host:port/hotel_cms" > backup.sql
```

### Reset Database

```bash
# Connect to database
psql [External Database URL]

# Drop and recreate
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

# Re-run migrations
cd backend
npm run migrate
```

---

## 🔍 Monitoring & Logs

### View Logs

1. Go to Web Service dashboard
2. Click **"Logs"** tab
3. Real-time logs appear here

### Monitor Resources

1. Go to Web Service dashboard
2. Click **"Metrics"** tab
3. See CPU, Memory, Request stats

### Set Up Alerts

1. Go to Settings
2. Enable "Deploy Notifications"
3. Add webhook/email for alerts

---

## ⚡ Performance Optimization

### Enable Caching

Add to environment variables:
```
NODE_ENV=production
COMPRESSION=true
```

### Scale Up

On paid plans:
- Increase instance size
- Add more instances
- Upgrade database

### Add CDN

Use Cloudflare in front of Render:
1. Add your domain to Cloudflare
2. Point DNS to Render
3. Enable caching rules

---

## 🐛 Troubleshooting

### Build Fails

**Issue:** `npm install` fails
**Solution:** Check Node version in `package.json` engines

**Issue:** Migration fails
**Solution:** Run manually via Render shell

### Database Connection Fails

**Issue:** `ECONNREFUSED`
**Solution:** Check `DB_SSL=true` is set

**Issue:** `password authentication failed`
**Solution:** Verify DB_PASSWORD matches Render dashboard

### API Not Responding

**Issue:** 503 Service Unavailable
**Solution:** Check logs for errors, ensure migrations ran

**Issue:** CORS errors
**Solution:** Update CORS_ORIGIN to match frontend domain

### Slow Performance

**Issue:** API slow on free tier
**Solution:** 
- Free tier spins down after inactivity
- Upgrade to paid plan for always-on
- First request after idle takes 30-60s

---

## 💰 Costs

### Free Tier
- **Web Service:** Free (spins down after 15min inactivity)
- **PostgreSQL:** Free (90 days, then $7/month)
- **Bandwidth:** 100GB/month free

### Starter Plan
- **Web Service:** $7/month (always on)
- **PostgreSQL:** $7/month
- **Total:** ~$14/month

### Recommended for Production
- **Web Service:** Standard ($25/month)
- **PostgreSQL:** Standard ($20/month)
- **Total:** ~$45/month

---

## 📚 Additional Resources

- [Render Docs](https://render.com/docs)
- [PostgreSQL on Render](https://render.com/docs/databases)
- [Node.js on Render](https://render.com/docs/deploy-node-express-app)
- [Custom Domains](https://render.com/docs/custom-domains)

---

## ✅ Post-Deployment Checklist

- [ ] API health check passes
- [ ] Login works
- [ ] Database migrations completed
- [ ] JWT secret changed
- [ ] Default admin password changed
- [ ] CORS configured correctly
- [ ] SSL certificate active (auto by Render)
- [ ] Monitoring/alerts enabled
- [ ] Backup strategy in place

---

**Your Hotel CMS is now live on Render! 🎉**
