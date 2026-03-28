/*
 * --------------------------------------------------------------------------
 * File: prisma.service.spec.ts
 * Project: car-dano-backend
 * --------------------------------------------------------------------------
 * Tests for PrismaService — constructor, lifecycle hooks, transient error
 * detection, executeWithReconnect retry logic, and cleanDatabase guard.
 * --------------------------------------------------------------------------
 */

import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';

// Mock the PrismaClient internals that PrismaService uses via `super()`
// We mock the module so PrismaClient is a no-op constructor
jest.mock('@prisma/client', () => {
  const actual = jest.requireActual('@prisma/client');

  class MockPrismaClient {
    $connect = jest.fn().mockResolvedValue(undefined);
    $disconnect = jest.fn().mockResolvedValue(undefined);
    $transaction = jest.fn().mockResolvedValue([]);
    $use = jest.fn();
    user = { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) };
  }

  return {
    ...actual,
    PrismaClient: MockPrismaClient,
  };
});

// Import AFTER the mock is declared
import { PrismaService } from './prisma.service';

function buildService(
  dbUrl = 'postgresql://localhost:5432/test',
): PrismaService {
  const configService = {
    get: jest.fn().mockReturnValue(dbUrl),
  } as unknown as ConfigService;
  return new PrismaService(configService);
}

