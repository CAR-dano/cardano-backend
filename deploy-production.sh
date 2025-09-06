#!/bin/bash

# Production Deployment Script for VPS
# Usage: ./deploy-production.sh
# 
# Note: Backup is handled separately by:
# 1. pre-deploy-check.sh (automatic backup before deployment)
# 2. backup-data.sh (manual backup when needed)

set -e  # Exit on any error

# --- Options ---
# --confirm            Required to deploy to production
# --fast               Skip build and health checks for faster rollout
# --skip-build         Skip the image build step
# --skip-healthcheck   Skip health checks after up -d
# --no-cache           Force build without using Docker cache

CONFIRMED=false
FAST=false
SKIP_BUILD=false
SKIP_HEALTHCHECK=false
NO_CACHE=false

for arg in "$@"; do
  case "$arg" in
    --confirm) CONFIRMED=true ;;
    --fast) FAST=true ;;
    --skip-build) SKIP_BUILD=true ;;
    --skip-healthcheck) SKIP_HEALTHCHECK=true ;;
    --no-cache) NO_CACHE=true ;;
    -h|--help)
      echo "Usage: $0 --confirm [--fast|--skip-build] [--skip-healthcheck] [--no-cache]"
      exit 0
      ;;
  esac
done

echo "🚀 Starting Production Deployment..."

# Check if running on production environment
if [[ "$CONFIRMED" != true ]]; then
    echo "⚠️  WARNING: This will deploy to PRODUCTION environment!"
    echo "Make sure you have:"
    echo "  1. ✅ Configured .env file with production values"
    echo "  2. ✅ Configured nginx reverse proxy"
    echo "  3. ✅ SSL certificates in place"
    echo "  4. ✅ Production directories exist: /home/maul/cardano-app/backend/"
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

COMPOSE_CMD=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)

# Build and deploy with production overrides (graceful restart)
echo "🐳 Deploying with production configuration..."
echo "Note: Using graceful restart to preserve data"

if [[ "$FAST" == true ]]; then
  echo "⚡ Fast mode enabled: skipping build and health checks"
  SKIP_BUILD=true
  SKIP_HEALTHCHECK=true
fi

if [[ "$SKIP_BUILD" != true ]]; then
  echo "🔨 Building images (cached) ..."
  if [[ "$NO_CACHE" == true ]]; then
    echo "  (no-cache)"
    "${COMPOSE_CMD[@]}" build --no-cache
  else
    "${COMPOSE_CMD[@]}" build
  fi
else
  echo "⏭️  Skipping build step"
fi

echo "🚢 Starting services..."
"${COMPOSE_CMD[@]}" up -d

# Helper functions for health checks (replace fixed sleep with smart waits)
wait_for_http() {
  local url="$1"; shift
  local name="$1"; shift
  local timeout="${1:-120}"; shift || true
  local interval=3
  local elapsed=0
  while (( elapsed < timeout )); do
    if curl -fsS "$url" > /dev/null 2>&1; then
      echo "✅ $name: Healthy"
      return 0
    fi
    sleep "$interval"
    elapsed=$((elapsed+interval))
  done
  echo "❌ $name: Timeout after ${timeout}s ($url)"
  return 1
}

wait_for_postgres() {
  local timeout="${1:-120}"; shift || true
  local interval=3
  local elapsed=0
  local user="${POSTGRES_USER:-cardano_user}"
  while (( elapsed < timeout )); do
    if "${COMPOSE_CMD[@]}" exec -T postgres pg_isready -U "$user" > /dev/null 2>&1; then
      echo "✅ PostgreSQL: Healthy"
      return 0
    fi
    sleep "$interval"
    elapsed=$((elapsed+interval))
  done
  echo "❌ PostgreSQL: Timeout after ${timeout}s"
  return 1
}

if [[ "$SKIP_HEALTHCHECK" != true ]]; then
  echo "🔍 Running health checks..."
else
  echo "⏭️  Skipping health checks"
fi

if [[ "$SKIP_HEALTHCHECK" != true ]]; then
  # Application
  wait_for_http "http://localhost:3010/api/v1/metrics" "Application" 120 || exit 1

  # Prometheus
  wait_for_http "http://localhost:9090/-/healthy" "Prometheus" 120 || exit 1

  # Grafana
  wait_for_http "http://localhost:3001/api/health" "Grafana" 120 || exit 1

  # Database
  wait_for_postgres 120 || exit 1
fi

echo ""
echo "🎉 Production deployment completed successfully!"
echo ""
echo "📊 Monitoring URLs:"
echo "  • Grafana: https://$(grep GRAFANA_DOMAIN .env | cut -d= -f2 | tr -d '"')/grafana"
echo "  • Prometheus: https://$(grep GRAFANA_DOMAIN .env | cut -d= -f2 | tr -d '"')/prometheus"
echo "  • Metrics: https://$(grep GRAFANA_DOMAIN .env | cut -d= -f2 | tr -d '"')/v1/metrics"
echo ""
echo " Useful commands:"
echo "  • View logs: docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f [service]"
echo "  • Scale service: docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --scale app=2"
echo "  • Stop services: docker compose -f docker-compose.yml -f docker-compose.prod.yml down"
echo ""
echo "✅ Ready for production traffic!"
