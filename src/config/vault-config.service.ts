/*
 * --------------------------------------------------------------------------
 * File: vault-config.service.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: HashiCorp Vault integration service for secrets management.
 * Fetches secrets from Vault KV v2 engine at runtime and provides a
 * unified interface for all application secrets.
 * Falls back gracefully to ConfigService (environment variables) when
 * Vault is unavailable — ensuring backward compatibility with .env files.
 *
 * Secret path layout (KV v2, mount: secret):
 *   secret/cardano-backend/database      → DATABASE_URL, DIRECT_DB_URL
 *   secret/cardano-backend/redis         → REDIS_URL
 *   secret/cardano-backend/jwt           → JWT_SECRET, JWT_REFRESH_SECRET
 *   secret/cardano-backend/google-oauth  → GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
 *   secret/cardano-backend/blockchain    → BLOCKFROST_API_KEY_*, WALLET_SECRET_KEY_*
 *   secret/cardano-backend/storage       → B2_KEY_ID, B2_APP_KEY
 *   secret/cardano-backend/payment       → XENDIT_API_KEY, XENDIT_CALLBACK_TOKEN
 *   secret/cardano-backend/external-apis → GEMINI_API_KEY, NEW_RELIC_LICENSE_KEY
 *   secret/cardano-backend/app           → REPORT_DOWNLOAD_SECRET, GRAFANA_ADMIN_PASSWORD
 * --------------------------------------------------------------------------
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as vault from 'node-vault';

/** Subset of vault.client returned by node-vault factory */
export interface VaultClient {
  read(path: string): Promise<{ data: { data: Record<string, string> } }>;
}

/** All resolved secrets — merged from Vault + env fallback */
export interface ResolvedSecrets {
  // Database
  DATABASE_URL: string;
  DIRECT_DB_URL: string;
  // Redis
  REDIS_URL: string;
  // JWT
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  // Google OAuth
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  // Blockchain — Blockfrost
  BLOCKFROST_API_KEY_PREVIEW: string;
  BLOCKFROST_API_KEY_PREPROD: string;
  BLOCKFROST_API_KEY_MAINNET: string;
  // Blockchain — Wallet
  WALLET_SECRET_KEY_PREVIEW: string;
  WALLET_SECRET_KEY_PREPROD: string;
  WALLET_SECRET_KEY_MAINNET: string;
  // Backblaze B2 Storage
  B2_KEY_ID: string;
  B2_APP_KEY: string;
  // Payment
  XENDIT_API_KEY: string;
  XENDIT_CALLBACK_TOKEN: string;
  // External APIs
  GEMINI_API_KEY: string;
  NEW_RELIC_LICENSE_KEY: string;
  // Application
  REPORT_DOWNLOAD_SECRET: string;
  GRAFANA_ADMIN_PASSWORD: string;
}

/** Cache entry with TTL */
interface CacheEntry {
  secrets: ResolvedSecrets;
  fetchedAt: number;
  ttlMs: number;
}

/** Vault paths config */
const VAULT_PATHS = {
  database: 'secret/data/cardano-backend/database',
  redis: 'secret/data/cardano-backend/redis',
  jwt: 'secret/data/cardano-backend/jwt',
  googleOauth: 'secret/data/cardano-backend/google-oauth',
  blockchain: 'secret/data/cardano-backend/blockchain',
  storage: 'secret/data/cardano-backend/storage',
  payment: 'secret/data/cardano-backend/payment',
  externalApis: 'secret/data/cardano-backend/external-apis',
  app: 'secret/data/cardano-backend/app',
} as const;

@Injectable()
export class VaultConfigService implements OnModuleInit {
  private readonly logger = new Logger(VaultConfigService.name);
  private vaultClient: VaultClient | null = null;
  private cache: CacheEntry | null = null;
  private readonly cacheTtlMs: number;
  private vaultAvailable = false;

  constructor(private readonly configService: ConfigService) {
    // Default cache TTL: 5 minutes. Override via VAULT_CACHE_TTL_MS env.
    this.cacheTtlMs =
      parseInt(
        this.configService.get<string>('VAULT_CACHE_TTL_MS') ?? '300000',
        10,
      ) || 300000;
  }

  /**
   * Lifecycle hook — called after NestJS module is initialized.
   * Attempts to connect to Vault and pre-warm the secrets cache.
   * On failure, logs a warning and falls back to env vars.
   */
  async onModuleInit(): Promise<void> {
    await this.initVaultClient();
    if (this.vaultAvailable) {
      await this.warmCache();
    }
  }

