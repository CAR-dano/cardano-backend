/*
 * --------------------------------------------------------------------------
 * File: inspection-change-log.controller.spec.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Unit tests for InspectionChangeLogController
 * --------------------------------------------------------------------------
 */

import { Test, TestingModule } from '@nestjs/testing';
import { InspectionChangeLogController } from './inspection-change-log.controller';
import { InspectionChangeLogService } from './inspection-change-log.service';
import { NotFoundException } from '@nestjs/common';
import { InspectionChangeLog } from '@prisma/client';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeLog = (overrides: Partial<InspectionChangeLog> = {}): InspectionChangeLog => ({
  id: 'log-001',
  inspectionId: 'insp-001',
  changedByUserId: 'user-001',
  fieldName: 'vehicleData',
  subFieldName: 'tipeKendaraan',
  subsubfieldname: null,
  oldValue: 'Avanza',
  newValue: 'Veloz',
  changedAt: new Date('2025-01-02T10:00:00Z'),
  ...overrides,
});

const mockInspectionChangeLogService = {
  findByInspectionId: jest.fn(),
  remove: jest.fn(),
};

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('InspectionChangeLogController', () => {
  let controller: InspectionChangeLogController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InspectionChangeLogController],
      providers: [
        {
          provide: InspectionChangeLogService,
          useValue: mockInspectionChangeLogService,
        },
      ],
    }).compile();

    controller = module.get<InspectionChangeLogController>(InspectionChangeLogController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // -------------------------------------------------------------------------
  describe('findByInspectionId', () => {
    it('should return change logs for a given inspection', async () => {
      const logs = [makeLog(), makeLog({ id: 'log-002', fieldName: 'overallRating' })];
      mockInspectionChangeLogService.findByInspectionId.mockResolvedValue(logs);

      const result = await controller.findByInspectionId('insp-001');

      expect(mockInspectionChangeLogService.findByInspectionId).toHaveBeenCalledWith('insp-001');
      expect(result).toEqual(logs);
    });

    it('should return empty array when no change logs exist', async () => {
      mockInspectionChangeLogService.findByInspectionId.mockResolvedValue([]);

      const result = await controller.findByInspectionId('insp-001');

      expect(result).toEqual([]);
    });

    it('should throw NotFoundException when inspection not found', async () => {
      mockInspectionChangeLogService.findByInspectionId.mockRejectedValue(
        new NotFoundException('Inspection not found'),
      );

      await expect(controller.findByInspectionId('missing-id')).rejects.toThrow(NotFoundException);
    });

    it('should pass the inspectionId directly to the service', async () => {
      mockInspectionChangeLogService.findByInspectionId.mockResolvedValue([]);

      await controller.findByInspectionId('test-insp-id');

      expect(mockInspectionChangeLogService.findByInspectionId).toHaveBeenCalledWith('test-insp-id');
    });
  });

  // -------------------------------------------------------------------------
  describe('remove', () => {
    it('should delete a change log entry and return void', async () => {
      const log = makeLog();
      mockInspectionChangeLogService.remove.mockResolvedValue(log);

      await controller.remove('insp-001', 'log-001');

      expect(mockInspectionChangeLogService.remove).toHaveBeenCalledWith('insp-001', 'log-001');
    });

    it('should throw NotFoundException when change log not found', async () => {
      mockInspectionChangeLogService.remove.mockRejectedValue(
        new NotFoundException('Change log not found'),
      );

      await expect(controller.remove('insp-001', 'missing-log')).rejects.toThrow(NotFoundException);
    });

    it('should pass both inspectionId and changeLogId to service', async () => {
      mockInspectionChangeLogService.remove.mockResolvedValue(makeLog());

      await controller.remove('insp-xyz', 'log-xyz');

      expect(mockInspectionChangeLogService.remove).toHaveBeenCalledWith('insp-xyz', 'log-xyz');
    });

    it('should return undefined (void) on successful delete', async () => {
      mockInspectionChangeLogService.remove.mockResolvedValue(makeLog());

      const result = await controller.remove('insp-001', 'log-001');

      expect(result).toBeUndefined();
    });
  });
});