describe('PrismaService', () => {
  // ---------------------------------------------------------------------------
  describe('constructor', () => {
    it('should be instantiated when DATABASE_URL is provided', () => {
      const service = buildService();
      expect(service).toBeDefined();
    });

    it('should register prisma tracing middleware via $use', () => {
      const service = buildService();
      const useSpy = (service as unknown as { $use: jest.Mock }).$use;

      expect(useSpy).toHaveBeenCalledTimes(1);
      expect(typeof useSpy.mock.calls[0][0]).toBe('function');
    });

    it('should throw when DATABASE_URL is missing', () => {
      const configService = {
        get: jest.fn().mockReturnValue(undefined),
      } as unknown as ConfigService;
      expect(() => new PrismaService(configService)).toThrow(
        'DATABASE_URL environment variable is not set.',
      );
    });
  });

  // ---------------------------------------------------------------------------
  describe('onModuleInit', () => {
    it('should call $connect on module init', async () => {
      const service = buildService();
      const connectSpy = jest
        .spyOn(service as any, '$connect')
        .mockResolvedValue(undefined);
      await service.onModuleInit();
      expect(connectSpy).toHaveBeenCalledTimes(1);
    });

    it('should not throw when $connect fails (logs error)', async () => {
      const service = buildService();
      jest
        .spyOn(service as any, '$connect')
        .mockRejectedValue(new Error('refused'));
      await expect(service.onModuleInit()).resolves.not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  describe('onModuleDestroy', () => {
    it('should call $disconnect on module destroy', async () => {
      const service = buildService();
      const disconnectSpy = jest
        .spyOn(service as any, '$disconnect')
        .mockResolvedValue(undefined);
      await service.onModuleDestroy();
      expect(disconnectSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  describe('executeWithReconnect', () => {
    it('should return result immediately when operation succeeds', async () => {
      const service = buildService();
      const operation = jest.fn().mockResolvedValueOnce('success');

      const result = await service.executeWithReconnect('testOp', operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry once on P1017 transient error', async () => {
      const service = buildService();
      const disconnectSpy = jest
        .spyOn(service as any, '$disconnect')
        .mockResolvedValue(undefined);
      const connectSpy = jest
        .spyOn(service as any, '$connect')
        .mockResolvedValue(undefined);

      const p1017 = new Prisma.PrismaClientKnownRequestError('Server closed', {
        code: 'P1017',
        clientVersion: '0.0.0',
      });
      const operation = jest
        .fn()
        .mockRejectedValueOnce(p1017)
        .mockResolvedValueOnce('retried');

      const result = await service.executeWithReconnect('op', operation);

      expect(result).toBe('retried');
      expect(disconnectSpy).toHaveBeenCalledTimes(1);
      expect(connectSpy).toHaveBeenCalledTimes(1);
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should retry on "server has closed the connection" message', async () => {
      const service = buildService();
      jest.spyOn(service as any, '$disconnect').mockResolvedValue(undefined);
      jest.spyOn(service as any, '$connect').mockResolvedValue(undefined);

      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('server has closed the connection'))
        .mockResolvedValueOnce(42);

      const result = await service.executeWithReconnect('op', operation);
      expect(result).toBe(42);
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should retry on "connection terminated unexpectedly" message', async () => {
      const service = buildService();
      jest.spyOn(service as any, '$disconnect').mockResolvedValue(undefined);
      jest.spyOn(service as any, '$connect').mockResolvedValue(undefined);

      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('connection terminated unexpectedly'))
        .mockResolvedValueOnce('ok');

      const result = await service.executeWithReconnect('op', operation);
      expect(result).toBe('ok');
    });

    it('should retry on "connection closed" in message', async () => {
      const service = buildService();
      jest.spyOn(service as any, '$disconnect').mockResolvedValue(undefined);
      jest.spyOn(service as any, '$connect').mockResolvedValue(undefined);

      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('connection closed by peer'))
        .mockResolvedValueOnce('done');

      const result = await service.executeWithReconnect('op', operation);
      expect(result).toBe('done');
    });

    it('should NOT retry for non-transient errors', async () => {
      const service = buildService();
      const connectSpy = jest.spyOn(service as any, '$connect');
      const permanentError = new Error('unique constraint violation');
      const operation = jest.fn().mockRejectedValueOnce(permanentError);

      await expect(
        service.executeWithReconnect('op', operation),
      ).rejects.toThrow('unique constraint violation');

      expect(operation).toHaveBeenCalledTimes(1);
      expect(connectSpy).not.toHaveBeenCalled();
    });

    it('should NOT retry for non-Error, non-PrismaClientKnownRequestError objects', async () => {
      const service = buildService();
      const strangeError = { code: 'SOMETHING' };
      const operation = jest.fn().mockRejectedValueOnce(strangeError);

      await expect(
        service.executeWithReconnect('op', operation),
      ).rejects.toEqual(strangeError);

      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should continue retry flow even if $disconnect throws during reconnect', async () => {
      const service = buildService();
      jest
        .spyOn(service as any, '$disconnect')
        .mockRejectedValue(new Error('disconnect failed'));
      jest.spyOn(service as any, '$connect').mockResolvedValue(undefined);

      const p1017 = new Prisma.PrismaClientKnownRequestError('closed', {
        code: 'P1017',
        clientVersion: '0.0.0',
      });
      const operation = jest
        .fn()
        .mockRejectedValueOnce(p1017)
        .mockResolvedValueOnce('retried');

      const result = await service.executeWithReconnect('op', operation);
      expect(result).toBe('retried');
    });
  });

  // ---------------------------------------------------------------------------
  describe('cleanDatabase', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('should return undefined (early exit) in production', async () => {
      process.env.NODE_ENV = 'production';
      const service = buildService();
      const txSpy = jest.spyOn(service as any, '$transaction');

      const result = await service.cleanDatabase();

      expect(result).toBeUndefined();
      expect(txSpy).not.toHaveBeenCalled();
    });

    it('should execute $transaction in test environment', async () => {
      process.env.NODE_ENV = 'test';
      const service = buildService();
      const txSpy = jest
        .spyOn(service as any, '$transaction')
        .mockResolvedValue([]);

      await service.cleanDatabase();

      expect(txSpy).toHaveBeenCalledTimes(1);
    });

    it('should execute $transaction in development environment', async () => {
      process.env.NODE_ENV = 'development';
      const service = buildService();
      const txSpy = jest
        .spyOn(service as any, '$transaction')
        .mockResolvedValue([]);

      await service.cleanDatabase();

      expect(txSpy).toHaveBeenCalledTimes(1);
    });
  });
});
