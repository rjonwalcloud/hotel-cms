# 🖥️ Deploy to VPS (Ubuntu)

Complete production deployment guide for Ubuntu VPS (DigitalOcean, Linode, AWS EC2, etc.)

## 📋 Prerequisites

- Ubuntu 22.04 LTS VPS
- Root or sudo access
- Domain name (optional but recommended)
- SSH access

---

## 🚀 Quick Deploy Script

For experienced users:

```bash
# Download and run
curl -o deploy.sh https://raw.githubusercontent.com/YOUR_REPO/hotel-cms/main/scripts/vps-deploy.sh
chmod +x deploy.sh
sudo ./deploy.sh
```

For manual step-by-step, continue below.

---

## 📦 Step 1: Initial Server Setup

### Connect to VPS

```bash
ssh root@your-server-ip
```

### Update System

```bash
apt update && apt upgrade -y
```

### Create App User

```bash
adduser hotel-cms
usermod -aG sudo hotel-cms
su - hotel-cms
```

---

## 🔧 Step 2: Install Dependencies

### Install Node.js 18+

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # Should be v18+
npm --version
```

### Install PostgreSQL 15

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Install Nginx

```bash
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### Install PM2 (Process Manager)

```bash
sudo npm install -g pm2
```

### Install Certbot (SSL)

```bash
sudo apt install -y certbot python3-certbot-nginx
```

---

## 🗄️ Step 3: Setup PostgreSQL

### Create Database

```bash
sudo -u postgres psql

# Inside psql:
CREATE DATABASE hotel_cms;
CREATE USER hotel_admin WITH ENCRYPTED PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE hotel_cms TO hotel_admin;
\q
```

### Configure PostgreSQL for Remote Access (if needed)

```bash
sudo nano /etc/postgresql/15/main/postgresql.conf

# Change:
listen_addresses = 'localhost'  # or '*' for all
```

```bash
sudo nano /etc/postgresql/15/main/pg_hba.conf

# Add:
host    hotel_cms    hotel_admin    127.0.0.1/32    md5
```

```bash
sudo systemctl restart postgresql
```

---

## 📂 Step 4: Deploy Application

### Clone Repository

```bash
cd /var/www
sudo mkdir hotel-cms
sudo chown hotel-cms:hotel-cms hotel-cms
cd hotel-cms

# Clone your repo
git clone https://github.com/YOUR_USERNAME/hotel-cms.git .
```

### Install Dependencies

```bash
cd backend
npm install --production
```

### Configure Environment

```bash
cp .env.example .env
nano .env
```

**Update these values:**

```env
NODE_ENV=production
PORT=5000

DB_HOST=localhost
DB_PORT=5432
DB_NAME=hotel_cms
DB_USER=hotel_admin
DB_PASSWORD=your-secure-password
DB_SSL=false

JWT_SECRET=$(openssl rand -hex 32)
CORS_ORIGIN=https://your-domain.com
```

### Run Migrations

```bash
npm run migrate
```

### Test Application

```bash
node src/server.js

# In another terminal:
curl http://localhost:5000/health

# Should return: {"status":"OK"}
# Press Ctrl+C to stop
```

---

## 🔄 Step 5: Setup PM2 Process Manager

### Start Application

```bash
cd /var/www/hotel-cms/backend
pm2 start ecosystem.config.js --env production
```

### Setup PM2 Startup

```bash
pm2 startup systemd
# Copy and run the command it outputs

pm2 save
```

### PM2 Commands

```bash
pm2 status              # Check status
pm2 logs hotel-cms-api  # View logs
pm2 restart all         # Restart
pm2 stop all            # Stop
pm2 delete all          # Remove from PM2
```

---

## 🌐 Step 6: Configure Nginx

### Create Nginx Config

```bash
sudo nano /etc/nginx/sites-available/hotel-cms
```

**Paste this configuration:**

```nginx
upstream hotel_cms_backend {
    server 127.0.0.1:5000;
    keepalive 64;
}

server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

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
    }

    # Health check
    location /health {
        proxy_pass http://hotel_cms_backend;
        access_log off;
    }

    location / {
        return 200 '{"status":"OK","message":"Hotel CMS API"}';
        add_header Content-Type application/json;
    }
}
```

### Enable Site

```bash
sudo ln -s /etc/nginx/sites-available/hotel-cms /etc/nginx/sites-enabled/
sudo nginx -t  # Test configuration
sudo systemctl reload nginx
```

---

## 🔒 Step 7: Setup SSL Certificate

### Get SSL Certificate

```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

Follow the prompts:
- Enter email
- Agree to terms
- Choose to redirect HTTP to HTTPS (recommended)

### Auto-Renewal

```bash
sudo certbot renew --dry-run  # Test renewal

# Certbot auto-renews via cron/systemd
```

---

## 🔥 Step 8: Configure Firewall

### Setup UFW

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

---

## 📊 Step 9: Setup Logging

### Create Log Directory

```bash
sudo mkdir -p /var/log/hotel-cms
sudo chown hotel-cms:hotel-cms /var/log/hotel-cms
```

### Configure Log Rotation

```bash
sudo nano /etc/logrotate.d/hotel-cms
```

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
        pm2 reloadLogs
    endscript
}
```

