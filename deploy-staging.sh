#!/bin/bash

# Staging Deployment Script
# Usage: ./deploy-staging.sh
# 
# Note: Backup is handled separately by:
# 1. pre-deploy-check.sh (automatic backup before deployment)
# 2. backup-data.sh (manual backup when needed)

set -e  # Exit on any error

echo "🚀 Starting Staging Deployment..."

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

# Build and deploy with staging overrides (graceful restart)
echo "🐳 Deploying with staging configuration..."
echo "Note: Using graceful restart to preserve data"
docker compose -f docker-compose.yml -f docker-compose.staging.yml build --no-cache
docker compose -f docker-compose.yml -f docker-compose.staging.yml up -d

# Restart Prometheus to apply configuration changes
echo "🔄 Restarting Prometheus to apply configuration changes..."
docker compose -f docker-compose.yml -f docker-compose.staging.yml restart prometheus

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

echo ""
echo "🎉 Staging deployment completed successfully!"
echo ""
echo "📊 Monitoring URLs:"
echo "  • Grafana: https://staging-api.inspeksimobil.id/grafana"
echo "  • Prometheus: https://staging-api.inspeksimobil.id/prometheus"
echo "  • Metrics: https://staging-api.inspeksimobil.id/v1/metrics"
echo ""
echo "📁 Volume paths:"
echo "  • Uploads: /var/www/cardano-backend/uploads"
echo "  • PDF Archive: /var/www/cardano-backend/pdfarchived"
echo ""
echo "✅ Ready for staging testing!"
