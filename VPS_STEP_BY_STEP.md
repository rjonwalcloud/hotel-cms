# 🖥️ VPS Deployment - Complete Step-by-Step Guide

## Overview

This guide will walk you through deploying Hotel CMS on a Ubuntu VPS with:
- Ubuntu 22.04 LTS
- PostgreSQL 15 Database
- Node.js 18 Backend
- Nginx Reverse Proxy
- PM2 Process Manager
- SSL Certificate (Let's Encrypt)
- Automated Backups

**Total Time:** 60-90 minutes (or 10 minutes with automated script)
**Cost:** $12-24/month

---

## 📋 Prerequisites

Before starting, you need:
- [ ] Ubuntu 22.04 LTS VPS (DigitalOcean, Linode, Vultr, etc.)
- [ ] Root SSH access
- [ ] Domain name pointed to VPS IP (optional but recommended)
- [ ] Basic terminal knowledge

**Recommended VPS Specs:**
- **RAM:** 2GB minimum (1GB for testing)
- **CPU:** 1-2 cores
- **Storage:** 50GB SSD
- **OS:** Ubuntu 22.04 LTS

---

## Quick Start Option: Automated Script

If you want automated deployment (recommended):

```bash
# SSH to your VPS
ssh root@your-vps-ip

# Download and run automated script
curl -o deploy.sh https://raw.githubusercontent.com/YOUR_REPO/hotel-cms/main/scripts/vps-deploy.sh
chmod +x deploy.sh
sudo ./deploy.sh
```

Follow prompts and you're done in 10 minutes!

**For manual step-by-step deployment, continue below.**

---

## Part 1: VPS Setup

### Step 1.1: Get a VPS

**Recommended Providers:**

**DigitalOcean ($12/month):**
1. Go to https://digitalocean.com
2. Sign up / Login
3. Click **"Create"** → **"Droplets"**
4. Choose:
   - **Image:** Ubuntu 22.04 LTS
   - **Plan:** Basic ($12/month - 2GB RAM)
   - **Datacenter:** Closest to your users
   - **Authentication:** SSH keys (recommended) or Password
   - **Hostname:** hotel-cms
5. Click **"Create Droplet"**
6. Wait 1 minute for creation
7. Copy the IP address (e.g., 167.71.123.45)

**Linode ($12/month):**
Similar process at https://linode.com

**Vultr ($12/month):**
Similar process at https://vultr.com

### Step 1.2: Connect to VPS

**On Mac/Linux:**
```bash
ssh root@YOUR_VPS_IP
```

**On Windows:**
1. Download PuTTY: https://putty.org
2. Open PuTTY
3. Host: YOUR_VPS_IP
4. Port: 22
5. Click "Open"
6. Login as "root"

**First time:** Accept the fingerprint (type `yes`)

### Step 1.3: Update System

```bash
# Update package lists
apt update

# Upgrade all packages
apt upgrade -y

# This takes 2-5 minutes
```

---

## Part 2: Install Dependencies

### Step 2.1: Install Node.js 18

```bash
# Add NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# Install Node.js
apt install -y nodejs

# Verify installation
node --version   # Should show v18.x.x
npm --version    # Should show 9.x.x
```

### Step 2.2: Install PostgreSQL 15

```bash
# Install PostgreSQL
apt install -y postgresql postgresql-contrib

# Start PostgreSQL
systemctl start postgresql

# Enable on boot
systemctl enable postgresql

# Verify it's running
systemctl status postgresql
# Press 'q' to exit
```

### Step 2.3: Install Nginx

```bash
# Install Nginx
apt install -y nginx

# Start Nginx
systemctl start nginx

# Enable on boot
systemctl enable nginx

# Verify it's running
systemctl status nginx
# Press 'q' to exit
```

### Step 2.4: Install PM2 (Process Manager)

```bash
# Install PM2 globally
npm install -g pm2

# Verify installation
pm2 --version
```

### Step 2.5: Install Additional Tools

```bash
# Git for code deployment
apt install -y git

# Certbot for SSL
apt install -y certbot python3-certbot-nginx

# Useful monitoring tools
apt install -y htop nethogs curl
```

---

## Part 3: Setup PostgreSQL Database

### Step 3.1: Create Database User

```bash
# Switch to postgres user
sudo -u postgres psql
```

You'll see `postgres=#` prompt.

### Step 3.2: Create Database and User

Run these commands in PostgreSQL prompt:

```sql
-- Create database
CREATE DATABASE hotel_cms;

-- Create user with password
CREATE USER hotel_admin WITH ENCRYPTED PASSWORD 'YourSecurePassword123!';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE hotel_cms TO hotel_admin;

-- Exit
\q
```

**Important:** Replace `YourSecurePassword123!` with your own strong password!

**Password Requirements:**
- At least 16 characters
- Mix of uppercase, lowercase, numbers, special characters
- Don't use common words

**Generate secure password:**
```bash
openssl rand -base64 24
```

### Step 3.3: Test Database Connection

```bash
# Try to connect
psql -U hotel_admin -d hotel_cms -h localhost

# If prompted for password, enter it
# You should see: hotel_cms=>

# Test a query
SELECT NOW();

# Exit
\q
```

### Step 3.4: Configure PostgreSQL (Optional)

For better performance:

```bash
# Edit PostgreSQL config
nano /etc/postgresql/15/main/postgresql.conf
```

Find and modify (use Ctrl+W to search):

```conf
# For 2GB RAM VPS:
shared_buffers = 512MB
effective_cache_size = 1536MB
maintenance_work_mem = 128MB
work_mem = 16MB
max_connections = 100
```

Save: `Ctrl+X`, then `Y`, then `Enter`

```bash
# Restart PostgreSQL
systemctl restart postgresql
```

---

## Part 4: Create Application User

### Step 4.1: Create User

```bash
# Create user 'hotel-cms'
adduser hotel-cms

# Set password when prompted
# Fill in details or press Enter to skip

# Add to sudo group
usermod -aG sudo hotel-cms
```

### Step 4.2: Setup SSH for Application User (Optional)

```bash
# Copy root's SSH keys to new user
cp -r ~/.ssh /home/hotel-cms/
chown -R hotel-cms:hotel-cms /home/hotel-cms/.ssh
```

---

## Part 5: Deploy Application Code

### Step 5.1: Create Application Directory

```bash
# Create directory
mkdir -p /var/www/hotel-cms

# Set ownership
chown -R hotel-cms:hotel-cms /var/www/hotel-cms

# Switch to application user
su - hotel-cms

# Navigate to directory
cd /var/www/hotel-cms
```

### Step 5.2: Get Application Code

**Option A: From GitHub**

```bash
# Clone repository
git clone https://github.com/YOUR_USERNAME/hotel-cms.git .

# Note the dot (.) at the end - it clones into current directory
```

**Option B: Upload from Local Machine**

On your local machine:

```bash
# From hotel-cms directory
scp -r . hotel-cms@YOUR_VPS_IP:/var/www/hotel-cms/
```

### Step 5.3: Install Dependencies

```bash
# Navigate to backend
cd /var/www/hotel-cms/backend

# Install production dependencies
npm install --production

# This takes 2-3 minutes
```

---

## Part 6: Configure Environment Variables

### Step 6.1: Create .env File

```bash
# Create .env file
cd /var/www/hotel-cms/backend
nano .env
```

### Step 6.2: Add Environment Variables

Paste this configuration (replace values):

```env
# Server Configuration
NODE_ENV=production
PORT=5000

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=hotel_cms
DB_USER=hotel_admin
DB_PASSWORD=YourSecurePassword123!
DB_SSL=false
DB_POOL_MAX=20
DB_POOL_MIN=2

# JWT Configuration - GENERATE NEW SECRET!
JWT_SECRET=your-64-character-random-string-here

# CORS Configuration
CORS_ORIGIN=*

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

**Generate JWT Secret:**

```bash
# Run this in another terminal window
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Copy the output and paste it as JWT_SECRET value
```

Save the file: `Ctrl+X`, then `Y`, then `Enter`

### Step 6.3: Secure .env File

```bash
# Set proper permissions
chmod 600 .env

# Verify
ls -la .env
# Should show: -rw------- (only owner can read)
```

---

## Part 7: Run Database Migrations

### Step 7.1: Run Migrations

```bash
# Make sure you're in backend directory
cd /var/www/hotel-cms/backend

# Run migrations
npm run migrate
```

You should see:

```
🚀 Running database migrations...
📡 Connecting to database...
✅ Connected at: 2024-02-09...
🗄️  Running schema.sql...
✅ Schema applied successfully

📊 Created 15 tables:
   ✓ users
   ✓ roles
   ✓ permissions
   ... (all tables)

✅ Migration completed successfully
```

### Step 7.2: Verify Tables Created

```bash
# Connect to database
psql -U hotel_admin -d hotel_cms -h localhost

# List tables
\dt

# You should see 15 tables
# Exit
\q
```

---

## Part 8: Test Application Locally

### Step 8.1: Start Application

```bash
# In backend directory
cd /var/www/hotel-cms/backend

# Start server
node src/server.js
```

You should see:

```
╔════════════════════════════════════════╗
║   🏨 Hotel CMS API Server Running     ║
╠════════════════════════════════════════╣
║   Port: 5000                           ║
║   Environment: production              ║
║   Database: PostgreSQL                 ║
╚════════════════════════════════════════╝
```

### Step 8.2: Test in Another Terminal

Open a new SSH connection:

```bash
ssh hotel-cms@YOUR_VPS_IP

# Test health endpoint
curl http://localhost:5000/health

# Expected: {"status":"OK","timestamp":"..."}

# Test login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hotelcms.com","password":"Admin@123"}'

# Expected: {"success":true,"token":"..."}
```

If both work, stop the server: `Ctrl+C` in the first terminal

---

## Part 9: Setup PM2 Process Manager

### Step 9.1: Start Application with PM2

```bash
# In backend directory
cd /var/www/hotel-cms/backend

# Start with PM2 using ecosystem config
pm2 start ecosystem.config.js --env production

# You should see:
# ┌─────┬──────────────────┬─────────┬─────────┬─────────┬──────────┐
# │ id  │ name             │ mode    │ status  │ ...     │
# ├─────┼──────────────────┼─────────┼─────────┼─────────┼──────────┤
# │ 0   │ hotel-cms-api    │ cluster │ online  │ ...     │
# └─────┴──────────────────┴─────────┴─────────┴─────────┴──────────┘
```

### Step 9.2: Configure PM2 Startup

```bash
# Generate startup script
pm2 startup systemd

# You'll see a command like:
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u hotel-cms --hp /home/hotel-cms

# Copy and run that EXACT command
# (it will be different based on your system)
```

Example:
```bash
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u hotel-cms --hp /home/hotel-cms
```

### Step 9.3: Save PM2 Process List

```bash
# Save current processes
pm2 save

# This ensures PM2 restarts your app on server reboot
```

### Step 9.4: PM2 Useful Commands

```bash
# View status
pm2 status

# View logs
pm2 logs hotel-cms-api

# View realtime monitoring
pm2 monit

# Restart application
pm2 restart hotel-cms-api

# Stop application
pm2 stop hotel-cms-api

# Delete from PM2
pm2 delete hotel-cms-api
```

---

## Part 10: Configure Nginx Reverse Proxy

### Step 10.1: Create Nginx Configuration

```bash
# Exit from hotel-cms user back to root
exit

# Create Nginx config file
nano /etc/nginx/sites-available/hotel-cms
```

### Step 10.2: Add Nginx Configuration

Paste this configuration:

```nginx
upstream hotel_cms_backend {
    server 127.0.0.1:5000;
    keepalive 64;
}

server {
    listen 80;
    listen [::]:80;
    server_name YOUR_DOMAIN_OR_IP;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Logging
    access_log /var/log/nginx/hotel-cms-access.log;
    error_log /var/log/nginx/hotel-cms-error.log;

    # API Backend
    location /api/ {
        proxy_pass http://hotel_cms_backend;
        proxy_http_version 1.1;
        
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check
    location /health {
        proxy_pass http://hotel_cms_backend;
        access_log off;
    }

    # Root
    location / {
        return 200 '{"status":"OK","message":"Hotel CMS API"}';
        add_header Content-Type application/json;
    }
}
```

**Replace `YOUR_DOMAIN_OR_IP` with:**
- Your domain: `api.yourdomain.com`
- OR your VPS IP: `167.71.123.45`

Save: `Ctrl+X`, then `Y`, then `Enter`

### Step 10.3: Enable Site

```bash
# Create symbolic link
ln -s /etc/nginx/sites-available/hotel-cms /etc/nginx/sites-enabled/

# Remove default site
rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
nginx -t

# Should see:
# nginx: configuration file /etc/nginx/nginx.conf test is successful
```

### Step 10.4: Reload Nginx

```bash
# Reload Nginx
systemctl reload nginx

# Check status
systemctl status nginx
```

---

## Part 11: Test External Access

### Step 11.1: Test from Your Computer

Open browser or terminal on your computer:

```bash
# Replace with your IP or domain
curl http://YOUR_VPS_IP/health

# Expected: {"status":"OK","timestamp":"..."}
```

```bash
# Test login
curl -X POST http://YOUR_VPS_IP/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hotelcms.com","password":"Admin@123"}'

# Expected: token response
```

---

## Part 12: Setup SSL Certificate (HTTPS)

**Skip this if you don't have a domain name**

### Step 12.1: Point Domain to VPS

Before getting SSL, configure DNS:

1. Go to your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.)
2. Add A record:
   - **Type:** A
   - **Name:** api (or @)
   - **Value:** YOUR_VPS_IP
   - **TTL:** 300 or Auto
3. Save
4. Wait 5-60 minutes for DNS propagation

Verify:
```bash
dig api.yourdomain.com
# Should show your VPS IP
```

### Step 12.2: Get SSL Certificate

```bash
# Get certificate (replace with your domain and email)
certbot --nginx -d api.yourdomain.com -d www.api.yourdomain.com

# Follow the prompts:
# 1. Enter email address
# 2. Agree to Terms of Service (Y)
# 3. Share email with EFF (Y or N)
# 4. Redirect HTTP to HTTPS? Choose 2 (Redirect)
```

Certbot will automatically:
- Get certificate from Let's Encrypt
- Modify Nginx config
- Setup auto-renewal

### Step 12.3: Verify SSL

```bash
# Test HTTPS
curl https://api.yourdomain.com/health

# Check certificate
curl -vI https://api.yourdomain.com/health 2>&1 | grep -i ssl
```

### Step 12.4: Test Auto-Renewal

```bash
# Dry run renewal
certbot renew --dry-run

# Should see: "Congratulations, all simulated renewals succeeded"
```

SSL certificates auto-renew via systemd timer.

---

## Part 13: Configure Firewall

### Step 13.1: Setup UFW (Uncomplicated Firewall)

```bash
# Enable UFW
ufw --force enable

# Allow SSH (IMPORTANT!)
ufw allow OpenSSH

# Allow HTTP and HTTPS
ufw allow 'Nginx Full'

# Check status
ufw status

# Should show:
# Status: active
# 
# To                         Action      From
# --                         ------      ----
# OpenSSH                    ALLOW       Anywhere
# Nginx Full                 ALLOW       Anywhere
```

**Important:** Always allow OpenSSH BEFORE enabling firewall or you'll lock yourself out!

---

## Part 14: Setup Logging

### Step 14.1: Create Log Directory

```bash
# Create directory
mkdir -p /var/log/hotel-cms

# Set ownership
chown hotel-cms:hotel-cms /var/log/hotel-cms
```

### Step 14.2: Configure Log Rotation

```bash
# Create logrotate config
nano /etc/logrotate.d/hotel-cms
```

Paste:

```
/var/log/hotel-cms/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 hotel-cms hotel-cms
    sharedscripts
    postrotate
        su hotel-cms -c "pm2 reloadLogs"
    endscript
}
```

Save and exit.

### Step 14.3: View Logs

```bash
# Application logs (PM2)
pm2 logs hotel-cms-api

# Nginx access logs
tail -f /var/log/nginx/hotel-cms-access.log

# Nginx error logs
tail -f /var/log/nginx/hotel-cms-error.log

# PostgreSQL logs
tail -f /var/log/postgresql/postgresql-15-main.log
```

---

## Part 15: Setup Automated Backups

### Step 15.1: Create Backup Directory

```bash
# Create backup directory
mkdir -p /var/backups/hotel-cms

# Set permissions
chown hotel-cms:hotel-cms /var/backups/hotel-cms
```

### Step 15.2: Create Backup Script

```bash
# Create backup script
nano /usr/local/bin/hotel-cms-backup
```

Paste:

```bash
#!/bin/bash

# Configuration
BACKUP_DIR="/var/backups/hotel-cms"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_NAME="hotel_cms"
DB_USER="hotel_admin"

# Create backup
sudo -u postgres pg_dump $DB_NAME > "$BACKUP_DIR/hotel_cms_$TIMESTAMP.sql"

# Compress
gzip "$BACKUP_DIR/hotel_cms_$TIMESTAMP.sql"

# Delete backups older than 7 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

# Log
echo "Backup completed: hotel_cms_$TIMESTAMP.sql.gz" >> /var/log/hotel-cms/backup.log
```

Save and exit.

```bash
# Make executable
chmod +x /usr/local/bin/hotel-cms-backup

# Test backup
/usr/local/bin/hotel-cms-backup

# Check if backup was created
ls -lh /var/backups/hotel-cms/
```

### Step 15.3: Schedule Daily Backups

```bash
# Edit root crontab
crontab -e

# Choose editor (nano is easiest)

# Add this line at the end:
0 2 * * * /usr/local/bin/hotel-cms-backup

# This runs backup daily at 2 AM
```

Save and exit.

Verify:
```bash
crontab -l
```

---

## Part 16: Security Hardening

### Step 16.1: Disable Root SSH Login

```bash
# Edit SSH config
nano /etc/ssh/sshd_config

# Find and change:
PermitRootLogin no
PasswordAuthentication no  # Only if you use SSH keys
```

Save and restart:

```bash
systemctl restart sshd
```

**Warning:** Test SSH with hotel-cms user before closing current session!

### Step 16.2: Install Fail2Ban

```bash
# Install Fail2Ban
apt install -y fail2ban

# Start and enable
systemctl start fail2ban
systemctl enable fail2ban

# Check status
fail2ban-client status
```

### Step 16.3: Enable Automatic Security Updates

```bash
# Install unattended-upgrades
apt install -y unattended-upgrades

# Enable
dpkg-reconfigure --priority=low unattended-upgrades
# Select "Yes"
```

---

## Part 17: Monitoring Setup

### Step 17.1: Install Monitoring Tools

Already installed: `htop`, `nethogs`

Usage:
```bash
# Monitor CPU, RAM, processes
htop

# Monitor network
sudo nethogs

# Check disk space
df -h

# Check memory
free -h
```

### Step 17.2: PM2 Monitoring

```bash
# Real-time monitoring
pm2 monit

# Web-based monitoring (optional)
pm2 install pm2-logrotate
```

---

## Part 18: Final Testing

### Step 18.1: Complete API Test

```bash
# Get your VPS IP or domain
YOUR_URL="http://YOUR_VPS_IP"  # or https://api.yourdomain.com

# Health check
curl $YOUR_URL/health

# Login
TOKEN=$(curl -s -X POST $YOUR_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hotelcms.com","password":"Admin@123"}' \
  | grep -o '"token":"[^"]*' | grep -o '[^"]*$')

echo "Token: $TOKEN"

# Get current user
curl $YOUR_URL/api/auth/me \
  -H "Authorization: Bearer $TOKEN"

# Create hotel
curl -X POST $YOUR_URL/api/hotels \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Hotel",
    "city": "New York",
    "country": "USA"
  }'
```

### Step 18.2: Performance Test

```bash
# Install Apache Bench
apt install -y apache2-utils

# Test 100 requests, 10 concurrent
ab -n 100 -c 10 http://localhost:5000/health

# Look for:
# - Requests per second
# - Time per request
# - Failed requests (should be 0)
```

---

## Part 19: Deployment Checklist

Before going live:

### Server Setup
- [ ] VPS provisioned and accessible
- [ ] System updated (apt update && apt upgrade)
- [ ] Firewall configured (UFW)
- [ ] Non-root user created

### Application
- [ ] Code deployed to /var/www/hotel-cms
- [ ] Dependencies installed (npm install)
- [ ] Environment variables configured (.env)
- [ ] Database migrations run successfully
- [ ] PM2 running application
- [ ] PM2 startup configured

### Web Server
- [ ] Nginx installed and configured
- [ ] Nginx config tested (nginx -t)
- [ ] SSL certificate installed (if domain)
- [ ] HTTP redirects to HTTPS

### Database
- [ ] PostgreSQL installed
- [ ] Database created (hotel_cms)
- [ ] User created (hotel_admin)
- [ ] Migrations completed
- [ ] Backups configured

### Security
- [ ] JWT_SECRET is secure random string
- [ ] Database password changed from default
- [ ] Admin password changed from default
- [ ] Firewall enabled
- [ ] Fail2Ban installed
- [ ] Root SSH login disabled
- [ ] Automatic updates enabled

### Monitoring
- [ ] PM2 monitoring active
- [ ] Log rotation configured
- [ ] Backup script tested
- [ ] Cron job for backups added

---

## Part 20: Maintenance & Updates

### Daily
```bash
# Check application status
pm2 status

# Check logs for errors
pm2 logs hotel-cms-api --lines 50
```

### Weekly
```bash
# Check disk space
df -h

# Check backups
ls -lh /var/backups/hotel-cms/

# Review Nginx logs
tail -100 /var/log/nginx/hotel-cms-error.log
```

### Monthly
```bash
# Update system
apt update && apt upgrade -y

# Review security
fail2ban-client status

# Check SSL expiry
certbot certificates
```

### Update Application

```bash
# SSH as hotel-cms user
ssh hotel-cms@YOUR_VPS_IP

# Navigate to app
cd /var/www/hotel-cms

# Pull latest code
git pull origin main

# Update dependencies
cd backend
npm install --production

# Run migrations (if any)
npm run migrate

# Restart PM2
pm2 restart hotel-cms-api

# Check status
pm2 status
```

---

## Part 21: Troubleshooting

### Application Won't Start

**Check PM2 logs:**
```bash
pm2 logs hotel-cms-api --lines 50
```

**Common issues:**
- Database connection failed → Check .env DB_* variables
- Port already in use → Check if another process uses port 5000
- Module not found → Run `npm install`

### Database Connection Issues

**Test connection:**
```bash
psql -U hotel_admin -d hotel_cms -h localhost
```

**If fails:**
- Check PostgreSQL is running: `systemctl status postgresql`
- Check credentials in .env
- Check pg_hba.conf allows local connections

### Nginx Issues

**Test config:**
```bash
nginx -t
```

**Check logs:**
```bash
tail -f /var/log/nginx/error.log
```

**Restart Nginx:**
```bash
systemctl restart nginx
```

### SSL Certificate Issues

**Check status:**
```bash
certbot certificates
```

**Renew manually:**
```bash
certbot renew --force-renewal
```

### Performance Issues

**Check resources:**
```bash
htop          # CPU/RAM
pm2 monit     # PM2 stats
iotop         # Disk I/O
```

**Increase PM2 instances:**
Edit `ecosystem.config.js`:
```javascript
instances: 'max'  // Use all CPU cores
```

Then:
```bash
pm2 reload ecosystem.config.js
```

---

## Part 22: Costs Breakdown

### VPS Provider Comparison

**DigitalOcean:**
- 1GB RAM: $6/month (testing only)
- 2GB RAM: $12/month ⭐ Recommended
- 4GB RAM: $24/month (production)

**Linode:**
- 1GB RAM: $5/month
- 2GB RAM: $10/month ⭐ Best value
- 4GB RAM: $20/month

**Vultr:**
- 1GB RAM: $6/month
- 2GB RAM: $12/month
- 4GB RAM: $24/month

### Additional Costs

- Domain name: $10-15/year
- SSL Certificate: FREE (Let's Encrypt)
- Backups: Included in VPS price
- Monitoring: FREE (self-hosted)

**Total: $12-24/month + $10-15/year domain**

---

## Part 23: Success Confirmation

Your deployment is successful when all these work:

```bash
# 1. Health check
curl https://api.yourdomain.com/health
# ✅ Returns: {"status":"OK"}

# 2. Login
curl -X POST https://api.yourdomain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hotelcms.com","password":"Admin@123"}'
# ✅ Returns: {"success":true,"token":"..."}

# 3. Protected endpoint
curl https://api.yourdomain.com/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"
# ✅ Returns: user data

# 4. PM2 status
pm2 status
# ✅ Shows: status: online

# 5. Nginx status
systemctl status nginx
# ✅ Shows: active (running)

# 6. PostgreSQL status
systemctl status postgresql
# ✅ Shows: active (running)

# 7. SSL certificate (if domain)
curl -I https://api.yourdomain.com
# ✅ Shows: HTTP/2 200
```

---

## 📞 Support Resources

**VPS Providers:**
- DigitalOcean Community: https://www.digitalocean.com/community
- Linode Docs: https://www.linode.com/docs
- Vultr Docs: https://www.vultr.com/docs

**Software Documentation:**
- PM2: https://pm2.keymetrics.io
- Nginx: https://nginx.org/en/docs
- PostgreSQL: https://postgresql.org/docs
- Certbot: https://certbot.eff.org

**Troubleshooting:**
1. Check application logs: `pm2 logs`
2. Check system logs: `journalctl -xe`
3. Check Nginx logs: `/var/log/nginx/`
4. Check PostgreSQL logs: `/var/log/postgresql/`

---

## ✅ Final Checklist

- [ ] VPS accessible via SSH
- [ ] All dependencies installed
- [ ] Database created and migrated
- [ ] Application code deployed
- [ ] Environment variables configured
- [ ] PM2 running application
- [ ] Nginx reverse proxy configured
- [ ] SSL certificate installed (if domain)
- [ ] Firewall enabled
- [ ] Backups automated
- [ ] Monitoring setup
- [ ] Default passwords changed
- [ ] API endpoints tested
- [ ] Performance acceptable

---

**🎉 Congratulations! Your Hotel CMS is live on your VPS!**

**API URL:** 
- With domain: `https://api.yourdomain.com`
- Without domain: `http://YOUR_VPS_IP`

**Save this guide for future updates and troubleshooting.**

**Next Steps:**
1. Change admin password
2. Test all endpoints
3. Monitor for 24 hours
4. Deploy frontend (if applicable)
5. Setup monitoring alerts
