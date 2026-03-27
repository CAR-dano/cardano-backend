/*
 * --------------------------------------------------------------------------
 * File: dashboard.controller.spec.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Unit tests for the DashboardController.
 * --------------------------------------------------------------------------
 */

import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

const mockDashboardService = {
  getMainCounter: jest.fn(),
  getOrderTrend: jest.fn(),
  getBranchDistribution: jest.fn(),
  getInspectorPerformance: jest.fn(),
};

describe('DashboardController', () => {
  let controller: DashboardController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        {
          provide: DashboardService,
          useValue: mockDashboardService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<DashboardController>(DashboardController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // -------------------------------------------------------------------------
  describe('getMainStats', () => {
    it('should return main stats data', async () => {
      const query = { startDate: '2025-01-01', endDate: '2025-12-31' };
      const mockStats = { totalInspections: 100, pendingInspections: 10 };
      mockDashboardService.getMainCounter.mockResolvedValue(mockStats);

      const result = await controller.getMainStats(query as any);

      expect(mockDashboardService.getMainCounter).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockStats);
    });

    it('should propagate service errors', async () => {
      mockDashboardService.getMainCounter.mockRejectedValue(
        new Error('DB error'),
      );

      await expect(controller.getMainStats({} as any)).rejects.toThrow(
        'DB error',
      );
    });
  });

  // -------------------------------------------------------------------------
  describe('getOrderTrend', () => {
    it('should return order trend data', () => {
      const query = { period: 'monthly' };
      const mockTrend = [{ month: 'Jan', count: 20 }];
      mockDashboardService.getOrderTrend.mockReturnValue(mockTrend);

      const result = controller.getOrderTrend(query as any);

      expect(mockDashboardService.getOrderTrend).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockTrend);
    });

    it('should propagate service errors', () => {
      mockDashboardService.getOrderTrend.mockImplementation(() => {
        throw new Error('trend error');
      });

      expect(() => controller.getOrderTrend({} as any)).toThrow('trend error');
    });
  });

  // -------------------------------------------------------------------------
  describe('getBranchDistribution', () => {
    it('should return branch distribution data', async () => {
      const query = { startDate: '2025-01-01' };
      const mockDistribution = [
        { branchId: 'b1', city: 'Yogyakarta', count: 50 },
      ];
      mockDashboardService.getBranchDistribution.mockResolvedValue(
        mockDistribution,
      );

      const result = await controller.getBranchDistribution(query as any);

      expect(mockDashboardService.getBranchDistribution).toHaveBeenCalledWith(
        query,
      );
      expect(result).toEqual(mockDistribution);
    });

    it('should propagate service errors', async () => {
      mockDashboardService.getBranchDistribution.mockRejectedValue(
        new Error('branch error'),
      );

      await expect(controller.getBranchDistribution({} as any)).rejects.toThrow(
        'branch error',
      );
    });
  });

  // -------------------------------------------------------------------------
  describe('getInspectorPerformance', () => {
    it('should return inspector performance data', async () => {
      const query = { period: 'weekly' };
      const mockPerformance = [
        { inspector: 'Inspector A', totalInspections: 20 },
      ];
      mockDashboardService.getInspectorPerformance.mockResolvedValue(
        mockPerformance,
      );

      const result = await controller.getInspectorPerformance(query as any);

      expect(mockDashboardService.getInspectorPerformance).toHaveBeenCalledWith(
        query,
      );
      expect(result).toEqual(mockPerformance);
    });

    it('should propagate service errors', async () => {
      mockDashboardService.getInspectorPerformance.mockRejectedValue(
        new Error('perf error'),
      );

      await expect(
        controller.getInspectorPerformance({} as any),
      ).rejects.toThrow('perf error');
    });
  });
});
