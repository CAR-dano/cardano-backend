/*
 * --------------------------------------------------------------------------
 * File: metrics.service.spec.ts
 * Project: car-dano-backend
 * --------------------------------------------------------------------------
 * Tests for MetricsService — all metric increment/set/observe methods
 * and getMetrics() output.
 * --------------------------------------------------------------------------
 */

import { register } from 'prom-client';
import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(() => {
    // Clear prom-client registry before each test to avoid duplicate metric errors
    register.clear();
    service = new MetricsService();
  });

  afterAll(() => {
    register.clear();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  describe('incrementHttpRequests', () => {
    it('should increment httpRequestsTotal counter without throwing', () => {
      expect(() =>
        service.incrementHttpRequests('GET', '/api/v1/users', '200'),
      ).not.toThrow();
    });

    it('should handle multiple calls with different labels', () => {
      service.incrementHttpRequests('POST', '/api/v1/inspections', '201');
      service.incrementHttpRequests('GET', '/api/v1/inspections', '200');
      service.incrementHttpRequests('DELETE', '/api/v1/inspections/1', '404');
      // No assertion on values — just ensure no errors thrown
    });
  });

  // ---------------------------------------------------------------------------
  describe('observeHttpDuration', () => {
    it('should observe http request duration without throwing', () => {
      expect(() =>
        service.observeHttpDuration('GET', '/api/health', '200', 0.123),
      ).not.toThrow();
    });

    it('should accept zero duration', () => {
      expect(() =>
        service.observeHttpDuration('GET', '/fast', '200', 0),
      ).not.toThrow();
    });

    it('should accept large duration values', () => {
      expect(() =>
        service.observeHttpDuration('POST', '/slow', '500', 15.5),
      ).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  describe('setActiveConnections', () => {
    it('should set active connections gauge without throwing', () => {
      expect(() => service.setActiveConnections(5)).not.toThrow();
    });

    it('should set active connections to zero', () => {
      expect(() => service.setActiveConnections(0)).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  describe('setDatabaseConnections', () => {
    it('should set database connections gauge without throwing', () => {
      expect(() => service.setDatabaseConnections(3)).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  describe('incrementWalletOperation', () => {
    it('should increment wallet operations counter without throwing', () => {
      expect(() =>
        service.incrementWalletOperation('mint', 'success'),
      ).not.toThrow();
    });

    it('should handle different operation types and statuses', () => {
      service.incrementWalletOperation('transfer', 'success');
      service.incrementWalletOperation('transfer', 'failure');
      service.incrementWalletOperation('burn', 'success');
    });
  });

  // ---------------------------------------------------------------------------
  describe('setAdaTransferVolume', () => {
    it('should set ada transfer volume gauge without throwing', () => {
      expect(() => service.setAdaTransferVolume(1000000)).not.toThrow();
    });

    it('should accept zero volume', () => {
      expect(() => service.setAdaTransferVolume(0)).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  describe('setBlockchainSyncStatus', () => {
    it('should set blockchain sync status gauge without throwing', () => {
      expect(() => service.setBlockchainSyncStatus(99.5)).not.toThrow();
    });

    it('should accept 100% sync', () => {
      expect(() => service.setBlockchainSyncStatus(100)).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  describe('incrementError', () => {
    it('should increment error counter without throwing', () => {
      expect(() =>
        service.incrementError('ValidationError', '/api/v1/users'),
      ).not.toThrow();
    });

    it('should handle multiple error types', () => {
      service.incrementError('NotFoundError', '/api/v1/inspections/999');
      service.incrementError('InternalServerError', '/api/v1/blockchain');
    });
  });

  // ---------------------------------------------------------------------------
  describe('getMetrics', () => {
    it('should return a non-empty string containing metric names', async () => {
      // Increment a counter so we have something to verify
      service.incrementHttpRequests('GET', '/test', '200');
      service.setActiveConnections(2);

      const output = await service.getMetrics();

      expect(typeof output).toBe('string');
      expect(output.length).toBeGreaterThan(0);
      expect(output).toContain('http_requests_total');
      expect(output).toContain('active_connections');
    });

    it('should include all registered metric names in output', async () => {
      const output = await service.getMetrics();

      expect(output).toContain('http_request_duration_seconds');
      expect(output).toContain('database_connections_active');
      expect(output).toContain('wallet_operations_total');
      expect(output).toContain('ada_transfer_volume_lovelace');
      expect(output).toContain('blockchain_sync_percentage');
      expect(output).toContain('application_errors_total');
    });
  });
});