  /**
   * Initializes the Vault client using VAULT_ADDR and VAULT_TOKEN from env.
   */
  async initVaultClient(): Promise<void> {
    const vaultAddr = this.configService.get<string>('VAULT_ADDR');
    const vaultToken = this.configService.get<string>('VAULT_TOKEN');

    if (!vaultAddr || !vaultToken) {
      this.logger.warn(
        'VAULT_ADDR or VAULT_TOKEN not configured. ' +
          'VaultConfigService will fall back to environment variables.',
      );
      return;
    }

    try {
      this.vaultClient = vault.default({
        apiVersion: 'v1',
        endpoint: vaultAddr,
        token: vaultToken,
      }) as unknown as VaultClient;

      // Test connectivity with a lightweight read on the sys/health endpoint
      await (this.vaultClient as unknown as vault.client).health();
      this.vaultAvailable = true;
      this.logger.log(`Vault connected successfully at ${vaultAddr}`);
    } catch (error) {
      this.vaultAvailable = false;
      this.logger.warn(
        `Vault connection failed (${(error as Error).message}). ` +
          'Falling back to environment variables.',
      );
    }
  }

  /**
   * Pre-warm the secrets cache on startup.
   */
  private async warmCache(): Promise<void> {
    try {
      await this.fetchAndCacheSecrets();
      this.logger.log('Vault secrets cache warmed successfully.');
    } catch (error) {
      this.logger.warn(
        `Failed to warm Vault secrets cache: ${(error as Error).message}. ` +
          'Will fall back to env vars on next access.',
      );
    }
  }

  /**
   * Fetches all secrets from Vault and caches them.
   * Each path is fetched concurrently for performance.
   */
  private async fetchAndCacheSecrets(): Promise<ResolvedSecrets> {
    if (!this.vaultClient) {
      throw new Error('Vault client not initialized');
    }

    const [
      dbSecrets,
      redisSecrets,
      jwtSecrets,
      googleSecrets,
      blockchainSecrets,
      storageSecrets,
      paymentSecrets,
      externalSecrets,
      appSecrets,
    ] = await Promise.all([
      this.readVaultPath(VAULT_PATHS.database),
      this.readVaultPath(VAULT_PATHS.redis),
      this.readVaultPath(VAULT_PATHS.jwt),
      this.readVaultPath(VAULT_PATHS.googleOauth),
      this.readVaultPath(VAULT_PATHS.blockchain),
      this.readVaultPath(VAULT_PATHS.storage),
      this.readVaultPath(VAULT_PATHS.payment),
      this.readVaultPath(VAULT_PATHS.externalApis),
      this.readVaultPath(VAULT_PATHS.app),
    ]);

    const secrets: ResolvedSecrets = {
      // Database
      DATABASE_URL: this.resolveValue('DATABASE_URL', dbSecrets),
      DIRECT_DB_URL: this.resolveValue('DIRECT_DB_URL', dbSecrets),
      // Redis
      REDIS_URL: this.resolveValue('REDIS_URL', redisSecrets),
      // JWT
      JWT_SECRET: this.resolveValue('JWT_SECRET', jwtSecrets),
      JWT_REFRESH_SECRET: this.resolveValue('JWT_REFRESH_SECRET', jwtSecrets),
      // Google OAuth
      GOOGLE_CLIENT_ID: this.resolveValue('GOOGLE_CLIENT_ID', googleSecrets),
      GOOGLE_CLIENT_SECRET: this.resolveValue(
        'GOOGLE_CLIENT_SECRET',
        googleSecrets,
      ),
      // Blockchain — Blockfrost
      BLOCKFROST_API_KEY_PREVIEW: this.resolveValue(
        'BLOCKFROST_API_KEY_PREVIEW',
        blockchainSecrets,
      ),
      BLOCKFROST_API_KEY_PREPROD: this.resolveValue(
        'BLOCKFROST_API_KEY_PREPROD',
        blockchainSecrets,
      ),
      BLOCKFROST_API_KEY_MAINNET: this.resolveValue(
        'BLOCKFROST_API_KEY_MAINNET',
        blockchainSecrets,
      ),
      // Blockchain — Wallet
      WALLET_SECRET_KEY_PREVIEW: this.resolveValue(
        'WALLET_SECRET_KEY_PREVIEW',
        blockchainSecrets,
      ),
      WALLET_SECRET_KEY_PREPROD: this.resolveValue(
        'WALLET_SECRET_KEY_PREPROD',
        blockchainSecrets,
      ),
      WALLET_SECRET_KEY_MAINNET: this.resolveValue(
        'WALLET_SECRET_KEY_MAINNET',
        blockchainSecrets,
      ),
      // Backblaze B2 Storage
      B2_KEY_ID: this.resolveValue('B2_KEY_ID', storageSecrets),
      B2_APP_KEY: this.resolveValue('B2_APP_KEY', storageSecrets),
      // Payment
      XENDIT_API_KEY: this.resolveValue('XENDIT_API_KEY', paymentSecrets),
      XENDIT_CALLBACK_TOKEN: this.resolveValue(
        'XENDIT_CALLBACK_TOKEN',
        paymentSecrets,
      ),
      // External APIs
      GEMINI_API_KEY: this.resolveValue('GEMINI_API_KEY', externalSecrets),
      NEW_RELIC_LICENSE_KEY: this.resolveValue(
        'NEW_RELIC_LICENSE_KEY',
        externalSecrets,
      ),
      // Application
      REPORT_DOWNLOAD_SECRET: this.resolveValue(
        'REPORT_DOWNLOAD_SECRET',
        appSecrets,
      ),
      GRAFANA_ADMIN_PASSWORD: this.resolveValue(
        'GRAFANA_ADMIN_PASSWORD',
        appSecrets,
      ),
    };

    this.cache = {
      secrets,
      fetchedAt: Date.now(),
      ttlMs: this.cacheTtlMs,
    };

    return secrets;
  }

