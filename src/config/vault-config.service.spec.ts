/*
 * --------------------------------------------------------------------------
 * File: vault-config.service.spec.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Unit tests for VaultConfigService.
 * All Vault client calls are mocked — no real Vault server required.
 * --------------------------------------------------------------------------
 */

// ---------------------------------------------------------------------------
// Mock node-vault BEFORE any imports that pull it in.
// node-vault exports a CJS factory function directly (not via .default).
// We control the mock client via a module-scoped variable.
// ---------------------------------------------------------------------------
let mockVaultClientInstance: Record<string, jest.Mock> | null = null;

jest.mock('node-vault', () => {
  return jest.fn(() => mockVaultClientInstance);
});

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  VaultConfigService,
  ResolvedSecrets,
} from './vault-config.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a minimal ConfigService mock that returns `undefined` for all keys
 *  unless overridden via `overrides`. */
function makeConfigService(
  overrides: Record<string, string> = {},
): ConfigService {
  return {
    get: jest.fn((key: string) => overrides[key] ?? undefined),
  } as unknown as ConfigService;
}

/** Returns a mock Vault KV v2 response for a given data object. */
function vaultResponse(data: Record<string, string>) {
  return { data: { data } };
}

/** Installs the module-scoped mock client and configures path responses. */
function installMockVaultClient(
  pathData: Record<string, Record<string, string>> = {},
  healthOk = true,
) {
  mockVaultClientInstance = {
    read: jest.fn(async (path: string) => {
      if (pathData[path] !== undefined) {
        return vaultResponse(pathData[path]);
      }
      throw new Error('404 Not Found');
    }),
    health: jest.fn(async () => {
      if (!healthOk) throw new Error('connection refused');
    }),
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('VaultConfigService', () => {
  let service: VaultConfigService;
  let module: TestingModule;

  afterEach(async () => {
    await module.close();
    jest.clearAllMocks();
    mockVaultClientInstance = null;
  });

  // -------------------------------------------------------------------------
  // Scenario helpers
  // -------------------------------------------------------------------------

  async function buildService(
    configOverrides: Record<string, string> = {},
    vaultPathData: Record<string, Record<string, string>> = {},
    vaultHealthOk = true,
  ): Promise<void> {
    if (
      configOverrides.VAULT_ADDR !== undefined &&
      configOverrides.VAULT_TOKEN !== undefined
    ) {
      installMockVaultClient(vaultPathData, vaultHealthOk);
    }

    module = await Test.createTestingModule({
      providers: [
        VaultConfigService,
        {
          provide: ConfigService,
          useValue: makeConfigService(configOverrides),
        },
      ],
    }).compile();

    service = module.get<VaultConfigService>(VaultConfigService);
    await service.onModuleInit();
  }

  // =========================================================================
  // Constructor / TTL
  // =========================================================================

  describe('cacheTtlMs', () => {
    it('defaults to 300000 when VAULT_CACHE_TTL_MS is not set', async () => {
      await buildService({ VAULT_ADDR: 'http://vault:8200', VAULT_TOKEN: 'tok' });
      expect((service as unknown as { cacheTtlMs: number }).cacheTtlMs).toBe(
        300000,
      );
    });

    it('uses VAULT_CACHE_TTL_MS when provided', async () => {
      await buildService({
        VAULT_ADDR: 'http://vault:8200',
        VAULT_TOKEN: 'tok',
        VAULT_CACHE_TTL_MS: '60000',
      });
      expect((service as unknown as { cacheTtlMs: number }).cacheTtlMs).toBe(
        60000,
      );
    });

    it('falls back to 300000 when VAULT_CACHE_TTL_MS is invalid', async () => {
      await buildService({
        VAULT_ADDR: 'http://vault:8200',
        VAULT_TOKEN: 'tok',
        VAULT_CACHE_TTL_MS: 'not-a-number',
      });
      expect((service as unknown as { cacheTtlMs: number }).cacheTtlMs).toBe(
        300000,
      );
    });
  });

  // =========================================================================
  // Vault unavailable (no VAULT_ADDR/VAULT_TOKEN)
  // =========================================================================

  describe('when Vault credentials are not configured', () => {
    beforeEach(async () => {
      await buildService({
        JWT_SECRET: 'env-jwt-secret',
        DATABASE_URL: 'postgres://env-db',
      });
    });

    it('should report Vault as unavailable', () => {
      expect(service.isVaultAvailable()).toBe(false);
    });

    it('returns secrets from env fallback', async () => {
      const secrets = await service.getSecrets();
      expect(secrets.JWT_SECRET).toBe('env-jwt-secret');
      expect(secrets.DATABASE_URL).toBe('postgres://env-db');
    });

    it('returns empty string for unknown keys in env fallback', async () => {
      const secrets = await service.getSecrets();
      expect(secrets.GEMINI_API_KEY).toBe('');
    });
  });

  // =========================================================================
  // Vault connection failure
  // =========================================================================

  describe('when Vault health check fails', () => {
    beforeEach(async () => {
      await buildService(
        {
          VAULT_ADDR: 'http://vault:8200',
          VAULT_TOKEN: 'tok',
          REDIS_URL: 'redis://env-redis',
        },
        {},
        false, // healthOk = false
      );
    });

    it('should report Vault as unavailable', () => {
      expect(service.isVaultAvailable()).toBe(false);
    });

    it('falls back to env vars', async () => {
      const secrets = await service.getSecrets();
      expect(secrets.REDIS_URL).toBe('redis://env-redis');
    });
  });

  // =========================================================================
  // Vault available — full path resolution
  // =========================================================================

  describe('when Vault is available and all paths are populated', () => {
    const vaultData: Record<string, Record<string, string>> = {
      'secret/data/cardano-backend/database': {
        DATABASE_URL: 'postgres://vault-db',
        DIRECT_DB_URL: 'postgres://vault-direct-db',
      },
      'secret/data/cardano-backend/redis': {
        REDIS_URL: 'redis://:vault-redis-pass@redis:6379',
      },
      'secret/data/cardano-backend/jwt': {
        JWT_SECRET: 'vault-jwt-secret',
        JWT_REFRESH_SECRET: 'vault-refresh-secret',
      },
      'secret/data/cardano-backend/google-oauth': {
        GOOGLE_CLIENT_ID: 'vault-client-id',
        GOOGLE_CLIENT_SECRET: 'vault-client-secret',
      },
      'secret/data/cardano-backend/blockchain': {
        BLOCKFROST_API_KEY_PREVIEW: 'vault-bf-preview',
        BLOCKFROST_API_KEY_PREPROD: 'vault-bf-preprod',
        BLOCKFROST_API_KEY_MAINNET: 'vault-bf-mainnet',
        WALLET_SECRET_KEY_PREVIEW: 'vault-wallet-preview',
        WALLET_SECRET_KEY_PREPROD: 'vault-wallet-preprod',
        WALLET_SECRET_KEY_MAINNET: 'vault-wallet-mainnet',
      },
      'secret/data/cardano-backend/storage': {
        B2_KEY_ID: 'vault-b2-key-id',
        B2_APP_KEY: 'vault-b2-app-key',
      },
      'secret/data/cardano-backend/payment': {
        XENDIT_API_KEY: 'vault-xendit-key',
        XENDIT_CALLBACK_TOKEN: 'vault-xendit-token',
      },
      'secret/data/cardano-backend/external-apis': {
        GEMINI_API_KEY: 'vault-gemini-key',
        NEW_RELIC_LICENSE_KEY: 'vault-nr-key',
      },
      'secret/data/cardano-backend/app': {
        REPORT_DOWNLOAD_SECRET: 'vault-report-secret',
        GRAFANA_ADMIN_PASSWORD: 'vault-grafana-pass',
      },
    };

    beforeEach(async () => {
      await buildService(
        { VAULT_ADDR: 'http://vault:8200', VAULT_TOKEN: 'tok' },
        vaultData,
      );
    });

    it('should report Vault as available', () => {
      expect(service.isVaultAvailable()).toBe(true);
    });

    it('returns DATABASE_URL from Vault', async () => {
      const secrets = await service.getSecrets();
      expect(secrets.DATABASE_URL).toBe('postgres://vault-db');
    });

    it('returns JWT_SECRET from Vault', async () => {
      const secrets = await service.getSecrets();
      expect(secrets.JWT_SECRET).toBe('vault-jwt-secret');
    });

    it('returns all blockchain secrets from Vault', async () => {
      const secrets = await service.getSecrets();
      expect(secrets.BLOCKFROST_API_KEY_MAINNET).toBe('vault-bf-mainnet');
      expect(secrets.WALLET_SECRET_KEY_MAINNET).toBe('vault-wallet-mainnet');
    });

    it('returns payment secrets from Vault', async () => {
      const secrets = await service.getSecrets();
      expect(secrets.XENDIT_API_KEY).toBe('vault-xendit-key');
      expect(secrets.XENDIT_CALLBACK_TOKEN).toBe('vault-xendit-token');
    });

    it('returns all 21 expected keys with non-empty values', async () => {
      const secrets = await service.getSecrets();
      const keys: (keyof ResolvedSecrets)[] = [
        'DATABASE_URL', 'DIRECT_DB_URL', 'REDIS_URL',
        'JWT_SECRET', 'JWT_REFRESH_SECRET',
        'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET',
        'BLOCKFROST_API_KEY_PREVIEW', 'BLOCKFROST_API_KEY_PREPROD', 'BLOCKFROST_API_KEY_MAINNET',
        'WALLET_SECRET_KEY_PREVIEW', 'WALLET_SECRET_KEY_PREPROD', 'WALLET_SECRET_KEY_MAINNET',
        'B2_KEY_ID', 'B2_APP_KEY',
        'XENDIT_API_KEY', 'XENDIT_CALLBACK_TOKEN',
        'GEMINI_API_KEY', 'NEW_RELIC_LICENSE_KEY',
        'REPORT_DOWNLOAD_SECRET', 'GRAFANA_ADMIN_PASSWORD',
      ];
      for (const key of keys) {
        expect(secrets[key]).toBeTruthy();
      }
    });
  });

  // =========================================================================
  // Vault available — partial paths (env fallback for missing keys)
  // =========================================================================

  describe('when Vault has some paths missing', () => {
    beforeEach(async () => {
      await buildService(
        {
          VAULT_ADDR: 'http://vault:8200',
          VAULT_TOKEN: 'tok',
          JWT_SECRET: 'env-fallback-jwt',
        },
        {
          'secret/data/cardano-backend/database': {
            DATABASE_URL: 'postgres://vault-db',
            DIRECT_DB_URL: 'postgres://vault-direct-db',
          },
          // All other paths will 404 → per-path env fallback
        },
      );
    });

    it('uses Vault value for DATABASE_URL', async () => {
      const secrets = await service.getSecrets();
      expect(secrets.DATABASE_URL).toBe('postgres://vault-db');
    });

    it('falls back to env for JWT_SECRET when Vault path is missing', async () => {
      const secrets = await service.getSecrets();
      expect(secrets.JWT_SECRET).toBe('env-fallback-jwt');
    });
  });

  // =========================================================================
  // get() convenience method
  // =========================================================================

  describe('get()', () => {
    beforeEach(async () => {
      await buildService(
        { VAULT_ADDR: 'http://vault:8200', VAULT_TOKEN: 'tok' },
        {
          'secret/data/cardano-backend/jwt': { JWT_SECRET: 'vault-single-jwt' },
        },
      );
    });

    it('returns a single secret by key', async () => {
      expect(await service.get('JWT_SECRET')).toBe('vault-single-jwt');
    });

    it('returns empty string for missing key', async () => {
      expect(await service.get('GEMINI_API_KEY')).toBe('');
    });
  });

  // =========================================================================
  // Cache behaviour
  // =========================================================================

  describe('caching', () => {
    beforeEach(async () => {
      await buildService(
        { VAULT_ADDR: 'http://vault:8200', VAULT_TOKEN: 'tok' },
        {
          'secret/data/cardano-backend/jwt': { JWT_SECRET: 'cached-jwt' },
        },
      );
    });

    it('serves subsequent calls from cache without re-fetching Vault', async () => {
      await service.getSecrets(); // first call — already warmed by onModuleInit
      const callCountAfterFirst = (mockVaultClientInstance!.read as jest.Mock).mock.calls.length;
      await service.getSecrets(); // second call — should hit cache
      const callCountAfterSecond = (mockVaultClientInstance!.read as jest.Mock).mock.calls.length;
      expect(callCountAfterSecond).toBe(callCountAfterFirst);
    });

    it('re-fetches after invalidateCache()', async () => {
      await service.getSecrets(); // prime cache
      const callsBefore = (mockVaultClientInstance!.read as jest.Mock).mock.calls.length;

      service.invalidateCache();
      await service.getSecrets(); // should fetch again
      const callsAfter = (mockVaultClientInstance!.read as jest.Mock).mock.calls.length;
      expect(callsAfter).toBeGreaterThan(callsBefore);
    });

    it('invalidateCache() sets cache to null', () => {
      service.invalidateCache();
      expect(
        (service as unknown as { cache: unknown }).cache,
      ).toBeNull();
    });
  });

  // =========================================================================
  // isVaultAvailable()
  // =========================================================================

  describe('isVaultAvailable()', () => {
    it('returns false before init when credentials missing', async () => {
      await buildService({});
      expect(service.isVaultAvailable()).toBe(false);
    });

    it('returns true when Vault health check passes', async () => {
      await buildService(
        { VAULT_ADDR: 'http://vault:8200', VAULT_TOKEN: 'tok' },
        {},
        true,
      );
      expect(service.isVaultAvailable()).toBe(true);
    });

    it('returns false when Vault health check fails', async () => {
      await buildService(
        { VAULT_ADDR: 'http://vault:8200', VAULT_TOKEN: 'tok' },
        {},
        false,
      );
      expect(service.isVaultAvailable()).toBe(false);
    });
  });

  // =========================================================================
  // buildEnvFallback — full env-only scenario
  // =========================================================================

  describe('buildEnvFallback via getSecrets()', () => {
    const envSecrets: Record<string, string> = {
      DATABASE_URL: 'pg://env',
      DIRECT_DB_URL: 'pg://env-direct',
      REDIS_URL: 'redis://env',
      JWT_SECRET: 'env-jwt',
      JWT_REFRESH_SECRET: 'env-refresh',
      GOOGLE_CLIENT_ID: 'env-client-id',
      GOOGLE_CLIENT_SECRET: 'env-client-secret',
      BLOCKFROST_API_KEY_PREVIEW: 'env-bf-preview',
      BLOCKFROST_API_KEY_PREPROD: 'env-bf-preprod',
      BLOCKFROST_API_KEY_MAINNET: 'env-bf-mainnet',
      WALLET_SECRET_KEY_PREVIEW: 'env-wallet-preview',
      WALLET_SECRET_KEY_PREPROD: 'env-wallet-preprod',
      WALLET_SECRET_KEY_MAINNET: 'env-wallet-mainnet',
      B2_KEY_ID: 'env-b2-key',
      B2_APP_KEY: 'env-b2-app',
      XENDIT_API_KEY: 'env-xendit',
      XENDIT_CALLBACK_TOKEN: 'env-xendit-token',
      GEMINI_API_KEY: 'env-gemini',
      NEW_RELIC_LICENSE_KEY: 'env-nr',
      REPORT_DOWNLOAD_SECRET: 'env-report',
      GRAFANA_ADMIN_PASSWORD: 'env-grafana',
    };

    beforeEach(async () => {
      await buildService(envSecrets); // no VAULT_ADDR = env-only
    });

    it('resolves all 21 keys from environment', async () => {
      const secrets = await service.getSecrets();
      for (const [key, val] of Object.entries(envSecrets)) {
        expect(secrets[key as keyof ResolvedSecrets]).toBe(val);
      }
    });
  });
});
