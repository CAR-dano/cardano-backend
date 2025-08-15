#!/bin/bash

# Data Backup Script
# Usage: ./backup-data.sh [environment]

set -e

ENVIRONMENT=${1:-"development"}
BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)_${ENVIRONMENT}"

echo "🛡️  Starting data backup for: $ENVIRONMENT"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup .env file
if [ -f ".env" ]; then
    echo "📋 Backing up .env file..."
    cp .env "$BACKUP_DIR/.env.backup"
    echo "✅ .env backed up"
else
    echo "⚠️  No .env file found to backup"
fi

# Backup database
echo "💾 Backing up database..."
if docker-compose ps postgres | grep -q "Up" 2>/dev/null; then
    POSTGRES_USER=$(grep POSTGRES_USER .env | cut -d= -f2 2>/dev/null || echo "cardano_user")
    docker-compose exec -T postgres pg_dumpall -U ${POSTGRES_USER} > "$BACKUP_DIR/database.sql"
    echo "✅ Database backed up to: $BACKUP_DIR/database.sql"
else
    echo "⚠️  Database not running, skipping database backup"
fi

# Backup uploads directory
if [ -d "uploads" ]; then
    echo "📁 Backing up uploads directory..."
    cp -r uploads "$BACKUP_DIR/uploads"
    echo "✅ Uploads directory backed up"
else
    echo "⚠️  No uploads directory found"
fi

# Backup PDF archives
if [ -d "pdfarchived" ]; then
    echo "📄 Backing up PDF archives..."
    cp -r pdfarchived "$BACKUP_DIR/pdfarchived"
    echo "✅ PDF archives backed up"
else
    echo "⚠️  No pdfarchived directory found"
fi

# Create backup manifest
echo "📝 Creating backup manifest..."
cat > "$BACKUP_DIR/BACKUP_INFO.txt" << EOF
Backup Information
==================
Environment: $ENVIRONMENT
Date: $(date)
Hostname: $(hostname)
User: $(whoami)

Contents:
- .env.backup (if existed)
- database.sql (PostgreSQL dump)
- uploads/ directory
- pdfarchived/ directory

Restore Instructions:
1. Stop application: docker-compose down
2. Restore database: docker-compose exec -T postgres psql -U \$POSTGRES_USER < database.sql
3. Copy uploads: cp -r uploads/ ./
4. Copy pdfarchived: cp -r pdfarchived/ ./
5. Copy .env: cp .env.backup .env
6. Start application: docker-compose up -d
EOF

echo ""
echo "🎉 Backup completed successfully!"
echo "📁 Backup location: $BACKUP_DIR"
echo "📋 Backup size: $(du -sh $BACKUP_DIR | cut -f1)"
echo ""
echo "To restore this backup:"
echo "  ./restore-data.sh $BACKUP_DIR"
