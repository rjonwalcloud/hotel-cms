#!/bin/bash

echo "🏨 Hotel CMS - Quick Start Script"
echo "=================================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

echo "✅ Docker and Docker Compose found"
echo ""

# Ask user for setup method
echo "Choose setup method:"
echo "1) Docker (Recommended - Full stack with PostgreSQL)"
echo "2) Local Development (Requires PostgreSQL installed)"
read -p "Enter choice (1 or 2): " choice

if [ "$choice" == "1" ]; then
    echo ""
    echo "🐳 Starting Docker setup..."
    echo ""
    
    # Create .env file in backend
    if [ ! -f backend/.env ]; then
        echo "📝 Creating backend/.env from example..."
        cp backend/.env.example backend/.env
    fi
    
    # Start Docker Compose
    echo "🚀 Starting all services..."
    docker-compose up -d
    
    echo ""
    echo "⏳ Waiting for services to be ready..."
    sleep 10
    
    # Check status
    docker-compose ps
    
    echo ""
    echo "✅ Setup complete!"
    echo ""
    echo "📍 Services running at:"
    echo "   - API: http://localhost:5000"
    echo "   - Frontend: http://localhost:3000 (when implemented)"
    echo "   - PostgreSQL: localhost:5432"
    echo ""
    echo "🔑 Default Super Admin:"
    echo "   Email: admin@hotelcms.com"
    echo "   Password: Admin@123"
    echo ""
    echo "📖 Test the API:"
    echo '   curl http://localhost:5000/health'
    echo ""
    echo "🛑 To stop services:"
    echo "   docker-compose down"
    
elif [ "$choice" == "2" ]; then
    echo ""
    echo "💻 Local Development Setup"
    echo ""
    
    # Check if PostgreSQL is running
    if ! pg_isready &> /dev/null; then
        echo "❌ PostgreSQL is not running. Please start PostgreSQL first."
        exit 1
    fi
    
    echo "✅ PostgreSQL is running"
    
    # Ask for database details
    read -p "Database name (default: hotel_cms): " DB_NAME
    DB_NAME=${DB_NAME:-hotel_cms}
    
    read -p "Database user (default: postgres): " DB_USER
    DB_USER=${DB_USER:-postgres}
    
    read -sp "Database password: " DB_PASS
    echo ""
    
    # Create database
    echo "📦 Creating database..."
    PGPASSWORD=$DB_PASS createdb -U $DB_USER $DB_NAME 2>/dev/null || echo "Database might already exist"
    
    # Run schema
    echo "🗄️  Running schema..."
    PGPASSWORD=$DB_PASS psql -U $DB_USER -d $DB_NAME -f schema.sql
    
    # Setup backend
    echo "📦 Installing backend dependencies..."
    cd backend
    npm install
    
    if [ ! -f .env ]; then
        echo "📝 Creating .env file..."
        cp .env.example .env
        
        # Update .env with user's database details
        sed -i "s/DB_NAME=.*/DB_NAME=$DB_NAME/" .env
        sed -i "s/DB_USER=.*/DB_USER=$DB_USER/" .env
        sed -i "s/DB_PASSWORD=.*/DB_PASSWORD=$DB_PASS/" .env
    fi
    
    echo ""
    echo "✅ Setup complete!"
    echo ""
    echo "🚀 To start the backend:"
    echo "   cd backend"
    echo "   npm run dev"
    echo ""
    echo "📍 API will run at: http://localhost:5000"
    echo ""
    echo "🔑 Default Super Admin:"
    echo "   Email: admin@hotelcms.com"
    echo "   Password: Admin@123"
    
else
    echo "❌ Invalid choice"
    exit 1
fi

echo ""
echo "📚 Check README.md for full documentation"
echo "🎯 View hotel-cms-guide.md for implementation details"
