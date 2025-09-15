#!/bin/bash

# Script untuk switch environment monitoring configuration

ENVIRONMENT=${1:-"development"}

case $ENVIRONMENT in
  "production"|"prod"|"vps")
    echo "🚀 Switching to Production configuration..."
    # Force copy and change permissions if needed
    rm -f monitoring/prometheus/prometheus.yml 2>/dev/null || true
    cp monitoring/prometheus/prometheus.prod.yml monitoring/prometheus/prometheus.yml
    chmod 644 monitoring/prometheus/prometheus.yml
    echo "✅ Production config applied"
    echo "📍 Metrics path: /v1/metrics (for nginx reverse proxy)"
    echo "📁 Volumes: /home/maul/cardano-app/backend/"
    echo ""
    echo "🐳 Deploy command:"
    echo "  docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d"
    ;;
  "staging"|"stage")
    echo "🎯 Switching to Staging configuration..."
    # Force copy and change permissions if needed
    rm -f monitoring/prometheus/prometheus.yml 2>/dev/null || true
    cp monitoring/prometheus/prometheus.prod.yml monitoring/prometheus/prometheus.yml
    chmod 644 monitoring/prometheus/prometheus.yml
    echo "✅ Staging config applied"
    echo "📍 Metrics path: /v1/metrics (for nginx reverse proxy)"
    echo "📁 Volumes: /var/www/cardano-backend/"
    echo ""
    echo "🐳 Deploy command:"
    echo "  docker-compose -f docker-compose.yml -f docker-compose.staging.yml up -d"
    ;;
  "development"|"dev"|"local")
    echo "🔧 Switching to Development configuration..."
    # Force copy and change permissions if needed
    rm -f monitoring/prometheus/prometheus.yml 2>/dev/null || true
    cp monitoring/prometheus/prometheus.dev.yml monitoring/prometheus/prometheus.yml
    chmod 644 monitoring/prometheus/prometheus.yml
    echo "✅ Development config applied"  
    echo "📍 Metrics path: /api/v1/metrics (direct access)"
    echo "📁 Volumes: /home/maul/CAR-dano/new-cardano-backend/"
    echo ""
    echo "🐳 Deploy command:"
    echo "  docker-compose up -d"
    echo "  # or: docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d"
    ;;
  *)
    echo "❌ Unknown environment: $ENVIRONMENT"
    echo "Usage: $0 [production|staging|development]"
    echo ""
    echo "Available environments:"
    echo "  production  - Production VPS (/home/maul/cardano-app/backend/)"
    echo "  staging     - Staging server (/var/www/cardano-backend/)"
    echo "  development - Local development (/home/maul/CAR-dano/new-cardano-backend/)"
    exit 1
    ;;
esac

echo ""
echo "🔄 Restart Prometheus to apply changes:"
echo "  docker-compose restart prometheus"
echo ""
echo "🧪 Test metrics endpoint:"
if [ "$ENVIRONMENT" = "production" ] || [ "$ENVIRONMENT" = "prod" ] || [ "$ENVIRONMENT" = "vps" ] || [ "$ENVIRONMENT" = "staging" ] || [ "$ENVIRONMENT" = "stage" ]; then
  echo "  curl http://api.inspeksimobil.id/v1/metrics"
else
  echo "  curl http://localhost:3010/api/v1/metrics"
fi

echo ""
echo "📁 Make sure target directories exist:"
case $ENVIRONMENT in
  "production"|"prod"|"vps")
    echo "  sudo mkdir -p /home/maul/cardano-app/backend/{uploads,pdfarchived}"
    echo "  sudo chown -R \$USER:\$USER /home/maul/cardano-app/backend/"
    ;;
  "staging"|"stage")
    echo "  sudo mkdir -p /var/www/cardano-backend/{uploads,pdfarchived}"
    echo "  sudo chown -R \$USER:\$USER /var/www/cardano-backend/"
    ;;
  "development"|"dev"|"local")
    echo "  mkdir -p /home/maul/CAR-dano/new-cardano-backend/{uploads,pdfarchived}"
    ;;
esac
