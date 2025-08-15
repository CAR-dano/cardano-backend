#!/bin/bash

echo "=== Production Grafana Fix ==="
echo "Date: $(date)"
echo

# Backup current production config
echo "🔄 Creating backup of current configuration..."
cp docker-compose.prod.yml docker-compose.prod.yml.backup.$(date +%Y%m%d_%H%M%S)

echo "🚀 Applying Grafana fix to Production..."

# Apply the fix
if command -v docker-compose >/dev/null 2>&1; then
    DOCKER_CMD="docker-compose"
elif command -v docker >/dev/null 2>&1; then
    DOCKER_CMD="docker compose"
else
    echo "❌ Neither docker-compose nor docker compose found"
    exit 1
fi

echo "📥 Pulling latest changes..."
git pull origin staging

echo "🛑 Stopping Grafana..."
$DOCKER_CMD -f docker-compose.yml -f docker-compose.prod.yml down grafana

echo "🚀 Starting Grafana with new config..."
$DOCKER_CMD -f docker-compose.yml -f docker-compose.prod.yml up -d grafana

echo "⏳ Waiting for Grafana to start..."
sleep 20

echo "🔍 Testing Production Grafana..."
echo "Environment Variables:"
docker exec grafana env | grep GF_SERVER || echo "Container not responding yet"

echo ""
echo "Local Access Test:"
curl -I http://localhost:3001/grafana/login 2>/dev/null || echo "Local access failed"

echo ""
echo "🎯 Production URLs to test:"
echo "  • Login: https://api.inspeksimobil.id/grafana/login"
echo "  • Dashboard: https://api.inspeksimobil.id/grafana/"
echo ""
echo "✅ Production Grafana fix completed!"
echo "🔍 Please test the URLs above in your browser"
