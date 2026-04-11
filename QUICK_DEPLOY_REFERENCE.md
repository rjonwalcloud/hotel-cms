# 🚀 Quick Deployment Reference

## Render Deployment (5 minutes)

### Prerequisites
- GitHub account
- Render account

### Steps
```bash
# 1. Push to GitHub
git init
git add .
git commit -m "Deploy Hotel CMS"
git push origin main

# 2. Create PostgreSQL on Render
Dashboard → New + → PostgreSQL
Name: hotel-cms-db
Database: hotel_cms
Plan: Starter ($7/mo)

# 3. Create Web Service
Dashboard → New + → Web Service
Connect: GitHub repo
Root Directory: backend
Build: npm install
Start: npm start
Plan: Starter ($7/mo)

# 4. Add Environment Variables (12 total)
NODE_ENV=production
PORT=5000
DB_HOST=[from database]
DB_PORT=5432
DB_NAME=hotel_cms
DB_USER=hotel_admin
DB_PASSWORD=[from database]
DB_SSL=true
JWT_SECRET=[generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"]
CORS_ORIGIN=*
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# 5. Deploy & Test
Wait 5 minutes
Test: curl https://your-service.onrender.com/health
```

**Cost:** $14/month (2 services × $7)
**URL:** `https://your-service-name.onrender.com`

---

## VPS Deployment (10 minutes with script)

### Prerequisites
- Ubuntu 22.04 VPS
- Root SSH access

### Automated Deployment
```bash
# SSH to VPS
ssh root@YOUR_VPS_IP

# Run deployment script
curl -o deploy.sh https://raw.githubusercontent.com/YOUR_REPO/hotel-cms/main/scripts/vps-deploy.sh
chmod +x deploy.sh
sudo ./deploy.sh

# Follow prompts:
# - Enter domain (or skip)
# - Enter database password
# - Enter email for SSL

# Wait 10 minutes
```

### Manual Deployment Quick Commands
```bash
# 1. Update system
apt update && apt upgrade -y

# 2. Install dependencies
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs postgresql postgresql-contrib nginx git
npm install -g pm2

# 3. Setup database
sudo -u postgres psql
CREATE DATABASE hotel_cms;
CREATE USER hotel_admin WITH ENCRYPTED PASSWORD 'YourPassword123!';
GRANT ALL PRIVILEGES ON DATABASE hotel_cms TO hotel_admin;
\q

# 4. Deploy code
mkdir -p /var/www/hotel-cms
cd /var/www/hotel-cms
git clone YOUR_REPO .
cd backend
npm install --production

# 5. Configure
cp .env.example .env
nano .env  # Edit with your values

# 6. Migrate database
npm run migrate

# 7. Start with PM2
pm2 start ecosystem.config.js --env production
pm2 startup systemd
pm2 save

# 8. Configure Nginx
# Copy config from VPS_STEP_BY_STEP.md
nano /etc/nginx/sites-available/hotel-cms
ln -s /etc/nginx/sites-available/hotel-cms /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx

# 9. Setup SSL (if domain)
certbot --nginx -d yourdomain.com

# 10. Configure firewall
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

**Cost:** $12-24/month
**URL:** `http://YOUR_VPS_IP` or `https://yourdomain.com`

---

## Environment Variables Reference

### Required (Both Platforms)
```env
NODE_ENV=production
PORT=5000
DB_HOST=[varies]
DB_PORT=5432
DB_NAME=hotel_cms
DB_USER=hotel_admin
DB_PASSWORD=[secure random]
JWT_SECRET=[64-char random]
CORS_ORIGIN=*
```

### Platform-Specific
```env
# Render only
DB_SSL=true

# VPS only
DB_SSL=false
DB_POOL_MAX=20
DB_POOL_MIN=2
```

---

## Testing Checklist