  /**
   * Reads a single KV v2 path from Vault.
   * Returns empty object on failure (not found, permission denied).
   */
  private async readVaultPath(path: string): Promise<Record<string, string>> {
    try {
      const result = await this.vaultClient!.read(path);
      return result?.data?.data ?? {};
    } catch (error) {
      const msg = (error as Error).message ?? String(error);
      // 404 = path not yet seeded — non-fatal, fall back to env
      if (msg.includes('404') || msg.includes('Not Found')) {
        this.logger.debug(
          `Vault path "${path}" not found — will use env var fallback.`,
        );
      } else {
        this.logger.warn(`Vault read error for path "${path}": ${msg}`);
      }
      return {};
    }
  }

  /**
   * Resolves a value: Vault data first, then ConfigService/env fallback.
   */
  private resolveValue(key: string, vaultData: Record<string, string>): string {
    return vaultData[key] ?? this.configService.get<string>(key) ?? '';
  }

  /**
   * Returns all resolved secrets. Uses cache if within TTL.
   * On cache miss or expiry, re-fetches from Vault (or falls back to env).
   */
  async getSecrets(): Promise<ResolvedSecrets> {
    // Serve from cache if valid
    if (this.cache && Date.now() - this.cache.fetchedAt < this.cache.ttlMs) {
      return this.cache.secrets;
    }

    if (this.vaultAvailable && this.vaultClient) {
      try {
        return await this.fetchAndCacheSecrets();
      } catch (error) {
        this.logger.warn(
          `Vault fetch failed: ${(error as Error).message}. Using env fallback.`,
        );
      }
    }

    // Full env-var fallback — build resolved secrets entirely from ConfigService
    return this.buildEnvFallback();
  }

  /**
   * Builds a ResolvedSecrets object purely from ConfigService / process.env.
   * Used when Vault is unreachable.
   */
  private buildEnvFallback(): ResolvedSecrets {
    const g = (key: string) => this.configService.get<string>(key) ?? '';

    return {
      DATABASE_URL: g('DATABASE_URL'),
      DIRECT_DB_URL: g('DIRECT_DB_URL'),
      REDIS_URL: g('REDIS_URL'),
      JWT_SECRET: g('JWT_SECRET'),
      JWT_REFRESH_SECRET: g('JWT_REFRESH_SECRET'),
      GOOGLE_CLIENT_ID: g('GOOGLE_CLIENT_ID'),
      GOOGLE_CLIENT_SECRET: g('GOOGLE_CLIENT_SECRET'),
      BLOCKFROST_API_KEY_PREVIEW: g('BLOCKFROST_API_KEY_PREVIEW'),
      BLOCKFROST_API_KEY_PREPROD: g('BLOCKFROST_API_KEY_PREPROD'),
      BLOCKFROST_API_KEY_MAINNET: g('BLOCKFROST_API_KEY_MAINNET'),
      WALLET_SECRET_KEY_PREVIEW: g('WALLET_SECRET_KEY_PREVIEW'),
      WALLET_SECRET_KEY_PREPROD: g('WALLET_SECRET_KEY_PREPROD'),
      WALLET_SECRET_KEY_MAINNET: g('WALLET_SECRET_KEY_MAINNET'),
      B2_KEY_ID: g('B2_KEY_ID'),
      B2_APP_KEY: g('B2_APP_KEY'),
      XENDIT_API_KEY: g('XENDIT_API_KEY'),
      XENDIT_CALLBACK_TOKEN: g('XENDIT_CALLBACK_TOKEN'),
      GEMINI_API_KEY: g('GEMINI_API_KEY'),
      NEW_RELIC_LICENSE_KEY: g('NEW_RELIC_LICENSE_KEY'),
      REPORT_DOWNLOAD_SECRET: g('REPORT_DOWNLOAD_SECRET'),
      GRAFANA_ADMIN_PASSWORD: g('GRAFANA_ADMIN_PASSWORD'),
    };
  }

  /**
   * Convenience method — returns a single resolved secret by key.
   * Useful for services that only need one value without importing the full
   * ResolvedSecrets interface.
   */
  async get(key: keyof ResolvedSecrets): Promise<string> {
    const secrets = await this.getSecrets();
    return secrets[key] ?? '';
  }

  /**
   * Invalidates the in-memory cache, forcing a fresh fetch on next access.
   * Useful for rotation scenarios or after manual secret updates.
   */
  invalidateCache(): void {
    this.cache = null;
    this.logger.log('Vault secrets cache invalidated.');
  }

  /** Whether Vault was successfully reached at startup. */
  isVaultAvailable(): boolean {
    return this.vaultAvailable;
  }
}
