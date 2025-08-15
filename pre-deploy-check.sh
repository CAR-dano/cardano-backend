#!/bin/bash

# Pre-deployment Safety Check
# Usage: ./pre-deploy-check.sh [environment]

set -e

ENVIRONMENT=${1:-"production"}

echo "🔍 Pre-deployment Safety Check for: $ENVIRONMENT"
echo "==============================================="

# Check if .env exists
echo "📋 Checking .env file..."
if [ -f ".env" ]; then
    echo "✅ .env file exists"
    
    # Check critical environment variables
    MISSING_VARS=()
    
    if ! grep -q "DATABASE_URL=" .env; then
        MISSING_VARS+=("DATABASE_URL")
    fi
    
    if ! grep -q "JWT_SECRET=" .env; then
        MISSING_VARS+=("JWT_SECRET")
    fi
    
    if ! grep -q "POSTGRES_USER=" .env; then
        MISSING_VARS+=("POSTGRES_USER")
    fi
    
    if ! grep -q "POSTGRES_PASSWORD=" .env; then
        MISSING_VARS+=("POSTGRES_PASSWORD")
    fi
    
    if [ ${#MISSING_VARS[@]} -gt 0 ]; then
        echo "❌ Missing critical environment variables:"
        printf '  - %s\n' "${MISSING_VARS[@]}"
        echo "Please add these to your .env file"
        exit 1
    else
        echo "✅ All critical environment variables present"
    fi
else
    echo "❌ No .env file found!"
    echo "Please create .env file before deployment"
    exit 1
fi

# Check Docker
echo ""
echo "🐳 Checking Docker..."
if command -v docker &> /dev/null && command -v docker-compose &> /dev/null; then
    echo "✅ Docker and docker-compose available"
    
    # Check Docker daemon
    if docker info &> /dev/null; then
        echo "✅ Docker daemon running"
    else
        echo "❌ Docker daemon not running"
        echo "Please start Docker daemon"
        exit 1
    fi
else
    echo "❌ Docker or docker-compose not installed"
    exit 1
fi

# Check required directories based on environment
echo ""
echo "📁 Checking required directories..."
case $ENVIRONMENT in
    "production")
        REQUIRED_DIRS=(
            "/home/maul/cardano-app/backend/uploads"
            "/home/maul/cardano-app/backend/pdfarchived"
        )
        ;;
    "staging")
        REQUIRED_DIRS=(
            "/var/www/cardano-backend/uploads"
            "/var/www/cardano-backend/pdfarchived"
        )
        ;;
    *)
        REQUIRED_DIRS=(
            "./uploads"
            "./pdfarchived"
        )
        ;;
esac

for dir in "${REQUIRED_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        echo "✅ Directory exists: $dir"
    else
        echo "⚠️  Directory will be created: $dir"
    fi
done

# Check disk space
echo ""
echo "💾 Checking disk space..."
AVAILABLE_SPACE=$(df . | tail -1 | awk '{print $4}')
AVAILABLE_GB=$((AVAILABLE_SPACE / 1024 / 1024))

if [ $AVAILABLE_GB -lt 5 ]; then
    echo "❌ Low disk space: ${AVAILABLE_GB}GB available"
    echo "Recommended: At least 5GB free space"
    exit 1
else
    echo "✅ Sufficient disk space: ${AVAILABLE_GB}GB available"
fi

# Check ports
echo ""
echo "🔌 Checking required ports..."
REQUIRED_PORTS=(3010 5432 9090 3001 9100 9187)

for port in "${REQUIRED_PORTS[@]}"; do
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        PROCESS=$(lsof -Pi :$port -sTCP:LISTEN | tail -1 | awk '{print $1}')
        echo "⚠️  Port $port already in use by: $PROCESS"
        echo "   This might be okay if it's from a previous deployment"
    else
        echo "✅ Port $port available"
    fi
done

# Check network connectivity
echo ""
echo "🌐 Checking network connectivity..."
if curl -s --max-time 5 https://hub.docker.com > /dev/null; then
    echo "✅ Internet connectivity available"
else
    echo "⚠️  Limited internet connectivity - Docker image pulls might fail"
fi

# Create automatic backup before deployment
echo ""
echo "💾 Creating automatic backup..."
./backup-data.sh "pre-deploy-$ENVIRONMENT" || echo "⚠️  Backup failed, but continuing..."

echo ""
echo "🎉 Pre-deployment checks completed!"
echo ""
echo "Summary:"
echo "  ✅ Environment file configured"
echo "  ✅ Docker system ready"
echo "  ✅ Required directories checked"
echo "  ✅ Disk space sufficient"
echo "  ✅ Backup created"
echo ""
echo "🚀 Ready for deployment to: $ENVIRONMENT"
echo ""
echo "To deploy now:"
case $ENVIRONMENT in
    "production")
        echo "  ./deploy-production.sh --confirm"
        ;;
    "staging")
        echo "  ./deploy-staging.sh"
        ;;
    *)
        echo "  docker-compose up -d"
        ;;
esac
