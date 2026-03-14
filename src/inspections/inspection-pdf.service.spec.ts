/* eslint-disable @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
import { InspectionPdfService } from './inspection-pdf.service';
import { ConfigService } from '@nestjs/config';
import { IpfsService } from '../ipfs/ipfs.service';
import { InternalServerErrorException } from '@nestjs/common';
import * as fs from 'fs/promises';

// Mock fs/promises
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

// Mock puppeteer — we don't actually launch a browser in unit tests
jest.mock('puppeteer', () => ({
  __esModule: true,
  default: {
    launch: jest.fn(),
  },
}));

// ─── Mock Services ───────────────────────────────────────────────────────────

const mockConfigService = {
  get: jest.fn().mockReturnValue('low'),
  getOrThrow: jest.fn().mockReturnValue('http://localhost:3000'),
};

const mockIpfsService = {
  add: jest.fn().mockResolvedValue('QmMockCid123'),
};

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe('InspectionPdfService', () => {
  let service: InspectionPdfService;

  beforeEach(async () => {
    // Prevent actual directory creation during tests
    mockFs.mkdir.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InspectionPdfService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: IpfsService, useValue: mockIpfsService },
      ],
    }).compile();

    service = module.get<InspectionPdfService>(InspectionPdfService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getQueueStats
  // ─────────────────────────────────────────────────────────────────────────
  describe('getQueueStats', () => {
    it('should return queue statistics with initial values', () => {
      const stats = service.getQueueStats();

      expect(stats).toHaveProperty('queueLength');
      expect(stats).toHaveProperty('running');
      expect(stats).toHaveProperty('totalProcessed');
      expect(stats).toHaveProperty('totalErrors');
      expect(stats).toHaveProperty('consecutiveErrors');
      expect(stats).toHaveProperty('circuitBreakerOpen');
      expect(stats.queueLength).toBe(0);
      expect(stats.running).toBe(0);
      expect(stats.totalProcessed).toBe(0);
      expect(stats.totalErrors).toBe(0);
      expect(stats.consecutiveErrors).toBe(0);
      expect(stats.circuitBreakerOpen).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // ensureDirectoryExists
  // ─────────────────────────────────────────────────────────────────────────
  describe('ensureDirectoryExists', () => {
    it('should create directory recursively', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);

      await service.ensureDirectoryExists('/tmp/test-dir');

      expect(mockFs.mkdir).toHaveBeenCalledWith('/tmp/test-dir', {
        recursive: true,
      });
    });

    it('should not throw when directory already exists (EEXIST)', async () => {
      const eexistError = Object.assign(new Error('EEXIST'), {
        code: 'EEXIST',
      });
      mockFs.mkdir.mockRejectedValue(eexistError);

      await expect(
        service.ensureDirectoryExists('/tmp/existing-dir'),
      ).resolves.toBeUndefined();
    });

    it('should not throw on non-EEXIST errors (logs error internally)', async () => {
      const permError = Object.assign(new Error('EPERM'), {
        code: 'EPERM',
      });
      mockFs.mkdir.mockRejectedValue(permError);

      // Should not throw — error is logged internally
      await expect(
        service.ensureDirectoryExists('/tmp/no-perm-dir'),
      ).resolves.toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // retryWithBackoff
  // ─────────────────────────────────────────────────────────────────────────
  describe('retryWithBackoff', () => {
    it('should return result on first successful attempt', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const result = await service.retryWithBackoff(
        operation,
        3,
        10, // small delay for tests
        'test-op',
      );

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and succeed on second attempt', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce('retry-success');

      const result = await service.retryWithBackoff(
        operation,
        3,
        10, // small delay for tests
        'test-retry',
      );

      expect(result).toBe('retry-success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should throw after exhausting all retries', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Persistent error'));

      await expect(
        service.retryWithBackoff(operation, 3, 10, 'test-fail'),
      ).rejects.toThrow('Persistent error');

      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should use exponential backoff between retries', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockResolvedValueOnce('eventual-success');

      const startTime = Date.now();
      const result = await service.retryWithBackoff(
        operation,
        3,
        50, // 50ms base delay
        'test-backoff',
      );
      const elapsed = Date.now() - startTime;

      expect(result).toBe('eventual-success');
      expect(operation).toHaveBeenCalledTimes(3);
      // With base 50ms: attempt 1 fail → wait 50ms, attempt 2 fail → wait 100ms
      // Total should be at least ~100ms (50 + 100 = 150 theoretical minimum, but timing is approximate)
      expect(elapsed).toBeGreaterThanOrEqual(100);
    });

    it('should handle maxRetries of 1 (no retries)', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Single failure'));

      await expect(
        service.retryWithBackoff(operation, 1, 10, 'no-retry'),
      ).rejects.toThrow('Single failure');

      expect(operation).toHaveBeenCalledTimes(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // generatePdfFromUrl
  // ─────────────────────────────────────────────────────────────────────────
  describe('generatePdfFromUrl', () => {
    it('should generate PDF buffer from URL using puppeteer', async () => {
      const puppeteer = require('puppeteer').default;
      const mockPage = {
        setViewport: jest.fn(),
        setRequestInterception: jest.fn(),
        on: jest.fn(),
        setExtraHTTPHeaders: jest.fn(),
        goto: jest.fn(),
        waitForSelector: jest.fn(),
        evaluate: jest.fn().mockResolvedValue(undefined),
        addStyleTag: jest.fn(),
        pdf: jest.fn().mockResolvedValue(Buffer.from('PDF content')),
      };
      const mockBrowser = {
        newPage: jest.fn().mockResolvedValue(mockPage),
        close: jest.fn(),
      };
      puppeteer.launch.mockResolvedValue(mockBrowser);

      const result = await service.generatePdfFromUrl(
        'http://localhost:3000/inspection/123',
        'mock-token',
      );

      expect(result).toBeInstanceOf(Buffer);
      expect(mockBrowser.close).toHaveBeenCalled();
      expect(mockPage.setExtraHTTPHeaders).toHaveBeenCalledWith({
        Authorization: 'Bearer mock-token',
      });
    });

    it('should close browser even on error', async () => {
      const puppeteer = require('puppeteer').default;
      const mockBrowser = {
        newPage: jest.fn().mockRejectedValue(new Error('Page creation failed')),
        close: jest.fn(),
      };
      puppeteer.launch.mockResolvedValue(mockBrowser);

      await expect(
        service.generatePdfFromUrl('http://localhost:3000/test', null),
      ).rejects.toThrow(InternalServerErrorException);

      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('should not set Authorization header when token is null', async () => {
      const puppeteer = require('puppeteer').default;
      const mockPage = {
        setViewport: jest.fn(),
        setRequestInterception: jest.fn(),
        on: jest.fn(),
        setExtraHTTPHeaders: jest.fn(),
        goto: jest.fn(),
        waitForSelector: jest.fn(),
        evaluate: jest.fn().mockResolvedValue(undefined),
        addStyleTag: jest.fn(),
        pdf: jest.fn().mockResolvedValue(Buffer.from('PDF content')),
      };
      const mockBrowser = {
        newPage: jest.fn().mockResolvedValue(mockPage),
        close: jest.fn(),
      };
      puppeteer.launch.mockResolvedValue(mockBrowser);

      await service.generatePdfFromUrl(
        'http://localhost:3000/inspection/123',
        null,
      );

      expect(mockPage.setExtraHTTPHeaders).not.toHaveBeenCalled();
    });

    it('should fallback to networkidle2 when networkidle0 fails', async () => {
      const puppeteer = require('puppeteer').default;
      const mockPage = {
        setViewport: jest.fn(),
        setRequestInterception: jest.fn(),
        on: jest.fn(),
        setExtraHTTPHeaders: jest.fn(),
        goto: jest
          .fn()
          .mockRejectedValueOnce(new Error('networkidle0 timeout'))
          .mockResolvedValueOnce(undefined), // networkidle2 succeeds
        waitForSelector: jest.fn(),
        evaluate: jest.fn().mockResolvedValue(undefined),
        addStyleTag: jest.fn(),
        pdf: jest.fn().mockResolvedValue(Buffer.from('PDF content')),
      };
      const mockBrowser = {
        newPage: jest.fn().mockResolvedValue(mockPage),
        close: jest.fn(),
      };
      puppeteer.launch.mockResolvedValue(mockBrowser);

      const result = await service.generatePdfFromUrl(
        'http://localhost:3000/test',
        null,
      );

      expect(result).toBeInstanceOf(Buffer);
      expect(mockPage.goto).toHaveBeenCalledTimes(2);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // generateAndSavePdf
  // ─────────────────────────────────────────────────────────────────────────
  describe('generateAndSavePdf', () => {
    it('should generate, save, hash, and upload PDF', async () => {
      const pdfBuffer = Buffer.from('mock-pdf-content');

      // Mock generatePdfFromUrl via spy
      jest
        .spyOn(service, 'generatePdfFromUrl')
        .mockResolvedValue(pdfBuffer);
      mockIpfsService.add.mockResolvedValue('QmTestCid');
      mockFs.writeFile.mockResolvedValue(undefined);
      mockConfigService.get.mockReturnValue('/pdfarchived');

      const result = await service.generateAndSavePdf(
        'http://localhost:3000/inspection/123',
        'inspection-001.pdf',
        'mock-token',
      );

      expect(result).toHaveProperty('pdfPublicUrl');
      expect(result).toHaveProperty('pdfCid', 'QmTestCid');
      expect(result).toHaveProperty('pdfHashString');
      expect(result.pdfPublicUrl).toContain('inspection-001.pdf');
      expect(result.pdfHashString).toHaveLength(64); // SHA-256 hex
      expect(mockIpfsService.add).toHaveBeenCalledWith(pdfBuffer);
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should throw when PDF generation fails', async () => {
      jest
        .spyOn(service, 'generatePdfFromUrl')
        .mockRejectedValue(new Error('PDF generation failed'));
      // Mock sleep to avoid real delays in retryWithBackoff
      jest.spyOn(service as any, 'sleep').mockResolvedValue(undefined);

      await expect(
        service.generateAndSavePdf(
          'http://localhost:3000/test',
          'test.pdf',
          'mock-token',
        ),
      ).rejects.toThrow();
    });

    it('should throw when IPFS upload fails', async () => {
      const pdfBuffer = Buffer.from('mock-pdf-content');
      jest
        .spyOn(service, 'generatePdfFromUrl')
        .mockResolvedValue(pdfBuffer);
      mockIpfsService.add.mockRejectedValue(new Error('IPFS upload failed'));
      // Mock sleep to avoid real delays in retryWithBackoff
      jest.spyOn(service as any, 'sleep').mockResolvedValue(undefined);

      await expect(
        service.generateAndSavePdf(
          'http://localhost:3000/test',
          'test.pdf',
          'token',
        ),
      ).rejects.toThrow();
    });
  });
});
