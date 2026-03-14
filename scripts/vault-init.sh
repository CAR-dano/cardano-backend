#!/usr/bin/env bash
# =============================================================================
# scripts/vault-init.sh
# Initialize HashiCorp Vault for CAR-dano Backend
#
# Usage:
#   ./scripts/vault-init.sh                    # Uses VAULT_ADDR & VAULT_TOKEN from env
#   VAULT_ADDR=http://localhost:8200 \
#   VAULT_TOKEN=dev-root-token \
#   ./scripts/vault-init.sh
#
# This script will:
#   1. Enable the KV v2 secrets engine at path "secret/"
#   2. Create placeholder secrets for all 9 secret groups
#   3. Print instructions for filling in real values
#
# Prerequisites:
#   - Vault CLI installed (https://developer.hashicorp.com/vault/downloads)
#   - Vault server running (e.g., via docker-compose up vault)
#   - VAULT_ADDR and VAULT_TOKEN set in environment
# =============================================================================

set -euo pipefail

VAULT_ADDR="${VAULT_ADDR:-http://127.0.0.1:8200}"
VAULT_TOKEN="${VAULT_TOKEN:-dev-root-token}"

export VAULT_ADDR VAULT_TOKEN

# Colours
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()    { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# ---------------------------------------------------------------------------
# 1. Check prerequisites
# ---------------------------------------------------------------------------
if ! command -v vault &>/dev/null; then
  error "vault CLI not found. Install from https://developer.hashicorp.com/vault/downloads"
  exit 1
fi

info "Connecting to Vault at ${VAULT_ADDR} ..."
if ! vault status &>/dev/null; then
  error "Cannot reach Vault at ${VAULT_ADDR}. Is the container running?"
  exit 1
fi
info "Vault is reachable."

# ---------------------------------------------------------------------------
# 2. Enable KV v2 secrets engine (idempotent)
# ---------------------------------------------------------------------------
info "Enabling KV v2 secrets engine at 'secret/' ..."
if vault secrets list | grep -q "^secret/"; then
  warn "KV engine already mounted at 'secret/' — skipping."
else
  vault secrets enable -path=secret kv-v2
  info "KV v2 engine enabled."
fi

# ---------------------------------------------------------------------------
# 3. Write placeholder secrets
#    Replace placeholder values with real secrets before deploying!
# ---------------------------------------------------------------------------

info "Writing placeholder secrets (replace with real values before deploying) ..."

vault kv put secret/cardano-backend/database \
  DATABASE_URL="postgresql://the_db_user:CHANGE_ME@localhost:5432/car_dano_db?schema=public&connection_limit=5&pool_timeout=20&statement_timeout=30000" \
  DIRECT_DB_URL="postgresql://the_db_user:CHANGE_ME@localhost:5432/car_dano_db?schema=public"

info "  ✓ secret/cardano-backend/database"

vault kv put secret/cardano-backend/redis \
  REDIS_URL="redis://:CHANGE_ME@localhost:6379"

info "  ✓ secret/cardano-backend/redis"

vault kv put secret/cardano-backend/jwt \
  JWT_SECRET="CHANGE_ME_strong_jwt_secret_min_32_chars" \
  JWT_REFRESH_SECRET="CHANGE_ME_strong_refresh_secret_min_32_chars"

info "  ✓ secret/cardano-backend/jwt"

vault kv put secret/cardano-backend/google-oauth \
  GOOGLE_CLIENT_ID="CHANGE_ME.apps.googleusercontent.com" \
  GOOGLE_CLIENT_SECRET="CHANGE_ME"

info "  ✓ secret/cardano-backend/google-oauth"

vault kv put secret/cardano-backend/blockchain \
  BLOCKFROST_API_KEY_PREVIEW="CHANGE_ME" \
  BLOCKFROST_API_KEY_PREPROD="CHANGE_ME" \
  BLOCKFROST_API_KEY_MAINNET="CHANGE_ME" \
  WALLET_SECRET_KEY_PREVIEW="CHANGE_ME" \
  WALLET_SECRET_KEY_PREPROD="CHANGE_ME" \
  WALLET_SECRET_KEY_MAINNET="CHANGE_ME"

info "  ✓ secret/cardano-backend/blockchain"

vault kv put secret/cardano-backend/storage \
  B2_KEY_ID="CHANGE_ME" \
  B2_APP_KEY="CHANGE_ME"

info "  ✓ secret/cardano-backend/storage"

vault kv put secret/cardano-backend/payment \
  XENDIT_API_KEY="CHANGE_ME" \
  XENDIT_CALLBACK_TOKEN="CHANGE_ME"

info "  ✓ secret/cardano-backend/payment"

vault kv put secret/cardano-backend/external-apis \
  GEMINI_API_KEY="CHANGE_ME" \
  NEW_RELIC_LICENSE_KEY="CHANGE_ME"

info "  ✓ secret/cardano-backend/external-apis"

vault kv put secret/cardano-backend/app \
  REPORT_DOWNLOAD_SECRET="CHANGE_ME_strong_report_download_secret" \
  GRAFANA_ADMIN_PASSWORD="CHANGE_ME"

info "  ✓ secret/cardano-backend/app"

# ---------------------------------------------------------------------------
# 4. (Optional) Create a scoped read-only policy for the app
# ---------------------------------------------------------------------------
info "Creating 'cardano-backend-reader' policy ..."
vault policy write cardano-backend-reader - <<'EOF'
# Allow reading all cardano-backend secrets (read-only)
path "secret/data/cardano-backend/*" {
  capabilities = ["read"]
}
path "secret/metadata/cardano-backend/*" {
  capabilities = ["list"]
}
EOF
info "  ✓ Policy 'cardano-backend-reader' created."

# ---------------------------------------------------------------------------
# 5. Done
# ---------------------------------------------------------------------------
echo ""
info "============================================================"
info "Vault initialization complete!"
info "============================================================"
echo ""
warn "IMPORTANT: Replace all 'CHANGE_ME' placeholders with real secrets!"
echo ""
echo "  Update secrets with:"
echo "    vault kv patch secret/cardano-backend/<group> KEY=\"real_value\""
echo ""
echo "  Example:"
echo "    vault kv patch secret/cardano-backend/jwt JWT_SECRET=\"your-real-secret\""
echo ""
echo "  List all secrets:"
echo "    vault kv list secret/cardano-backend"
echo ""
echo "  Read a secret group:"
echo "    vault kv get secret/cardano-backend/database"
echo ""
