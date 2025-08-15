#!/bin/bash

echo "=== Grafana Fix Script ==="
echo "Date: $(date)"
echo

# Detect environment
if [[ "$1" == "staging" ]]; then
    ENV="staging"
    COMPOSE_FILES="-f docker-compose.yml -f docker-compose.staging.yml"
    echo "Environment: STAGING"
elif [[ "$1" == "production" ]]; then
    ENV="production"
    COMPOSE_FILES="-f docker-compose.yml -f docker-compose.prod.yml"
    echo "Environment: PRODUCTION"
else
    echo "Usage: $0 [staging|production]"
    echo "Example: $0 staging"
    exit 1
fi

echo "=== Stopping Grafana ==="
if command -v docker-compose >/dev/null 2>&1; then
    docker-compose $COMPOSE_FILES down grafana
elif command -v docker >/dev/null 2>&1; then
    docker compose $COMPOSE_FILES down grafana
else
    echo "Neither docker-compose nor docker compose found"
fi
echo

echo "=== Starting Grafana ==="
if command -v docker-compose >/dev/null 2>&1; then
    docker-compose $COMPOSE_FILES up -d grafana
elif command -v docker >/dev/null 2>&1; then
    docker compose $COMPOSE_FILES up -d grafana
else
    echo "Neither docker-compose nor docker compose found"
fi
echo

echo "=== Waiting for Grafana to start ==="
sleep 10

echo "=== Checking Environment Variables ==="
docker exec grafana env | grep GF_SERVER
echo

echo "=== Testing Local Access ==="
echo "Testing http://localhost:3001/grafana/"
curl -I http://localhost:3001/grafana/ 2>/dev/null || echo "Failed to connect"
echo

echo "Testing http://localhost:3001/grafana/login"
curl -I http://localhost:3001/grafana/login 2>/dev/null || echo "Failed to connect"
echo

echo "=== Container Logs ==="
docker logs grafana --tail 5
echo

echo "=== Fix Complete ==="
echo "Grafana should now be accessible without redirect loops"
if [[ "$ENV" == "staging" ]]; then
    echo "Test URL: https://staging-api.inspeksimobil.id/grafana/"
else
    echo "Test URL: https://api.inspeksimobil.id/grafana/"
fi
