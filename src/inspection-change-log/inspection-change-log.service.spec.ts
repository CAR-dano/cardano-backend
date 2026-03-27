import { Test, TestingModule } from '@nestjs/testing';
import { InspectionChangeLogService } from './inspection-change-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { InspectionChangeLog } from '@prisma/client';

// ─── Mock Data ────────────────────────────────────────────────────────────────

const mockInspectionId = 'insp-001';
const mockChangeLogId = 'log-001';

const makeLog = (
  overrides: Partial<InspectionChangeLog> = {},
): InspectionChangeLog => ({
  id: mockChangeLogId,
  inspectionId: mockInspectionId,
  changedByUserId: 'user-001',
  fieldName: 'vehicleData',
  subFieldName: 'tipeKendaraan',
  subsubfieldname: null,
  oldValue: 'Avanza',
  newValue: 'Veloz',
  changedAt: new Date('2025-01-02T10:00:00Z'),
  ...overrides,
});

const mockPrismaService = {
  inspection: {
    findUnique: jest.fn(),
  },
  inspectionChangeLog: {
    findFirst: jest.fn(),
    delete: jest.fn(),
  },
};

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('InspectionChangeLogService', () => {
  let service: InspectionChangeLogService;
  let _prisma: typeof mockPrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InspectionChangeLogService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<InspectionChangeLogService>(
      InspectionChangeLogService,
    );
    _prisma = module.get<PrismaService>(PrismaService) as any;
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // findByInspectionId
  // ──────────────────────────────────────────────────────────────────────────
  describe('findByInspectionId', () => {
    it('should return unique latest change logs per field combination', async () => {
      const logs = [
        makeLog({
          id: 'log-1',
          fieldName: 'vehicleData',
          subFieldName: 'tipeKendaraan',
          newValue: 'Veloz',
          changedAt: new Date('2025-01-03'),
        }),
        makeLog({
          id: 'log-2',
          fieldName: 'vehicleData',
          subFieldName: 'tipeKendaraan',
          newValue: 'Avanza',
          changedAt: new Date('2025-01-01'),
        }),
        makeLog({
          id: 'log-3',
          fieldName: 'overallRating',
          subFieldName: null,
          newValue: 'GOOD',
          changedAt: new Date('2025-01-02'),
        }),
      ];
      mockPrismaService.inspection.findUnique.mockResolvedValue({
        id: mockInspectionId,
        changeLogs: logs,
      });

      const result = await service.findByInspectionId(mockInspectionId);

      // Should return only first occurrence per unique key (already ordered desc by DB)
      expect(result).toHaveLength(2);
      const vehicleLog = result.find((l) => l.fieldName === 'vehicleData');
      expect(vehicleLog?.newValue).toBe('Veloz'); // latest first (index 0 from desc-ordered array)
    });

    it('should return empty array when inspection has no change logs', async () => {
      mockPrismaService.inspection.findUnique.mockResolvedValue({
        id: mockInspectionId,
        changeLogs: [],
      });

      const result = await service.findByInspectionId(mockInspectionId);

      expect(result).toEqual([]);
    });

    it('should throw NotFoundException when inspection does not exist', async () => {
      mockPrismaService.inspection.findUnique.mockResolvedValue(null);

      await expect(service.findByInspectionId('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should call findUnique with include changeLogs ordered by changedAt desc', async () => {
      mockPrismaService.inspection.findUnique.mockResolvedValue({
        id: mockInspectionId,
        changeLogs: [],
      });

      await service.findByInspectionId(mockInspectionId);

      expect(mockPrismaService.inspection.findUnique).toHaveBeenCalledWith({
        where: { id: mockInspectionId },
        include: {
          changeLogs: {
            orderBy: { changedAt: 'desc' },
          },
        },
      });
    });

    it('should deduplicate logs with same fieldName-subFieldName-subsubfieldname key', async () => {
      const logs = [
        makeLog({
          id: 'log-1',
          fieldName: 'f',
          subFieldName: 's',
          subsubfieldname: 'ss',
          changedAt: new Date('2025-01-05'),
        }),
        makeLog({
          id: 'log-2',
          fieldName: 'f',
          subFieldName: 's',
          subsubfieldname: 'ss',
          changedAt: new Date('2025-01-01'),
        }),
        makeLog({
          id: 'log-3',
          fieldName: 'f',
          subFieldName: 's',
          subsubfieldname: 'ss',
          changedAt: new Date('2025-01-03'),
        }),
      ];
      mockPrismaService.inspection.findUnique.mockResolvedValue({
        id: mockInspectionId,
        changeLogs: logs,
      });

      const result = await service.findByInspectionId(mockInspectionId);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('log-1');
    });

    it('should keep separate logs for different field keys', async () => {
      const logs = [
        makeLog({
          id: 'log-1',
          fieldName: 'field1',
          subFieldName: null,
          subsubfieldname: null,
        }),
        makeLog({
          id: 'log-2',
          fieldName: 'field2',
          subFieldName: null,
          subsubfieldname: null,
        }),
        makeLog({
          id: 'log-3',
          fieldName: 'field3',
          subFieldName: null,
          subsubfieldname: null,
        }),
      ];
      mockPrismaService.inspection.findUnique.mockResolvedValue({
        id: mockInspectionId,
        changeLogs: logs,
      });

      const result = await service.findByInspectionId(mockInspectionId);

      expect(result).toHaveLength(3);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // remove
  // ──────────────────────────────────────────────────────────────────────────
  describe('remove', () => {
    it('should delete and return the change log', async () => {
      const log = makeLog();
      mockPrismaService.inspectionChangeLog.findFirst.mockResolvedValue(log);
      mockPrismaService.inspectionChangeLog.delete.mockResolvedValue(log);

      const result = await service.remove(mockInspectionId, mockChangeLogId);

      expect(result).toEqual(log);
      expect(mockPrismaService.inspectionChangeLog.delete).toHaveBeenCalledWith(
        {
          where: { id: mockChangeLogId },
        },
      );
    });

    it('should search for change log belonging to the correct inspection', async () => {
      const log = makeLog();
      mockPrismaService.inspectionChangeLog.findFirst.mockResolvedValue(log);
      mockPrismaService.inspectionChangeLog.delete.mockResolvedValue(log);

      await service.remove(mockInspectionId, mockChangeLogId);

      expect(
        mockPrismaService.inspectionChangeLog.findFirst,
      ).toHaveBeenCalledWith({
        where: {
          id: mockChangeLogId,
          inspectionId: mockInspectionId,
        },
      });
    });

    it('should throw NotFoundException when change log not found', async () => {
      mockPrismaService.inspectionChangeLog.findFirst.mockResolvedValue(null);

      await expect(
        service.remove(mockInspectionId, 'bad-log-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when change log belongs to different inspection', async () => {
      mockPrismaService.inspectionChangeLog.findFirst.mockResolvedValue(null);

      await expect(
        service.remove('other-inspection', mockChangeLogId),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