---

## 🔍 Step 10: Monitoring & Maintenance

### Install Monitoring Tools

```bash
# PM2 Monitoring
pm2 install pm2-logrotate

# System monitoring
sudo apt install -y htop nethogs
```

### Monitor Resources

```bash
htop              # CPU/Memory
df -h             # Disk space
pm2 monit         # PM2 monitoring
sudo tail -f /var/log/nginx/access.log  # Nginx logs
```

### Database Maintenance

```bash
# Backup database
sudo -u postgres pg_dump hotel_cms > backup_$(date +%Y%m%d).sql

# Automated daily backup
echo "0 2 * * * sudo -u postgres pg_dump hotel_cms > /var/backups/hotel_cms_\$(date +\%Y\%m\%d).sql" | sudo tee -a /etc/crontab
```

---

## 🔄 Step 11: Deployment Updates

### Manual Update

```bash
cd /var/www/hotel-cms
git pull origin main
cd backend
npm install --production
npm run migrate  # If schema changed
pm2 restart all
```

### Automated Deployment (Git Webhook)

Create deployment script:

```bash
nano /var/www/hotel-cms/deploy.sh
```

```bash
#!/bin/bash
cd /var/www/hotel-cms
git pull origin main
cd backend
npm install --production
npm run migrate
pm2 restart all
echo "Deployed at $(date)" >> /var/log/hotel-cms/deployments.log
```

```bash
chmod +x /var/www/hotel-cms/deploy.sh
```

---

## 🛡️ Security Hardening

### 1. Disable Root SSH

```bash
sudo nano /etc/ssh/sshd_config

# Change:
PermitRootLogin no
PasswordAuthentication no  # Use SSH keys only

sudo systemctl restart sshd
```

### 2. Install Fail2Ban

```bash
sudo apt install -y fail2ban
sudo systemctl start fail2ban
sudo systemctl enable fail2ban
```

### 3. Setup Automatic Security Updates

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

### 4. Database Security

```bash
sudo nano /etc/postgresql/15/main/postgresql.conf

# Set:
password_encryption = scram-sha-256
ssl = on
```

---

## 🚨 Troubleshooting

### Application Won't Start

```bash
# Check logs
pm2 logs hotel-cms-api

# Check port
sudo netstat -tlnp | grep 5000

# Check environment
cat /var/www/hotel-cms/backend/.env
```

### Database Connection Failed

```bash
# Test connection
psql -h localhost -U hotel_admin -d hotel_cms

# Check PostgreSQL status
sudo systemctl status postgresql

# Check logs
sudo tail -f /var/log/postgresql/postgresql-15-main.log
```

### Nginx Issues

```bash
# Test config
sudo nginx -t

# Check logs
sudo tail -f /var/log/nginx/error.log

# Restart
sudo systemctl restart nginx
```

### SSL Issues

```bash
# Renew certificate
sudo certbot renew --force-renewal

# Check certificate
sudo certbot certificates
```

---

## 📈 Performance Optimization

### 1. Enable Nginx Caching

```nginx
# Add to /etc/nginx/nginx.conf (http block)
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m max_size=100m;

# In server block:
location /api/ {
    proxy_cache api_cache;
    proxy_cache_valid 200 5m;
    proxy_cache_use_stale error timeout http_500 http_502 http_503;
    # ... rest of proxy config
}
```

### 2. Increase PostgreSQL Performance

```bash
sudo nano /etc/postgresql/15/main/postgresql.conf

# Adjust based on your RAM (example for 2GB VPS):
shared_buffers = 512MB
effective_cache_size = 1536MB
maintenance_work_mem = 128MB
work_mem = 16MB
max_connections = 100
```

### 3. PM2 Cluster Mode

Already configured in `ecosystem.config.js`:
- Runs on all CPU cores
- Auto-restart on failure
- Load balancing built-in

---

## 💰 VPS Providers & Costs

### Recommended Providers

1. **DigitalOcean** - $6/month (1GB RAM)
2. **Linode** - $5/month (1GB RAM)
3. **Vultr** - $6/month (1GB RAM)
4. **Hetzner** - €4.5/month (2GB RAM, EU)

### Recommended Specs for Production

- **2GB RAM** minimum
- **2 CPU cores**
- **50GB SSD**
- **Ubuntu 22.04 LTS**

Cost: ~$12/month

---

## ✅ Post-Deployment Checklist

- [ ] Node.js 18+ installed
- [ ] PostgreSQL installed and configured
- [ ] Database created and migrated
- [ ] Application running via PM2
- [ ] Nginx configured and running
- [ ] SSL certificate installed
- [ ] Firewall enabled
- [ ] Logs configured
- [ ] Backups automated
- [ ] Monitoring setup
- [ ] Security hardened
- [ ] Default admin password changed

---

## 📚 Additional Resources

- [DigitalOcean Tutorials](https://www.digitalocean.com/community/tutorials)
- [PM2 Documentation](https://pm2.keymetrics.io/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [PostgreSQL Best Practices](https://wiki.postgresql.org/wiki/Performance_Optimization)

---

**Your Hotel CMS is now running on your VPS! 🎉**
