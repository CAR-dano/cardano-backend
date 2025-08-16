#!/bin/bash

# Production Monitoring Test Script
# Test connectivity and data flow in production environment

echo "🔍 Production Monitoring Diagnostics"
echo "===================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to test URL accessibility
test_url() {
    local url=$1
    local name=$2
    echo -n "Testing $name ($url)... "
    
    if curl -s --max-time 10 "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Accessible${NC}"
        return 0
    else
        echo -e "${RED}✗ Not accessible${NC}"
        return 1
    fi
}

# Function to test metrics endpoint
test_metrics() {
    local url=$1
    echo -n "Testing metrics endpoint ($url)... "
    
    if curl -s --max-time 10 "$url" | grep -q "http_requests_total"; then
        echo -e "${GREEN}✓ Metrics available${NC}"
        return 0
    else
        echo -e "${RED}✗ Metrics not available${NC}"
        return 1
    fi
}

echo "📡 Testing Production Endpoints:"
echo "--------------------------------"

# Test main application
test_url "https://api.inspeksimobil.id/v1/metrics" "Application Metrics"

# Test Prometheus
test_url "https://api.inspeksimobil.id/prometheus" "Prometheus Web UI"
test_url "https://api.inspeksimobil.id/prometheus/api/v1/targets" "Prometheus API"

# Test Grafana
test_url "https://api.inspeksimobil.id/grafana/" "Grafana Dashboard"

echo ""
echo "🔬 Testing Metrics Data:"
echo "------------------------"

# Test if metrics contain expected data
test_metrics "https://api.inspeksimobil.id/v1/metrics"

echo ""
echo "🎯 Testing Prometheus Targets:"
echo "------------------------------"

# Check Prometheus targets status
echo -n "Checking Prometheus targets... "
if targets_response=$(curl -s --max-time 10 "https://api.inspeksimobil.id/prometheus/api/v1/targets" 2>/dev/null); then
    if echo "$targets_response" | grep -q '"health":"up"'; then
        echo -e "${GREEN}✓ Some targets are up${NC}"
        
        # Show cardano-backend target status
        if echo "$targets_response" | grep -q 'cardano-backend.*"health":"up"'; then
            echo -e "  ${GREEN}✓ cardano-backend target is healthy${NC}"
        else
            echo -e "  ${RED}✗ cardano-backend target is down${NC}"
        fi
    else
        echo -e "${RED}✗ No healthy targets found${NC}"
    fi
else
    echo -e "${RED}✗ Cannot reach Prometheus API${NC}"
fi

echo ""
echo "📊 Testing Metrics Query:"
echo "-------------------------"

# Test a simple metrics query
echo -n "Testing Prometheus query (up metric)... "
if query_response=$(curl -s --max-time 10 "https://api.inspeksimobil.id/prometheus/api/v1/query?query=up" 2>/dev/null); then
    if echo "$query_response" | grep -q '"status":"success"'; then
        echo -e "${GREEN}✓ Query successful${NC}"
        
        # Count up targets
        up_count=$(echo "$query_response" | grep -o '"value":\[.*,"1"\]' | wc -l)
        echo "  Found $up_count healthy targets"
    else
        echo -e "${RED}✗ Query failed${NC}"
    fi
else
    echo -e "${RED}✗ Cannot execute query${NC}"
fi

echo ""
echo "💡 Troubleshooting Tips:"
echo "------------------------"
echo "1. Ensure nginx configuration includes Prometheus and Grafana proxy rules"
echo "2. Check Docker containers are running: docker ps"
echo "3. Check Prometheus targets: https://api.inspeksimobil.id/prometheus/targets"
echo "4. Verify Grafana datasource configuration"
echo "5. Check application is exposing metrics: https://api.inspeksimobil.id/v1/metrics"

echo ""
echo "🔗 Production URLs:"
echo "------------------"
echo "• Application Metrics: https://api.inspeksimobil.id/v1/metrics"
echo "• Prometheus: https://api.inspeksimobil.id/prometheus"
echo "• Grafana: https://api.inspeksimobil.id/grafana/"
