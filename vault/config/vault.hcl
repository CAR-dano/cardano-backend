# HashiCorp Vault configuration for staging/production environments
# Used when Vault runs in server mode (not -dev mode)
#
# For development, the docker-compose.yml uses `-dev` mode with an in-memory backend.
# This config is mounted in staging and production containers.

ui = true

# File storage backend — persists data to the vault_data volume
storage "file" {
  path = "/vault/data"
}

# Listener — plain TCP (TLS is terminated at Nginx/reverse-proxy in staging/prod)
listener "tcp" {
  address     = "0.0.0.0:8200"
  tls_disable = 1
}

# Disable mlock for Docker environments (mlock requires CAP_IPC_LOCK)
disable_mlock = true

# API address — used internally by Vault for raft/cluster operations
api_addr = "http://0.0.0.0:8200"
