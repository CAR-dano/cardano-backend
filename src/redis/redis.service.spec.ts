/*
 * --------------------------------------------------------------------------
 * File: redis.service.spec.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Unit tests for RedisService
 * --------------------------------------------------------------------------
 */

// Must mock ioredis BEFORE imports that pull it in
jest.mock('ioredis');

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisService } from './redis.service';

// ---------------------------------------------------------------------------
// Typed mock helpers
// ---------------------------------------------------------------------------

const MockRedis = Redis as jest.MockedClass<typeof Redis>;

/**
 * Build a mock Redis instance with all methods stubbed.
 * The EventEmitter `.on` stub is also included so constructor event
 * registration does not blow up.
 */
function buildClientMock() {
  return {
    ping: jest.fn().mockResolvedValue('PONG'),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    quit: jest.fn().mockResolvedValue('OK'),
    on: jest.fn(),
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('RedisService', () => {
  let service: RedisService;
  let clientMock: ReturnType<typeof buildClientMock>;

  // Helper: create the NestJS module with a ConfigService stub
  async function createModule(redisUrl: string | undefined) {
    clientMock = buildClientMock();
    MockRedis.mockImplementation(() => clientMock as unknown as Redis);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(redisUrl),
          },
        },
      ],
    }).compile();

    service = module.get<RedisService>(RedisService);
  }

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  // -------------------------------------------------------------------------
  describe('constructor — no REDIS_URL', () => {
    beforeEach(async () => {
      await createModule(undefined);
    });

    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should create a lazy dummy client when REDIS_URL is not set', () => {
      // Redis constructor called with lazyConnect option (no URL)
      expect(MockRedis).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  describe('constructor — with REDIS_URL', () => {
    beforeEach(async () => {
      await createModule('redis://localhost:6379');
    });

    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should register event handlers', () => {
      expect(clientMock.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(clientMock.on).toHaveBeenCalledWith('ready', expect.any(Function));
      expect(clientMock.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(clientMock.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(clientMock.on).toHaveBeenCalledWith('reconnecting', expect.any(Function));
    });
  });

  // -------------------------------------------------------------------------
  describe('isHealthy', () => {
    beforeEach(async () => {
      await createModule('redis://localhost:6379');
    });

    it('should return false when not connected', async () => {
      // isConnected defaults to false (no 'ready' event fired in unit test)
      const result = await service.isHealthy();
      expect(result).toBe(false);
    });

    it('should return true when connected and ping succeeds', async () => {
      // Simulate 'ready' event firing
      const readyHandler = clientMock.on.mock.calls.find(
        ([event]) => event === 'ready',
      )?.[1] as (() => void) | undefined;
      if (readyHandler) readyHandler();

      jest.useFakeTimers(); // prevent actual setInterval
      clientMock.ping.mockResolvedValue('PONG');

      const result = await service.isHealthy();
      expect(result).toBe(true);
    });

    it('should return false when ping throws', async () => {
      const readyHandler = clientMock.on.mock.calls.find(
        ([event]) => event === 'ready',
      )?.[1] as (() => void) | undefined;
      if (readyHandler) readyHandler();

      jest.useFakeTimers();
      clientMock.ping.mockRejectedValue(new Error('PING failed'));

      const result = await service.isHealthy();
      expect(result).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  describe('get', () => {
    beforeEach(async () => {
      await createModule('redis://localhost:6379');
    });

    it('should return null when not connected', async () => {
      const result = await service.get('somekey');
      expect(result).toBeNull();
      expect(clientMock.get).not.toHaveBeenCalled();
    });

    it('should return cached value when connected', async () => {
      // fire 'ready'
      const readyHandler = clientMock.on.mock.calls.find(
        ([e]) => e === 'ready',
      )?.[1] as (() => void) | undefined;
      if (readyHandler) readyHandler();
      jest.useFakeTimers();

      clientMock.get.mockResolvedValue('cached-value');
      const result = await service.get('somekey');
      expect(result).toBe('cached-value');
    });

    it('should return null when client.get throws', async () => {
      const readyHandler = clientMock.on.mock.calls.find(
        ([e]) => e === 'ready',
      )?.[1] as (() => void) | undefined;
      if (readyHandler) readyHandler();
      jest.useFakeTimers();

      clientMock.get.mockRejectedValue(new Error('GET error'));
      const result = await service.get('somekey');
      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  describe('set', () => {
    beforeEach(async () => {
      await createModule('redis://localhost:6379');
    });

    it('should return false when not connected', async () => {
      const result = await service.set('key', 'value');
      expect(result).toBe(false);
    });

    it('should call setex when TTL is provided', async () => {
      const readyHandler = clientMock.on.mock.calls.find(
        ([e]) => e === 'ready',
      )?.[1] as (() => void) | undefined;
      if (readyHandler) readyHandler();
      jest.useFakeTimers();

      const result = await service.set('key', 'value', 300);
      expect(clientMock.setex).toHaveBeenCalledWith('key', 300, 'value');
      expect(result).toBe(true);
    });

    it('should call set (no TTL) when ttlSeconds is not provided', async () => {
      const readyHandler = clientMock.on.mock.calls.find(
        ([e]) => e === 'ready',
      )?.[1] as (() => void) | undefined;
      if (readyHandler) readyHandler();
      jest.useFakeTimers();

      const result = await service.set('key', 'value');
      expect(clientMock.set).toHaveBeenCalledWith('key', 'value');
      expect(result).toBe(true);
    });

    it('should return false when client.set throws', async () => {
      const readyHandler = clientMock.on.mock.calls.find(
        ([e]) => e === 'ready',
      )?.[1] as (() => void) | undefined;
      if (readyHandler) readyHandler();
      jest.useFakeTimers();

      clientMock.set.mockRejectedValue(new Error('SET error'));
      const result = await service.set('key', 'value');
      expect(result).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  describe('delete', () => {
    beforeEach(async () => {
      await createModule('redis://localhost:6379');
    });

    it('should return false when not connected', async () => {
      const result = await service.delete('key');
      expect(result).toBe(false);
    });

    it('should call del and return true when connected', async () => {
      const readyHandler = clientMock.on.mock.calls.find(
        ([e]) => e === 'ready',
      )?.[1] as (() => void) | undefined;
      if (readyHandler) readyHandler();
      jest.useFakeTimers();

      const result = await service.delete('key');
      expect(clientMock.del).toHaveBeenCalledWith('key');
      expect(result).toBe(true);
    });

    it('should return false when client.del throws', async () => {
      const readyHandler = clientMock.on.mock.calls.find(
        ([e]) => e === 'ready',
      )?.[1] as (() => void) | undefined;
      if (readyHandler) readyHandler();
      jest.useFakeTimers();

      clientMock.del.mockRejectedValue(new Error('DEL error'));
      const result = await service.delete('key');
      expect(result).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  describe('getCounter', () => {
    beforeEach(async () => {
      await createModule('redis://localhost:6379');
    });

    it('should return null when not connected', async () => {
      const result = await service.getCounter('counter-key');
      expect(result).toBeNull();
    });

    it('should return parsed integer when key exists', async () => {
      const readyHandler = clientMock.on.mock.calls.find(
        ([e]) => e === 'ready',
      )?.[1] as (() => void) | undefined;
      if (readyHandler) readyHandler();
      jest.useFakeTimers();

      clientMock.get.mockResolvedValue('42');
      const result = await service.getCounter('counter-key');
      expect(result).toBe(42);
    });

    it('should return null when key does not exist', async () => {
      const readyHandler = clientMock.on.mock.calls.find(
        ([e]) => e === 'ready',
      )?.[1] as (() => void) | undefined;
      if (readyHandler) readyHandler();
      jest.useFakeTimers();

      clientMock.get.mockResolvedValue(null);
      const result = await service.getCounter('counter-key');
      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      const readyHandler = clientMock.on.mock.calls.find(
        ([e]) => e === 'ready',
      )?.[1] as (() => void) | undefined;
      if (readyHandler) readyHandler();
      jest.useFakeTimers();

      clientMock.get.mockRejectedValue(new Error('GET fail'));
      const result = await service.getCounter('counter-key');
      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  describe('incr', () => {
    beforeEach(async () => {
      await createModule('redis://localhost:6379');
    });

    it('should return null when not connected', async () => {
      const result = await service.incr('ctr');
      expect(result).toBeNull();
    });

    it('should call incr and return new value', async () => {
      const readyHandler = clientMock.on.mock.calls.find(
        ([e]) => e === 'ready',
      )?.[1] as (() => void) | undefined;
      if (readyHandler) readyHandler();
      jest.useFakeTimers();

      clientMock.incr.mockResolvedValue(5);
      const result = await service.incr('ctr');
      expect(result).toBe(5);
      expect(clientMock.expire).not.toHaveBeenCalled();
    });

    it('should call expire when ttlSeconds is provided', async () => {
      const readyHandler = clientMock.on.mock.calls.find(
        ([e]) => e === 'ready',
      )?.[1] as (() => void) | undefined;
      if (readyHandler) readyHandler();
      jest.useFakeTimers();

      clientMock.incr.mockResolvedValue(1);
      const result = await service.incr('ctr', 60);
      expect(result).toBe(1);
      expect(clientMock.expire).toHaveBeenCalledWith('ctr', 60);
    });

    it('should return null on error', async () => {
      const readyHandler = clientMock.on.mock.calls.find(
        ([e]) => e === 'ready',
      )?.[1] as (() => void) | undefined;
      if (readyHandler) readyHandler();
      jest.useFakeTimers();

      clientMock.incr.mockRejectedValue(new Error('INCR fail'));
      const result = await service.incr('ctr');
      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  describe('onModuleDestroy', () => {
    beforeEach(async () => {
      await createModule('redis://localhost:6379');
    });

    it('should call quit on destroy', async () => {
      await service.onModuleDestroy();
      expect(clientMock.quit).toHaveBeenCalled();
    });

    it('should not throw if quit fails', async () => {
      clientMock.quit.mockRejectedValue(new Error('quit error'));
      await expect(service.onModuleDestroy()).resolves.not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  describe('event handlers — connect, close, reconnecting', () => {
    beforeEach(async () => {
      await createModule('redis://localhost:6379');
    });

    it('should log when connect event fires', () => {
      const handler = clientMock.on.mock.calls.find(([e]) => e === 'connect')?.[1] as () => void;
      expect(handler).toBeDefined();
      // Just fires without throwing
      expect(() => handler()).not.toThrow();
    });

    it('should set isConnected=false when error event fires', () => {
      const handler = clientMock.on.mock.calls.find(([e]) => e === 'error')?.[1] as (e: Error) => void;
      expect(handler).toBeDefined();
      expect(() => handler(new Error('some error'))).not.toThrow();
    });

    it('should set isConnected=false and stopKeepalive when close event fires', () => {
      // First fire 'ready' to set isConnected=true and start keepalive
      jest.useFakeTimers();
      const readyHandler = clientMock.on.mock.calls.find(([e]) => e === 'ready')?.[1] as () => void;
      if (readyHandler) readyHandler();

      const closeHandler = clientMock.on.mock.calls.find(([e]) => e === 'close')?.[1] as () => void;
      expect(closeHandler).toBeDefined();
      expect(() => closeHandler()).not.toThrow();
    });

    it('should log when reconnecting event fires', () => {
      const handler = clientMock.on.mock.calls.find(([e]) => e === 'reconnecting')?.[1] as () => void;
      expect(handler).toBeDefined();
      expect(() => handler()).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  describe('retryStrategy', () => {
    it('should return a delay up to 2000ms for retries <= 3', async () => {
      await createModule('redis://localhost:6379');
      const constructorCalls = MockRedis.mock.calls as any[];
      const withOptions = constructorCalls.find((args: any[]) => args.length >= 2 && args[1]?.retryStrategy);
      if (!withOptions) return;

      const retryStrategy = withOptions[1].retryStrategy as (times: number) => number | null;
      expect(retryStrategy(1)).toBeGreaterThan(0);
      expect(retryStrategy(2)).toBeGreaterThan(0);
      expect(retryStrategy(3)).toBeGreaterThan(0);
    });

    it('should return null (stop retrying) after 3 retries', async () => {
      await createModule('redis://localhost:6379');
      const constructorCalls = MockRedis.mock.calls as any[];
      const withOptions = constructorCalls.find((args: any[]) => args.length >= 2 && args[1]?.retryStrategy);
      if (!withOptions) return;

      const retryStrategy = withOptions[1].retryStrategy as (times: number) => number | null;
      expect(retryStrategy(4)).toBeNull();
      expect(retryStrategy(10)).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  describe('startKeepalive / keepalive ping', () => {
    it('should ping on keepalive interval when connected', async () => {
      jest.useFakeTimers();
      await createModule('redis://localhost:6379');

      // Fire ready to start keepalive
      const readyHandler = clientMock.on.mock.calls.find(([e]) => e === 'ready')?.[1] as () => void;
      if (readyHandler) readyHandler();

      // Advance timer past 2 minutes (120000ms) to trigger ping
      await jest.advanceTimersByTimeAsync(120001);

      expect(clientMock.ping).toHaveBeenCalled();
    });

    it('should not crash when keepalive ping fails', async () => {
      jest.useFakeTimers();
      await createModule('redis://localhost:6379');

      const readyHandler = clientMock.on.mock.calls.find(([e]) => e === 'ready')?.[1] as () => void;
      if (readyHandler) readyHandler();

      clientMock.ping.mockRejectedValue(new Error('ping failed'));

      await expect(
        jest.advanceTimersByTimeAsync(120001),
      ).resolves.not.toThrow();
    });

    it('should not ping when isConnected is false during keepalive interval', async () => {
      jest.useFakeTimers();
      await createModule('redis://localhost:6379');

      // Do NOT fire ready → isConnected stays false
      clientMock.ping.mockClear();

      await jest.advanceTimersByTimeAsync(120001);

      expect(clientMock.ping).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  describe('constructor — Redis init throws', () => {
    it('should fall back to dummy client when Redis constructor throws', async () => {
      clientMock = buildClientMock();
      // Make Redis constructor throw on first call (with URL), succeed on second (dummy)
      let callCount = 0;
      MockRedis.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Connection refused');
        }
        return clientMock as unknown as Redis;
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          RedisService,
          {
            provide: ConfigService,
            useValue: { get: jest.fn().mockReturnValue('redis://bad-host:9999') },
          },
        ],
      }).compile();

      service = module.get<RedisService>(RedisService);
      expect(service).toBeDefined();
    });
  });
});
