/*
 * --------------------------------------------------------------------------
 * File: metrics.controller.spec.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Unit tests for the MetricsController.
 * --------------------------------------------------------------------------
 */

import { Test, TestingModule } from '@nestjs/testing';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { ThrottlerGuard } from '@nestjs/throttler';

const mockMetricsService = {
  getMetrics: jest.fn(),
};

describe('MetricsController', () => {
  let controller: MetricsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetricsController],
      providers: [
        { provide: MetricsService, useValue: mockMetricsService },
      ],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<MetricsController>(MetricsController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getMetrics', () => {
    it('should return prometheus metrics string', async () => {
      const mockMetricsOutput = `# HELP process_cpu_user_seconds_total Total user CPU time spent in seconds.
# TYPE process_cpu_user_seconds_total counter
process_cpu_user_seconds_total 0.5`;
      mockMetricsService.getMetrics.mockResolvedValue(mockMetricsOutput);

      const result = await controller.getMetrics();

      expect(mockMetricsService.getMetrics).toHaveBeenCalled();
      expect(result).toBe(mockMetricsOutput);
    });

    it('should propagate errors from metricsService', async () => {
      mockMetricsService.getMetrics.mockRejectedValue(new Error('Registry error'));

      await expect(controller.getMetrics()).rejects.toThrow('Registry error');
    });
  });
});
