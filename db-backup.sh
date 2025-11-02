#!/bin/bash

# PostgreSQL Daily Backup Script (for cron)
# - Dumps database from the Docker Compose service `postgres`
# - Writes compressed backup files into /backups
# - Performs simple retention cleanup
#
# Usage (cron):
#   0 2 * * * /bin/bash /path/to/repo/db-backup.sh >> /var/log/db-backup.log 2>&1

set -euo pipefail

# Resolve script directory and switch there so relative paths (like .env) work
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Default config (can be overridden by environment or .env)
BACKUP_DIR="/backups"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

# Load .env if present to get DB creds
if [ -f .env ]; then
  # shellcheck disable=SC2046
  export $(grep -E '^(POSTGRES_USER|POSTGRES_DB)=' .env | xargs -d '\n' || true)
fi

# Fallback defaults if not present in .env
POSTGRES_USER="${POSTGRES_USER:-cardano_user}"
POSTGRES_DB="${POSTGRES_DB:-postgres}"

# Choose docker compose command (plugin or standalone)
if docker compose version >/dev/null 2>&1; then
  DOCKER_COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  DOCKER_COMPOSE=(docker-compose)
else
  echo "❌ Docker Compose not available" >&2
  exit 1
fi

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
FILENAME="postgres_backup_${TIMESTAMP}.sql.gz"

echo "🛡️  Starting PostgreSQL backup at $(date -Is)"
echo "📁 Target directory: ${BACKUP_DIR}"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Verify postgres service is up; if not, try to start just the DB
if ! "${DOCKER_COMPOSE[@]}" ps postgres | grep -q "Up"; then
  echo "ℹ️  Postgres service not Up. Attempting to start..."
  "${DOCKER_COMPOSE[@]}" up -d postgres
  # small wait for readiness
  sleep 8 || true
fi

# Perform dump (pg_dumpall to include roles/schemas), compress on the fly, write to host /backups
BACKUP_PATH="${BACKUP_DIR}/${FILENAME}"
echo "💾 Dumping database as user '${POSTGRES_USER}' (plain SQL, gzipped)"
if ! "${DOCKER_COMPOSE[@]}" exec -T postgres pg_dumpall -U "${POSTGRES_USER}" | gzip -c > "${BACKUP_PATH}"; then
  echo "❌ Backup failed" >&2
  exit 1
fi

# Basic validation (non-empty file)
if [ ! -s "${BACKUP_PATH}" ]; then
  echo "❌ Backup file is empty: ${BACKUP_PATH}" >&2
  exit 1
fi

echo "✅ Backup completed: ${BACKUP_PATH} ($(du -h "${BACKUP_PATH}" | awk '{print $1}'))"

# Retention cleanup
if [ -n "${RETENTION_DAYS}" ]; then
  echo "🧹 Cleaning backups older than ${RETENTION_DAYS} days in ${BACKUP_DIR}"
  find "${BACKUP_DIR}" -type f -name 'postgres_backup_*.sql.gz' -mtime +"${RETENTION_DAYS}" -print -delete || true
fi

echo "🎉 Done at $(date -Is)"

