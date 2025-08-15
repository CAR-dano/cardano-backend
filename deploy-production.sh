#!/bin/bash

# Production Deployment Script for VPS
# Usage: ./deploy-production.sh

set -e  # Exit on any error

echo "🚀 Starting Production Deployment..."

# Create backups directory if not exists
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups/${TIMESTAMP}_production"
if [ ! -d "$BACKUP_DIR" ]; then
    echo "📁 Creating backups directory: $BACKUP_DIR"
    mkdir -p "$BACKUP_DIR"
fi

# Check if running on production environment
if [[ "$1" != "--confirm" ]]; then
    echo "⚠️  WARNING: This will deploy to PRODUCTION environment!"
    echo "Make sure you have:"
    echo "  1. ✅ Configured .env file with production values"
    echo "  2. ✅ Configured nginx reverse proxy"
    echo "  3. ✅ SSL certificates in place"
    echo "  4. ✅ Backup of existing data and database"
    echo "  5. ✅ Production directories exist: /home/maul/cardano-app/backend/"
    echo ""
    echo "Run with --confirm flag to proceed:"
    echo "  ./deploy-production.sh --confirm"
    exit 1
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "❌ ERROR: No .env file found!"
    echo "Please create .env file with production values."
    if [ -f ".env.production" ]; then
        echo "You can use .env.production as template:"
        echo "  cp .env.production .env"
        echo "  nano .env  # Edit with your actual values"
    fi
    echo ""
    echo "❌ Deployment stopped. Create .env file first."
    exit 1
fi

# Backup existing .env file
echo "💾 Creating .env backup..."
cp .env "$BACKUP_DIR/.env"
echo "✅ Backup saved as: $BACKUP_DIR/.env"

# Check if production directories exist, create if not
echo "📁 Checking production directories..."
PROD_UPLOAD_DIR="/home/maul/cardano-app/backend/uploads"
PROD_PDF_DIR="/home/maul/cardano-app/backend/pdfarchived"

if [ ! -d "$PROD_UPLOAD_DIR" ]; then
    echo "📁 Creating uploads directory: $PROD_UPLOAD_DIR"
    mkdir -p "$PROD_UPLOAD_DIR"
    chown -R $USER:$USER "/home/maul/cardano-app/backend/"
else
    echo "✅ Uploads directory already exists: $PROD_UPLOAD_DIR"
fi

if [ ! -d "$PROD_PDF_DIR" ]; then
    echo "📁 Creating PDF archive directory: $PROD_PDF_DIR"
    mkdir -p "$PROD_PDF_DIR"
    chown -R $USER:$USER "/home/maul/cardano-app/backend/"
else
    echo "✅ PDF archive directory already exists: $PROD_PDF_DIR"
fi

# Switch to production monitoring config
echo "🔧 Switching to production monitoring configuration..."
./monitoring/switch-environment.sh production

# Backup database before deployment
echo "💾 Creating database backup..."
if docker compose ps postgres | grep -q "Up" 2>/dev/null; then
    POSTGRES_USER=$(grep POSTGRES_USER .env | cut -d= -f2 | tr -d '"')
    DB_BACKUP_FILE="$BACKUP_DIR/database.sql"
    docker compose exec -T postgres pg_dumpall -U ${POSTGRES_USER:-cardano_user} > "$DB_BACKUP_FILE"
    echo "✅ Database backup created: $DB_BACKUP_FILE"
    
    # Compress the backup to save space
    if command -v gzip &> /dev/null; then
        gzip "$DB_BACKUP_FILE"
        echo "✅ Database backup compressed: $DB_BACKUP_FILE.gz"
    fi
else
    echo "⚠️  Database not running, skipping backup"
fi

# Create docker-compose config backup
echo "💾 Creating docker-compose backup..."
cp docker-compose.yml "$BACKUP_DIR/docker-compose.yml"
if [ -f "docker-compose.prod.yml" ]; then
    cp docker-compose.prod.yml "$BACKUP_DIR/docker-compose.prod.yml"
fi
echo "✅ Docker-compose config backed up"

# Build and deploy with production overrides (graceful restart)
echo "🐳 Deploying with production configuration..."
echo "Note: Using graceful restart to preserve data"
docker compose -f docker-compose.yml -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Wait for services to start
echo "⏳ Waiting for services to start..."
sleep 30

# Health checks
echo "🔍 Running health checks..."

# Check application
if curl -f http://localhost:3010/api/v1/metrics > /dev/null 2>&1; then
    echo "✅ Application: Healthy"
else
    echo "❌ Application: Failed"
    exit 1
fi

# Check Prometheus
if curl -f http://localhost:9090/-/healthy > /dev/null 2>&1; then
    echo "✅ Prometheus: Healthy"
else
    echo "❌ Prometheus: Failed"
    exit 1
fi

# Check Grafana
if curl -f http://localhost:3001/api/health > /dev/null 2>&1; then
    echo "✅ Grafana: Healthy"
else
    echo "❌ Grafana: Failed"
    exit 1
fi

# Check database
if docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T postgres pg_isready -U ${POSTGRES_USER:-cardano_user} > /dev/null 2>&1; then
    echo "✅ PostgreSQL: Healthy"
else
    echo "❌ PostgreSQL: Failed"
    exit 1
fi

# Cleanup old backups (keep only last 10)
echo "🧹 Cleaning up old backups..."
find "./backups" -maxdepth 1 -type d -name "*_production" | sort | head -n -10 | xargs rm -rf 2>/dev/null || true
echo "✅ Old backups cleaned (kept last 10)"

echo ""
echo "🎉 Production deployment completed successfully!"
echo ""
echo "📊 Monitoring URLs:"
echo "  • Grafana: https://$(grep GRAFANA_DOMAIN .env | cut -d= -f2 | tr -d '"')/grafana"
echo "  • Prometheus: https://$(grep GRAFANA_DOMAIN .env | cut -d= -f2 | tr -d '"')/prometheus"
echo "  • Metrics: https://$(grep GRAFANA_DOMAIN .env | cut -d= -f2 | tr -d '"')/v1/metrics"
echo ""
echo "📁 Backup Information:"
echo "  • Full backup directory: $BACKUP_DIR"
echo "  • .env backup: $BACKUP_DIR/.env"
echo "  • Database backup: $BACKUP_DIR/database.sql.gz"
echo "  • Docker config backup: $BACKUP_DIR/docker-compose.yml"
echo ""
echo "🔧 Useful commands:"
echo "  • View logs: docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f [service]"
echo "  • Scale service: docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --scale app=2"
echo "  • Stop services: docker compose -f docker-compose.yml -f docker-compose.prod.yml down"
echo ""
echo "✅ Ready for production traffic!"
