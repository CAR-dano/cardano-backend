#!/bin/bash

# Data Backup Script
# Usage: ./backup-data.sh [environment]

set -e

ENVIRONMENT=${1:-"development"}
BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)_${ENVIRONMENT}"

echo "🛡️  Starting data backup for: $ENVIRONMENT"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Ensure zip is available
if ! command -v zip >/dev/null 2>&1; then
    echo "❌ 'zip' command not found. Please install zip (e.g., apt-get install -y zip) and retry."
    exit 1
fi

# Backup .env file
if [ -f ".env" ]; then
    echo "📋 Backing up .env file..."
    cp .env "$BACKUP_DIR/.env.backup"
    echo "✅ .env backed up"
else
    echo "⚠️  No .env file found to backup"
fi

# Backup database (dump + zip)
echo "💾 Backing up database..."
if docker compose ps postgres | grep -q "Up" 2>/dev/null; then
    POSTGRES_USER=$(grep POSTGRES_USER .env | cut -d= -f2 2>/dev/null || echo "cardano_user")
    DUMP_PATH="$BACKUP_DIR/database.sql"
    docker compose exec -T postgres pg_dumpall -U ${POSTGRES_USER} > "$DUMP_PATH"
    (cd "$BACKUP_DIR" && zip -q -9 "sql.zip" "$(basename "$DUMP_PATH")")
    rm -f "$DUMP_PATH"
    echo "✅ Database backed up to zip: $BACKUP_DIR/sql.zip"
else
    echo "⚠️  Database not running, skipping database backup"
fi

# Backup uploads/inspection-photos as zip
if [ -d "uploads/inspection-photos" ]; then
    echo "📸 Backing up uploads/inspection-photos..."
    zip -q -9 -r "$BACKUP_DIR/inspection-photos.zip" "uploads/inspection-photos"
    echo "✅ inspection-photos zipped to: $BACKUP_DIR/inspection-photos.zip"
else
    echo "⚠️  uploads/inspection-photos not found"
fi

# Backup PDF archives as zip
if [ -d "pdfarchived" ]; then
    echo "📄 Backing up pdfarchived directory..."
    zip -q -9 -r "$BACKUP_DIR/pdfarchived.zip" "pdfarchived"
    echo "✅ pdfarchived zipped to: $BACKUP_DIR/pdfarchived.zip"
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
- sql.zip (contains database.sql)
- inspection-photos.zip (contains uploads/inspection-photos)
- pdfarchived.zip (contains pdfarchived)

Restore Instructions:
1. Stop application: docker compose down
2. Unzip archives at repo root: unzip sql.zip; unzip inspection-photos.zip; unzip pdfarchived.zip
3. Restore database: docker compose exec -T postgres psql -U \$POSTGRES_USER < database.sql
4. Ensure uploads exist: mkdir -p uploads; (unzipping should recreate uploads/inspection-photos)
5. Copy .env: cp .env.backup .env
6. Start application: docker compose up -d
EOF

echo ""
echo "🎉 Backup completed successfully!"
echo "📁 Backup location: $BACKUP_DIR"
echo "📋 Backup size: $(du -sh $BACKUP_DIR | cut -f1)"
echo ""
echo "To restore this backup:"
echo "  ./restore-data.sh $BACKUP_DIR"
