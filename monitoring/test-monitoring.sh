#!/bin/bash

echo "🚀 Testing Cardano Backend Monitoring Setup"
echo "============================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if service is running
check_service() {
    local service_name=$1
    local url=$2
    
    echo -n "Checking $service_name... "
    
    if curl -s "$url" > /dev/null; then
        echo -e "${GREEN}✓ Running${NC}"
        return 0
    else
        echo -e "${RED}✗ Not accessible${NC}"
        return 1
    fi
}

# Function to test metrics endpoint
test_metrics() {
    echo -n "Testing application metrics endpoint... "
    
    if curl -s "http://localhost:3010/metrics" | grep -q "http_requests_total"; then
        echo -e "${GREEN}✓ Metrics available${NC}"
        return 0
    else
        echo -e "${RED}✗ Metrics not available${NC}"
        return 1
    fi
}

echo ""
echo "📊 Checking Monitoring Services:"
echo "--------------------------------"

# Check Prometheus
check_service "Prometheus" "http://localhost:9090"

# Check Grafana
check_service "Grafana" "http://localhost:3001"

# Check Node Exporter
check_service "Node Exporter" "http://localhost:9100"

echo ""
echo "🔍 Checking Application:"
echo "------------------------"

# Check if application is running
check_service "Cardano Backend" "http://localhost:3010"

# Test metrics endpoint if app is running
if curl -s "http://localhost:3010" > /dev/null; then
    echo -n "Testing application metrics endpoint... "
    
    if curl -s "http://localhost:3010/api/v1/metrics" | grep -q "http_requests_total"; then
        echo -e "${GREEN}✓ Metrics available${NC}"
        return 0
    else
        echo -e "${RED}✗ Metrics not available${NC}"
        return 1
    fi
else
    echo -e "${YELLOW}⚠ Application not running, skipping metrics test${NC}"
fi

echo ""
echo "📈 Quick Prometheus Tests:"
echo "--------------------------"

# Test Prometheus targets
echo -n "Checking Prometheus targets... "
if curl -s "http://localhost:9090/api/v1/targets" | grep -q "cardano-backend"; then
    echo -e "${GREEN}✓ Targets configured${NC}"
else
    echo -e "${YELLOW}⚠ Targets not yet configured${NC}"
fi

# Test Prometheus query
echo -n "Testing Prometheus query API... "
if curl -s "http://localhost:9090/api/v1/query?query=up" | grep -q "success"; then
    echo -e "${GREEN}✓ Query API working${NC}"
else
    echo -e "${RED}✗ Query API not working${NC}"
fi

echo ""
echo "🎯 Access URLs:"
echo "---------------"
echo "• Grafana Dashboard: http://localhost:3001 (admin/admin123)"
echo "• Prometheus: http://localhost:9090"
echo "• Application Metrics: http://localhost:3010/api/v1/metrics"
echo "• Node Exporter: http://localhost:9100"

echo ""
echo "🔧 Useful Commands:"
echo "------------------"
echo "• Start all services: docker-compose up -d"
echo "• View logs: docker-compose logs -f [service]"
echo "• Stop services: docker-compose down"
echo "• Restart service: docker-compose restart [service]"

echo ""
echo "📝 Next Steps:"
echo "--------------"
echo "1. Login to Grafana at http://localhost:3001"
echo "2. Check pre-configured dashboards"
echo "3. Start your application with: npm run start:dev"
echo "4. Generate some traffic to see metrics"
echo "5. Explore Prometheus at http://localhost:9090"

echo ""
echo -e "${GREEN}✅ Monitoring setup test completed!${NC}"
