#!/bin/bash

# ============================================
# Hotel CMS - Automated VPS Deployment Script
# Ubuntu 22.04 LTS
# ============================================

set -e  # Exit on error

echo "🏨 Hotel CMS - VPS Deployment Script"
echo "===================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
  echo "❌ Please run as root (use sudo)"
  exit 1
fi

# Get configuration
read -p "Enter your domain name (or press Enter to skip): " DOMAIN
read -p "Enter database password: " -s DB_PASSWORD
echo ""
read -p "Enter your email for SSL certificate: " EMAIL
echo ""

# Generate JWT secret
JWT_SECRET=$(openssl rand -hex 32)

echo "📦 Starting deployment..."
echo ""

# ============================================
# Step 1: Update System
# ============================================
echo "1️⃣ Updating system..."
apt update && apt upgrade -y

# ============================================
# Step 2: Install Dependencies
# ============================================
echo "2️⃣ Installing dependencies..."

# Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# PostgreSQL
apt install -y postgresql postgresql-contrib

# Nginx
apt install -y nginx

# PM2
npm install -g pm2

# Certbot (if domain provided)
if [ ! -z "$DOMAIN" ]; then
  apt install -y certbot python3-certbot-nginx
fi

# Git
apt install -y git

# Utilities
apt install -y htop nethogs curl

echo "✅ Dependencies installed"
echo ""

# ============================================
# Step 3: Create Application User
# ============================================
echo "3️⃣ Creating application user..."

if ! id "hotel-cms" &>/dev/null; then
  useradd -m -s /bin/bash hotel-cms
  usermod -aG sudo hotel-cms
  echo "✅ User 'hotel-cms' created"
else
  echo "✅ User 'hotel-cms' already exists"
fi

echo ""

# ============================================
# Step 4: Setup PostgreSQL
# ============================================
echo "4️⃣ Setting up PostgreSQL..."

sudo -u postgres psql -c "CREATE DATABASE hotel_cms;" 2>/dev/null || echo "Database already exists"
sudo -u postgres psql -c "CREATE USER hotel_admin WITH ENCRYPTED PASSWORD '$DB_PASSWORD';" 2>/dev/null || echo "User already exists"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE hotel_cms TO hotel_admin;"

echo "✅ PostgreSQL configured"
echo ""

# ============================================
# Step 5: Setup Application Directory
# ============================================
echo "5️⃣ Setting up application..."

# Create directory
mkdir -p /var/www/hotel-cms
chown -R hotel-cms:hotel-cms /var/www/hotel-cms

# Create .env file
cat > /var/www/hotel-cms/backend/.env <<EOF
NODE_ENV=production
PORT=5000

DB_HOST=localhost
DB_PORT=5432
DB_NAME=hotel_cms
DB_USER=hotel_admin
DB_PASSWORD=$DB_PASSWORD
DB_SSL=false