```bash
# Replace URL with yours
URL="https://your-api-url.com"

# 1. Health check
curl $URL/health

# 2. Login
curl -X POST $URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hotelcms.com","password":"Admin@123"}'

# 3. Get user (use token from step 2)
curl $URL/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"

# 4. Create hotel
curl -X POST $URL/api/hotels \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Hotel","city":"NYC","country":"USA"}'
```

---

## Common Commands

### Render
```bash
# View logs
Dashboard → Service → Logs tab

# Restart service
Dashboard → Service → Manual Deploy

# Access shell
Dashboard → Service → Shell → Connect

# Run migration
cd backend && npm run migrate
```

### VPS (PM2)
```bash
# Status
pm2 status

# Logs
pm2 logs hotel-cms-api

# Restart
pm2 restart hotel-cms-api

# Monitor
pm2 monit

# Update app
cd /var/www/hotel-cms
git pull
cd backend && npm install
npm run migrate
pm2 restart all
```

### VPS (System)
```bash
# Nginx
systemctl status nginx
systemctl reload nginx
nginx -t

# PostgreSQL
systemctl status postgresql
psql -U hotel_admin -d hotel_cms

# Logs
tail -f /var/log/nginx/error.log
tail -f /var/log/hotel-cms/pm2-error.log

# Resources
htop
df -h
free -h
```

---

## Troubleshooting Quick Fixes

### Issue: Database Connection Failed
```bash
# Render: Check DB_HOST, DB_PASSWORD, DB_SSL=true
# VPS: Check PostgreSQL is running
systemctl status postgresql
```

### Issue: Module Not Found
```bash
# Render: Check Root Directory = backend
# VPS: Run npm install in backend folder
cd /var/www/hotel-cms/backend && npm install
```

### Issue: Permission Denied
```bash
# VPS only
chown -R hotel-cms:hotel-cms /var/www/hotel-cms
chmod 600 /var/www/hotel-cms/backend/.env
```

### Issue: Nginx Error
```bash
# Test config
nginx -t

# Reload
systemctl reload nginx

# Check logs
tail -f /var/log/nginx/error.log
```

### Issue: App Won't Start
```bash
# Render: Check logs in dashboard
# VPS: Check PM2 logs
pm2 logs hotel-cms-api --lines 50
```

---

## Security Checklist

- [ ] JWT_SECRET is random 64+ chars
- [ ] DB_PASSWORD is strong (16+ chars)
- [ ] Admin password changed from default
- [ ] CORS_ORIGIN set to domain (not *)
- [ ] SSL certificate installed
- [ ] Firewall enabled (VPS)
- [ ] Backups configured
- [ ] Environment variables are private

---

## Cost Comparison

| Item | Render | VPS |
|------|--------|-----|
| **Starter** | $14/mo | $12/mo |
| **Production** | $45/mo | $24/mo |
| **Setup Time** | 5 min | 60 min |
| **Maintenance** | Low | Medium |
| **Control** | Limited | Full |

---

## Support Links

**Render:**
- Docs: https://render.com/docs
- Dashboard: https://dashboard.render.com

**VPS:**
- DigitalOcean: https://digitalocean.com
- PM2 Docs: https://pm2.keymetrics.io
- Nginx Docs: https://nginx.org/en/docs

**Project Docs:**
- Full Render Guide: RENDER_STEP_BY_STEP.md
- Full VPS Guide: VPS_STEP_BY_STEP.md
- Deployment Comparison: DEPLOYMENT_GUIDE.md

---

## Default Credentials

```
Email: admin@hotelcms.com
Password: Admin@123
```

**⚠️ CHANGE IMMEDIATELY AFTER FIRST LOGIN!**

---

## Quick Links

- Health: `/health`
- Login: `POST /api/auth/login`
- Docs: `/api/` (returns API info)
- Admin: Use credentials above

---

**Choose your deployment method and follow the detailed guide!**

- **Easy & Fast:** Use Render (RENDER_STEP_BY_STEP.md)
- **Control & Cost:** Use VPS (VPS_STEP_BY_STEP.md)
