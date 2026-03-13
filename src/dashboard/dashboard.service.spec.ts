/*
 * --------------------------------------------------------------------------
 * File: dashboard.service.spec.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Unit tests for the DashboardService.
 * --------------------------------------------------------------------------
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { InspectionStatus } from '@prisma/client';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a fresh set of mocks for each test */
function buildPrismaMock() {
  return {
    inspection: {
      groupBy: jest.fn().mockResolvedValue([]),
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
    inspectionBranchCity: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    user: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
}

function buildRedisMock() {
  return {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(true),
    delete: jest.fn().mockResolvedValue(true),
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('DashboardService', () => {
  let service: DashboardService;
  let prismaMock: ReturnType<typeof buildPrismaMock>;
  let redisMock: ReturnType<typeof buildRedisMock>;

  beforeEach(async () => {
    prismaMock = buildPrismaMock();
    redisMock = buildRedisMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RedisService, useValue: redisMock },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  afterEach(() => jest.clearAllMocks());

  // -------------------------------------------------------------------------
  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // -------------------------------------------------------------------------
  describe('getMainCounter', () => {
    const validQuery = {
      start_date: '2025-01-01',
      end_date: '2025-01-31',
      timezone: 'Asia/Jakarta',
    };

    it('should throw BadRequestException when start_date is missing', async () => {
      await expect(
        service.getMainCounter({ end_date: '2025-01-31' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when end_date is missing', async () => {
      await expect(
        service.getMainCounter({ start_date: '2025-01-01' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return cached data when cache hits', async () => {
      const cached = { totalOrders: { count: 10, changePercentage: '+0.0%' } };
      // First call: list_version, second call: actual cache key
      redisMock.get
        .mockResolvedValueOnce('2') // list_version
        .mockResolvedValueOnce(JSON.stringify(cached)); // cache hit

      const result = await service.getMainCounter(validQuery);

      expect(result).toEqual(cached);
      expect(prismaMock.inspection.groupBy).not.toHaveBeenCalled();
    });

    it('should query DB and return counter stats on cache miss', async () => {
      redisMock.get.mockResolvedValue(null); // always cache miss

      // Return NEED_REVIEW: 5, APPROVED: 3 for current period; empty for previous
      prismaMock.inspection.groupBy
        .mockResolvedValueOnce([
          { status: InspectionStatus.NEED_REVIEW, _count: { status: 5 } },
          { status: InspectionStatus.APPROVED, _count: { status: 3 } },
        ])
        .mockResolvedValueOnce([]); // previous period

      const result = await service.getMainCounter(validQuery);

      expect(result.needReview.count).toBe(5);
      expect(result.approved.count).toBe(3);
      expect(result.totalOrders.count).toBe(8);
    });

    it('should calculate change percentage correctly from 0 to positive', async () => {
      redisMock.get.mockResolvedValue(null);
      prismaMock.inspection.groupBy
        .mockResolvedValueOnce([
          { status: InspectionStatus.NEED_REVIEW, _count: { status: 4 } },
        ])
        .mockResolvedValueOnce([]); // previous = 0

      const result = await service.getMainCounter(validQuery);

      // previous = 0, current > 0 → '+100.0%'
      expect(result.needReview.changePercentage).toBe('+100.0%');
    });

    it('should cache result after DB query', async () => {
      redisMock.get.mockResolvedValue(null);
      prismaMock.inspection.groupBy.mockResolvedValue([]);

      await service.getMainCounter(validQuery);

      expect(redisMock.set).toHaveBeenCalled();
    });

    it('should continue and query DB when Redis get throws', async () => {
      // Covers the Redis get catch block (line 218)
      // First call (list_version) succeeds, second call (cache key lookup) rejects
      redisMock.get
        .mockResolvedValueOnce('1') // list_version call succeeds
        .mockRejectedValueOnce(new Error('Redis connection lost')); // cache lookup fails
      prismaMock.inspection.groupBy.mockResolvedValue([]);

      const result = await service.getMainCounter(validQuery);

      // Should still return a valid result from DB
      expect(result).toBeDefined();
      expect(prismaMock.inspection.groupBy).toHaveBeenCalled();
    });

    it('should continue and return result when Redis set throws', async () => {
      // Covers the Redis set catch block (line 263)
      redisMock.get.mockResolvedValue(null);
      redisMock.set.mockRejectedValue(new Error('Redis write failed'));
      prismaMock.inspection.groupBy.mockResolvedValue([]);

      const result = await service.getMainCounter(validQuery);

      expect(result).toBeDefined();
    });

    it('should throw BadRequestException when start_date is after end_date', async () => {
      await expect(
        service.getMainCounter({
          start_date: '2025-01-31',
          end_date: '2025-01-01',
          timezone: 'Asia/Jakarta',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // -------------------------------------------------------------------------
  describe('getOrderTrend', () => {
    const validQuery = {
      start_date: '2025-01-10',
      end_date: '2025-01-10', // same day → hourly
      timezone: 'Asia/Jakarta',
    };

    it('should throw BadRequestException when dates are missing', async () => {
      await expect(service.getOrderTrend({} as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return cached data when cache hits', async () => {
      const cached = { data: [], summary: { total_orders: 0 } };
      redisMock.get
        .mockResolvedValueOnce('1')
        .mockResolvedValueOnce(JSON.stringify(cached));

      const result = await service.getOrderTrend(validQuery);

      expect(result).toEqual(cached);
      expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
    });

    it('should return order trend with hourly granularity for same-day range', async () => {
      redisMock.get.mockResolvedValue(null);
      prismaMock.$queryRaw.mockResolvedValue([]);

      const result = await service.getOrderTrend(validQuery);

      // Same day = 12 two-hour periods
      expect(result.data).toHaveLength(12);
      expect(result.summary.total_orders).toBe(0);
    });

    it('should return order trend with daily granularity for range <= 92 days', async () => {
      redisMock.get.mockResolvedValue(null);
      prismaMock.$queryRaw.mockResolvedValue([]);

      const result = await service.getOrderTrend({
        start_date: '2025-01-01',
        end_date: '2025-01-07', // 7 days
        timezone: 'Asia/Jakarta',
      });

      expect(result.data).toHaveLength(7);
    });

    it('should return order trend with monthly granularity for range > 92 days', async () => {
      redisMock.get.mockResolvedValue(null);
      prismaMock.$queryRaw.mockResolvedValue([]);

      const result = await service.getOrderTrend({
        start_date: '2025-01-01',
        end_date: '2025-06-30', // 6 months
        timezone: 'Asia/Jakarta',
      });

      // Should have 6 monthly periods
      expect(result.data.length).toBeGreaterThanOrEqual(6);
    });

    it('should cache trend result after DB query', async () => {
      redisMock.get.mockResolvedValue(null);
      prismaMock.$queryRaw.mockResolvedValue([]);

      await service.getOrderTrend(validQuery);

      expect(redisMock.set).toHaveBeenCalled();
    });

    it('should continue and query DB when Redis get throws on getOrderTrend', async () => {
      // Covers the Redis get catch block (line 489)
      // First call (list_version) succeeds, second call (cache key lookup) rejects
      redisMock.get
        .mockResolvedValueOnce('1') // list_version call succeeds
        .mockRejectedValueOnce(new Error('Redis unavailable')); // cache lookup fails
      prismaMock.$queryRaw.mockResolvedValue([]);

      const result = await service.getOrderTrend(validQuery);

      expect(result).toBeDefined();
      expect(prismaMock.$queryRaw).toHaveBeenCalled();
    });

    it('should continue and return result when Redis set throws on getOrderTrend', async () => {
      // Covers the Redis set catch block (line 577)
      redisMock.get.mockResolvedValue(null);
      redisMock.set.mockRejectedValue(new Error('Redis write failed'));
      prismaMock.$queryRaw.mockResolvedValue([]);

      const result = await service.getOrderTrend(validQuery);

      expect(result).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  describe('getBranchDistribution', () => {
    const validQuery = {
      start_date: '2025-01-01',
      end_date: '2025-01-31',
      timezone: 'Asia/Jakarta',
    };

    it('should throw BadRequestException when dates are missing', async () => {
      await expect(service.getBranchDistribution({} as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return cached data when cache hits', async () => {
      const cached = {
        total: 0,
        totalChange: '0.0%',
        branchDistribution: [],
      };
      redisMock.get
        .mockResolvedValueOnce('1')
        .mockResolvedValueOnce(JSON.stringify(cached));

      const result = await service.getBranchDistribution(validQuery);

      expect(result).toEqual(cached);
      expect(prismaMock.inspectionBranchCity.findMany).not.toHaveBeenCalled();
    });

    it('should return branch distribution with counts and percentages', async () => {
      redisMock.get.mockResolvedValue(null);

      const branches = [
        { id: 'b1', city: 'Yogyakarta' },
        { id: 'b2', city: 'Solo' },
      ];
      prismaMock.inspectionBranchCity.findMany.mockResolvedValue(branches);

      // Current: b1=8, b2=2; previous: b1=4, b2=1
      prismaMock.inspection.groupBy
        .mockResolvedValueOnce([
          { branchCityId: 'b1', _count: { id: 8 } },
          { branchCityId: 'b2', _count: { id: 2 } },
        ])
        .mockResolvedValueOnce([
          { branchCityId: 'b1', _count: { id: 4 } },
          { branchCityId: 'b2', _count: { id: 1 } },
        ]);

      const result = await service.getBranchDistribution(validQuery);

      expect(result.total).toBe(10);
      expect(result.branchDistribution).toHaveLength(2);
      // Yogyakarta: 8/10 = 80%
      const yog = result.branchDistribution.find((b) => b.branch === 'Yogyakarta');
      expect(yog?.percentage).toBe('80.0%');
    });

    it('should handle empty branch list', async () => {
      redisMock.get.mockResolvedValue(null);
      prismaMock.inspectionBranchCity.findMany.mockResolvedValue([]);
      prismaMock.inspection.groupBy.mockResolvedValue([]);

      const result = await service.getBranchDistribution(validQuery);

      expect(result.total).toBe(0);
      expect(result.branchDistribution).toHaveLength(0);
    });

    it('should continue and query DB when Redis get throws on getBranchDistribution', async () => {
      // Covers the Redis get catch block (line 614)
      // First call (list_version) succeeds, second call (cache key lookup) rejects
      redisMock.get
        .mockResolvedValueOnce('1') // list_version call succeeds
        .mockRejectedValueOnce(new Error('Redis unavailable')); // cache lookup fails
      prismaMock.inspectionBranchCity.findMany.mockResolvedValue([]);
      prismaMock.inspection.groupBy.mockResolvedValue([]);

      const result = await service.getBranchDistribution(validQuery);

      expect(result).toBeDefined();
    });

    it('should continue and return result when Redis set throws on getBranchDistribution', async () => {
      // Covers the Redis set catch block (line 721)
      redisMock.get.mockResolvedValue(null);
      redisMock.set.mockRejectedValue(new Error('Redis write failed'));
      prismaMock.inspectionBranchCity.findMany.mockResolvedValue([]);
      prismaMock.inspection.groupBy.mockResolvedValue([]);

      const result = await service.getBranchDistribution(validQuery);

      expect(result).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  describe('getInspectorPerformance', () => {
    const validQuery = {
      start_date: '2025-01-01',
      end_date: '2025-01-31',
      timezone: 'Asia/Jakarta',
    };

    it('should throw BadRequestException when dates are missing', async () => {
      await expect(
        service.getInspectorPerformance({} as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return cached data when cache hits', async () => {
      const cached = { data: [], summary: { total: 0 } };
      redisMock.get
        .mockResolvedValueOnce('1')
        .mockResolvedValueOnce(JSON.stringify(cached));

      const result = await service.getInspectorPerformance(validQuery);

      expect(result).toEqual(cached);
    });

    it('should return inspector performance data', async () => {
      redisMock.get.mockResolvedValue(null);

      const inspectors = [
        { id: 'u1', name: 'Budi' },
      ];
      prismaMock.user.findMany.mockResolvedValue(inspectors);
      prismaMock.inspection.groupBy.mockResolvedValue([
        { inspectorId: 'u1', _count: { id: 5 } },
      ]);

      const result = await service.getInspectorPerformance(validQuery);

      expect(result.data).toHaveLength(1);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((result.data[0] as any).inspector).toBe('Budi');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((result.data[0] as any).totalInspections).toBe(5);
    });

    it('should continue and query DB when Redis get throws on getInspectorPerformance', async () => {
      // Covers the Redis get catch block (line 751)
      // First call (list_version) succeeds, second call (cache key lookup) rejects
      redisMock.get
        .mockResolvedValueOnce('1') // list_version call succeeds
        .mockRejectedValueOnce(new Error('Redis unavailable')); // cache lookup fails
      prismaMock.user.findMany.mockResolvedValue([]);
      prismaMock.inspection.groupBy.mockResolvedValue([]);

      const result = await service.getInspectorPerformance(validQuery);

      expect(result).toBeDefined();
    });

    it('should continue and return result when Redis set throws on getInspectorPerformance', async () => {
      // Covers the Redis set catch block (line 811)
      redisMock.get.mockResolvedValue(null);
      redisMock.set.mockRejectedValue(new Error('Redis write failed'));
      prismaMock.user.findMany.mockResolvedValue([]);
      prismaMock.inspection.groupBy.mockResolvedValue([]);

      const result = await service.getInspectorPerformance(validQuery);

      expect(result).toBeDefined();
    });
  });
});
