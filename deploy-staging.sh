#!/bin/bash

# Staging Deployment Script
# Usage: ./deploy-staging.sh

set -e  # Exit on any error

echo "🚀 Starting Staging Deployment..."

# Create backups directory if not exists
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups/${TIMESTAMP}_staging"
if [ ! -d "$BACKUP_DIR" ]; then
    echo "📁 Creating backups directory: $BACKUP_DIR"
    mkdir -p "$BACKUP_DIR"
fi

# Check if .env exists, backup if exists
if [ -f ".env" ]; then
    echo "💾 Backing up existing .env file..."
    cp .env "$BACKUP_DIR/.env"
    echo "✅ Backup saved as: $BACKUP_DIR/.env"
fi

# Check if .env exists, if not create from staging template
if [ ! -f ".env" ]; then
    echo "📝 No .env file found. Creating from staging template..."
    if [ -f ".env.staging" ]; then
        cp .env.staging .env
        echo "✅ Created .env from .env.staging template"
        echo "⚠️  Please review and update .env with your actual staging values!"
    else
        echo "❌ ERROR: No .env.staging template found!"
        echo "Please create .env file manually or create .env.staging template first."
        exit 1
    fi
else
    echo "✅ Using existing .env file"
fi

# Check if staging directories exist, create if not
echo "📁 Checking staging directories..."
STAGING_UPLOAD_DIR="/var/www/cardano-backend/uploads"
STAGING_PDF_DIR="/var/www/cardano-backend/pdfarchived"

if [ ! -d "$STAGING_UPLOAD_DIR" ]; then
    echo "📁 Creating staging uploads directory: $STAGING_UPLOAD_DIR"
    mkdir -p "$STAGING_UPLOAD_DIR"
    chown -R $USER:$USER "$STAGING_UPLOAD_DIR"
else
    echo "✅ Staging uploads directory already exists: $STAGING_UPLOAD_DIR"
fi

if [ ! -d "$STAGING_PDF_DIR" ]; then
    echo "📁 Creating staging PDF directory: $STAGING_PDF_DIR"
    mkdir -p "$STAGING_PDF_DIR"
    chown -R $USER:$USER "$STAGING_PDF_DIR"
else
    echo "✅ Staging PDF directory already exists: $STAGING_PDF_DIR"
fi

# Check if running on staging environment
if [[ "$1" != "--confirm" ]]; then
    echo "⚠️  WARNING: This will deploy to STAGING environment!"
    echo "Make sure you have:"
    echo "  1. ✅ Updated .env.staging with correct values"
    echo "  2. ✅ Configured nginx reverse proxy for staging"
    echo "  3. ✅ SSL certificates in place"
    echo "  4. ✅ Staging directories exist: /var/www/cardano-backend/"
    echo ""
    echo "Run with --confirm flag to proceed:"
    echo "  ./deploy-staging.sh --confirm"
    exit 1
fi

# Switch to staging monitoring config
echo "🔧 Switching to staging monitoring configuration..."
./monitoring/switch-environment.sh staging

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
if [ -f "docker-compose.staging.yml" ]; then
    cp docker-compose.staging.yml "$BACKUP_DIR/docker-compose.staging.yml"
fi
echo "✅ Docker-compose config backed up"

# Build and deploy with staging overrides (graceful restart)
echo "🐳 Deploying with staging configuration..."
echo "Note: Using graceful restart to preserve data"
docker compose -f docker-compose.yml -f docker-compose.staging.yml build --no-cache
docker compose -f docker-compose.yml -f docker-compose.staging.yml up -d

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

# Cleanup old backups (keep only last 10)
echo "🧹 Cleaning up old backups..."
find "./backups" -maxdepth 1 -type d -name "*_staging" | sort | head -n -10 | xargs rm -rf 2>/dev/null || true
echo "✅ Old backups cleaned (kept last 10)"

echo ""
echo "🎉 Staging deployment completed successfully!"
echo ""
echo "📊 Monitoring URLs:"
echo "  • Grafana: https://staging-cari.inspeksimobil.id/grafana"
echo "  • Prometheus: https://staging-cari.inspeksimobil.id/prometheus"
echo "  • Metrics: https://staging-cari.inspeksimobil.id/v1/metrics"
echo ""
echo "📁 Backup Information:"
echo "  • Full backup directory: $BACKUP_DIR"
echo "  • .env backup: $BACKUP_DIR/.env"
echo "  • Database backup: $BACKUP_DIR/database.sql.gz"
echo "  • Docker config backup: $BACKUP_DIR/docker-compose.yml"
echo ""
echo "📁 Volume paths:"
echo "  • Uploads: /var/www/cardano-backend/uploads"
echo "  • PDF Archive: /var/www/cardano-backend/pdfarchived"
echo ""
echo "✅ Ready for staging testing!"
