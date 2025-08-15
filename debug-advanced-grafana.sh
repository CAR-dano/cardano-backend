#!/bin/bash

echo "=== Advanced Grafana Debug ==="
echo "Date: $(date)"
echo

echo "=== 1. Testing Different Paths ==="
echo "Testing root path:"
curl -v http://localhost:3001/ 2>&1 | head -20

echo ""
echo "Testing grafana path:"
curl -v http://localhost:3001/grafana/ 2>&1 | head -20

echo ""
echo "Testing with User-Agent (simulate browser):"
curl -v -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" http://localhost:3001/grafana/ 2>&1 | head -20

echo ""
echo "=== 2. Check Nginx Configuration ==="
echo "Nginx sites-enabled:"
ls -la /etc/nginx/sites-enabled/ 2>/dev/null || echo "Cannot access nginx config"

echo ""
echo "Looking for staging-api.inspeksimobil.id config:"
grep -r "staging-api.inspeksimobil.id" /etc/nginx/ 2>/dev/null | head -10 || echo "Cannot read nginx configs"

echo ""
echo "=== 3. Test Direct Domain Access ==="
echo "Testing external domain with curl:"
curl -I https://staging-api.inspeksimobil.id/grafana/ 2>/dev/null || echo "External access failed"

echo ""
echo "Testing with follow redirects:"
curl -L -I https://staging-api.inspeksimobil.id/grafana/ 2>/dev/null || echo "Follow redirects failed"

echo ""
echo "=== 4. Grafana Internal Config ==="
echo "Check if Grafana has internal redirects:"
docker exec grafana cat /etc/grafana/grafana.ini | grep -A5 -B5 "root_url\|serve_from_sub_path\|domain" 2>/dev/null || echo "Cannot read grafana.ini"

echo ""
echo "=== 5. Environment Variables Full List ==="
docker exec grafana env | grep GF_ | sort

echo ""
echo "=== Debug Complete ==="