JWT_SECRET=$JWT_SECRET
CORS_ORIGIN=${DOMAIN:+https://$DOMAIN}
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
EOF

chown hotel-cms:hotel-cms /var/www/hotel-cms/backend/.env
chmod 600 /var/www/hotel-cms/backend/.env

echo "✅ Application configured"
echo ""

# ============================================
# Step 6: Install Application Dependencies
# ============================================
echo "6️⃣ Installing application dependencies..."

cd /var/www/hotel-cms/backend
sudo -u hotel-cms npm install --production

echo "✅ Dependencies installed"
echo ""

# ============================================
# Step 7: Run Migrations
# ============================================
echo "7️⃣ Running database migrations..."

sudo -u hotel-cms npm run migrate

echo "✅ Migrations completed"
echo ""

# ============================================
# Step 8: Setup PM2
# ============================================
echo "8️⃣ Setting up PM2..."

sudo -u hotel-cms pm2 start ecosystem.config.js --env production
sudo -u hotel-cms pm2 save

# Setup PM2 startup
env PATH=$PATH:/usr/bin pm2 startup systemd -u hotel-cms --hp /home/hotel-cms

echo "✅ PM2 configured"
echo ""

# ============================================
# Step 9: Configure Nginx
# ============================================
echo "9️⃣ Configuring Nginx..."

if [ -z "$DOMAIN" ]; then
  SERVER_NAME="_"
  SSL_CONFIG=""
else
  SERVER_NAME="$DOMAIN www.$DOMAIN"
  SSL_CONFIG=""
fi

cat > /etc/nginx/sites-available/hotel-cms <<EOF
upstream hotel_cms_backend {
    server 127.0.0.1:5000;
    keepalive 64;
}

server {
    listen 80;
    listen [::]:80;
    server_name $SERVER_NAME;

    location /api/ {
        proxy_pass http://hotel_cms_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    location /health {
        proxy_pass http://hotel_cms_backend;
        access_log off;
    }

    location / {
        return 200 '{"status":"OK","message":"Hotel CMS API"}';
        add_header Content-Type application/json;
    }
}
EOF

ln -sf /etc/nginx/sites-available/hotel-cms /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl reload nginx

echo "✅ Nginx configured"
echo ""

# ============================================
# Step 10: Setup SSL (if domain provided)
# ============================================
if [ ! -z "$DOMAIN" ] && [ ! -z "$EMAIL" ]; then
  echo "🔒 Setting up SSL certificate..."
  certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos -m $EMAIL --redirect
  echo "✅ SSL configured"
  echo ""
fi

# ============================================
# Step 11: Setup Firewall
# ============================================
echo "🔥 Configuring firewall..."

ufw --force enable
ufw allow OpenSSH
ufw allow 'Nginx Full'

echo "✅ Firewall configured"
echo ""

# ============================================
# Step 12: Setup Logging
# ============================================
echo "📊 Setting up logging..."

mkdir -p /var/log/hotel-cms
chown hotel-cms:hotel-cms /var/log/hotel-cms

cat > /etc/logrotate.d/hotel-cms <<EOF
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
EOF

echo "✅ Logging configured"
echo ""

# ============================================
# Step 13: Create Backup Script
# ============================================
echo "💾 Setting up backups..."

mkdir -p /var/backups/hotel-cms
chown hotel-cms:hotel-cms /var/backups/hotel-cms

cat > /usr/local/bin/hotel-cms-backup <<'EOF'
#!/bin/bash
BACKUP_DIR="/var/backups/hotel-cms"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
sudo -u postgres pg_dump hotel_cms > "$BACKUP_DIR/hotel_cms_$TIMESTAMP.sql"
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
EOF

chmod +x /usr/local/bin/hotel-cms-backup

# Add to crontab
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/hotel-cms-backup") | crontab -

echo "✅ Backups configured (daily at 2 AM)"
echo ""

# ============================================
# Deployment Complete
# ============================================

echo "=========================================="
echo "✅ Deployment Complete!"
echo "=========================================="
echo ""
echo "📍 Your API is running at:"
if [ ! -z "$DOMAIN" ]; then
  echo "   https://$DOMAIN/api"
  echo "   https://$DOMAIN/health"
else
  echo "   http://$(curl -s ifconfig.me)/api"
  echo "   http://$(curl -s ifconfig.me)/health"
fi
echo ""
echo "🔑 Default Credentials:"
echo "   Email: admin@hotelcms.com"
echo "   Password: Admin@123"
echo "   ⚠️  CHANGE THIS IMMEDIATELY!"
echo ""
echo "📊 Useful Commands:"
echo "   pm2 status              - Check application status"
echo "   pm2 logs hotel-cms-api  - View application logs"
echo "   pm2 restart all         - Restart application"
echo "   sudo systemctl status nginx - Check nginx status"
echo "   sudo tail -f /var/log/nginx/access.log - View access logs"
echo ""
echo "🔧 Configuration Files:"
echo "   App: /var/www/hotel-cms/backend/.env"
echo "   Nginx: /etc/nginx/sites-available/hotel-cms"
echo "   PM2: /var/www/hotel-cms/backend/ecosystem.config.js"
echo ""
echo "💡 Next Steps:"
echo "   1. Test the API: curl http://localhost:5000/health"
echo "   2. Change admin password"
echo "   3. Configure your domain DNS (if not done)"
echo "   4. Setup monitoring"
echo ""
echo "📚 Documentation: /var/www/hotel-cms/DEPLOY_VPS.md"
echo ""

# Test API
echo "🧪 Testing API..."
sleep 3
curl -s http://localhost:5000/health | jq || echo "API test completed"

echo ""
echo "🎉 Deployment successful!"
