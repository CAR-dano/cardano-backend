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

if ! command -v unzip >/dev/null 2>&1; then
    echo "❌ 'unzip' command not found. Please install unzip (e.g., apt-get install -y unzip) and retry."
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

# Restore uploads/inspection-photos (prefer zip if available)
if [ -f "$BACKUP_DIR/inspection-photos.zip" ]; then
    echo "📁 Restoring uploads/inspection-photos from zip..."
    rm -rf uploads/inspection-photos 2>/dev/null || true
    mkdir -p uploads
    (cd "$BACKUP_DIR" && unzip -oq "inspection-photos.zip")
    # Zip was created with path 'uploads/inspection-photos', so extraction at root of repo is expected
    # If extracted into BACKUP_DIR by unzip, move accordingly (handle both cases)
    if [ -d "$BACKUP_DIR/uploads/inspection-photos" ]; then
        mkdir -p uploads
        rm -rf uploads/inspection-photos 2>/dev/null || true
        mv "$BACKUP_DIR/uploads/inspection-photos" "uploads/" 2>/dev/null || true
        rmdir "$BACKUP_DIR/uploads" 2>/dev/null || true
    fi
    echo "✅ uploads/inspection-photos restored"
elif [ -d "$BACKUP_DIR/uploads" ]; then
    echo "📁 Restoring uploads directory (legacy backup)..."
    rm -rf uploads 2>/dev/null || true
    cp -r "$BACKUP_DIR/uploads" ./
    echo "✅ Uploads directory restored"
fi

# Restore PDF archives (prefer zip if available)
if [ -f "$BACKUP_DIR/pdfarchived.zip" ]; then
    echo "📄 Restoring pdfarchived from zip..."
    rm -rf pdfarchived 2>/dev/null || true
    (cd "$BACKUP_DIR" && unzip -oq "pdfarchived.zip")
    if [ -d "$BACKUP_DIR/pdfarchived" ]; then
        rm -rf pdfarchived 2>/dev/null || true
        mv "$BACKUP_DIR/pdfarchived" ./ 2>/dev/null || true
    fi
    echo "✅ PDF archives restored"
elif [ -d "$BACKUP_DIR/pdfarchived" ]; then
    echo "📄 Restoring PDF archives (legacy backup)..."
    rm -rf pdfarchived 2>/dev/null || true
    cp -r "$BACKUP_DIR/pdfarchived" ./
    echo "✅ PDF archives restored"
fi

# Start database for restore
echo "🗄️  Starting database for restore..."
docker compose up -d postgres
sleep 10

# Restore database
if [ -f "$BACKUP_DIR/sql.zip" ] && [ ! -f "$BACKUP_DIR/database.sql" ]; then
    echo "💾 Extracting database dump from sql.zip..."
    (cd "$BACKUP_DIR" && unzip -oq "sql.zip")
fi
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
