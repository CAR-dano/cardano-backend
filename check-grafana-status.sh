#!/bin/bash

echo "=== Grafana Status Check ==="
echo "Date: $(date)"
echo

echo "=== Container Status ==="
docker ps | grep grafana
echo

echo "=== Waiting for Grafana to fully start ==="
sleep 15

echo "=== Testing Local Access ==="
echo "Testing http://localhost:3001/"
curl -I http://localhost:3001/ 2>/dev/null || echo "Failed to connect"
echo

echo "Testing http://localhost:3001/grafana/"
curl -I http://localhost:3001/grafana/ 2>/dev/null || echo "Failed to connect"
echo

echo "Testing http://localhost:3001/grafana/login"
curl -I http://localhost:3001/grafana/login 2>/dev/null || echo "Failed to connect"
echo

echo "=== Environment Variables ==="
docker exec grafana env | grep GF_SERVER || echo "Container not responding"
echo

echo "=== Recent Container Logs ==="
docker logs grafana --tail 10 || echo "Cannot get logs"
echo

echo "=== Port Check ==="
netstat -tlnp | grep :3001
echo

echo "=== Status Check Complete ==="
