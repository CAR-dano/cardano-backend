#!/bin/bash

# Data Restore Script
# Usage: ./restore-data.sh [backup_directory]

set -e

BACKUP_DIR="$1"

if [ -z "$BACKUP_DIR" ]; then
    echo "❌ ERROR: Please specify backup directory"
    echo "Usage: ./restore-data.sh [backup_directory]"
    echo ""
    echo "Available backups:"
    ls -la backups/ 2>/dev/null || echo "No backups found"
    exit 1
fi

if [ ! -d "$BACKUP_DIR" ]; then
    echo "❌ ERROR: Backup directory not found: $BACKUP_DIR"
    exit 1
fi

echo "🛡️  Starting data restore from: $BACKUP_DIR"
echo ""

# Show backup info
if [ -f "$BACKUP_DIR/BACKUP_INFO.txt" ]; then
    echo "📋 Backup Information:"
    cat "$BACKUP_DIR/BACKUP_INFO.txt"
    echo ""
fi

# Confirmation
read -p "⚠️  WARNING: This will overwrite current data. Continue? (yes/no): " -r
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "❌ Restore cancelled"
    exit 1
fi

# Create current backup before restore
echo "💾 Creating backup of current state before restore..."
./backup-data.sh "pre-restore" || echo "⚠️  Could not backup current state"

# Stop application
echo "🛑 Stopping application..."
docker compose down || echo "⚠️  Application not running"

# Restore .env
if [ -f "$BACKUP_DIR/.env.backup" ]; then
    echo "📋 Restoring .env file..."
    cp "$BACKUP_DIR/.env.backup" .env
    echo "✅ .env restored"
fi

# Restore uploads
if [ -d "$BACKUP_DIR/uploads" ]; then
    echo "📁 Restoring uploads directory..."
    rm -rf uploads 2>/dev/null || true
    cp -r "$BACKUP_DIR/uploads" ./
    echo "✅ Uploads directory restored"
fi

# Restore PDF archives
if [ -d "$BACKUP_DIR/pdfarchived" ]; then
    echo "📄 Restoring PDF archives..."
    rm -rf pdfarchived 2>/dev/null || true
    cp -r "$BACKUP_DIR/pdfarchived" ./
    echo "✅ PDF archives restored"
fi

# Start database for restore
echo "🗄️  Starting database for restore..."
docker compose up -d postgres
sleep 10

# Restore database
if [ -f "$BACKUP_DIR/database.sql" ]; then
    echo "💾 Restoring database..."
    POSTGRES_USER=$(grep POSTGRES_USER .env | cut -d= -f2 2>/dev/null || echo "cardano_user")
    docker compose exec -T postgres psql -U ${POSTGRES_USER} -d postgres < "$BACKUP_DIR/database.sql"
    echo "✅ Database restored"
fi

# Start full application
echo "🚀 Starting application..."
docker compose up -d

echo ""
echo "🎉 Restore completed successfully!"
echo "🔍 Please verify your application is working correctly"
