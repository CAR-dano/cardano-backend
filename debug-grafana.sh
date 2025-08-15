#!/bin/bash

echo "=== Grafana Debug Script ==="
echo "Date: $(date)"
echo

echo "=== 1. Container Status ==="
docker ps | grep grafana
echo

echo "=== 2. Environment Variables ==="
docker exec grafana env | grep GF_
echo

echo "=== 3. Network Test - Local ==="
echo "Testing http://localhost:3001/"
curl -I http://localhost:3001/ 2>/dev/null || echo "Failed to connect"
echo

echo "Testing http://localhost:3001/grafana/"
curl -I http://localhost:3001/grafana/ 2>/dev/null || echo "Failed to connect"
echo

echo "=== 4. Container Logs (last 10 lines) ==="
docker logs grafana --tail 10
echo

echo "=== 5. Port Usage ==="
echo "Port 80:"
sudo netstat -tlnp | grep :80 || echo "No service on port 80"
echo "Port 443:"
sudo netstat -tlnp | grep :443 || echo "No service on port 443"
echo "Port 3001:"
sudo netstat -tlnp | grep :3001 || echo "No service on port 3001"
echo

echo "=== 6. Process Check ==="
echo "Nginx processes:"
ps aux | grep nginx | grep -v grep || echo "No nginx processes"
echo "Apache processes:"
ps aux | grep apache | grep -v grep || echo "No apache processes"
echo

echo "=== Debug Complete ==="
