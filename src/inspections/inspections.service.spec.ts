/* eslint-disable @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
import { InspectionsService } from './inspections.service';
import { PrismaService } from '../prisma/prisma.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { ConfigService } from '@nestjs/config';
import { IpfsService } from '../ipfs/ipfs.service';
import { RedisService } from '../redis/redis.service';
import {
  Inspection,
  InspectionChangeLog,
  InspectionStatus,
  Prisma,
  Role,
} from '@prisma/client';
import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

// ─── Shared Mock Data ───────────────────────────────────────────────────────

const mockInspectionId = 'mock-inspection-id';
const mockReviewerId = 'mock-reviewer-id';
const mockInspectorId = 'mock-inspector-id';
const mockToken = 'mock-jwt-token';

const mockInspection = {
  id: mockInspectionId,
  pretty_id: 'YOG-13082025-001',
  inspectorId: mockInspectorId,
  reviewerId: null,
  branchCityId: 'mock-branch-id',
  vehiclePlateNumber: 'AB 1234 CD',
  inspectionDate: new Date('2025-08-13'),
  overallRating: 'GOOD',
  status: InspectionStatus.NEED_REVIEW,
  identityDetails: {
    namaInspektor: 'Mock Inspector',
    namaCustomer: 'Mock Customer',
    cabangInspeksi: 'Yogyakarta',
  } as Prisma.JsonObject,
  vehicleData: {
    merekKendaraan: 'Toyota',
    tipeKendaraan: 'Avanza',
  } as Prisma.JsonObject,
  equipmentChecklist: {} as Prisma.JsonObject,
  inspectionSummary: {} as Prisma.JsonObject,
  detailedAssessment: {} as Prisma.JsonObject,
  bodyPaintThickness: {} as Prisma.JsonObject,
  notesFontSizes: {} as Prisma.JsonObject,
  urlPdf: null,
  pdfFileHash: null,
  ipfsPdf: null,
  urlPdfNoDocs: null,
  pdfFileHashNoDocs: null,
  ipfsPdfNoDocs: null,
  blockchainTxHash: null,
  nftAssetId: null,
  createdAt: new Date('2025-08-13T10:00:00.000Z'),
  updatedAt: new Date('2025-08-13T10:00:00.000Z'),
  archivedAt: null,
  deactivatedAt: null,
} as unknown as Inspection;

const mockArchivedInspection = {
  ...mockInspection,
  id: 'mock-archived-id',
  status: InspectionStatus.ARCHIVED,
  urlPdf: '/pdf/mock.pdf',
  pdfFileHash: 'abc123',
} as unknown as Inspection;

const mockChangeLogs: InspectionChangeLog[] = [
  {
    id: '1',
    inspectionId: mockInspectionId,
    changedByUserId: mockReviewerId,
    fieldName: 'vehicleData',
    subFieldName: 'tipeKendaraan',
    subsubfieldname: null,
    oldValue: 'Avanza',
    newValue: 'Veloz',
    changedAt: new Date(),
  },
  {
    id: '2',
    inspectionId: mockInspectionId,
    changedByUserId: mockReviewerId,
    fieldName: 'overallRating',
    subFieldName: null,
    subsubfieldname: null,
    oldValue: 'GOOD',
    newValue: 'VERY GOOD',
    changedAt: new Date(),
  },
];

// ─── Mock Services ───────────────────────────────────────────────────────────

const mockPrismaService = {
  inspection: {
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
  inspectionChangeLog: {
    findMany: jest.fn(),
    createMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  inspectionBranchCity: {
    findUnique: jest.fn(),
  },
  $transaction: jest
    .fn()
    .mockImplementation((callback) => callback(mockPrismaService)),
};

const mockBlockchainService = {};
const mockConfigService = {
  getOrThrow: jest.fn().mockReturnValue('http://localhost:3000'),
};
const mockIpfsService = {
  add: jest.fn(),
};

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe('InspectionsService', () => {
  let service: InspectionsService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InspectionsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: BlockchainService, useValue: mockBlockchainService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: IpfsService, useValue: mockIpfsService },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    service = module.get<InspectionsService>(InspectionsService);
    prisma = module.get<PrismaService>(PrismaService) as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // findAll
  // ─────────────────────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('should return paginated inspections for ADMIN role (sees all statuses)', async () => {
      mockPrismaService.inspection.count.mockResolvedValue(1);
      mockPrismaService.inspection.findMany.mockResolvedValue([mockInspection]);

      const result = await service.findAll(Role.ADMIN, undefined, 1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.pageSize).toBe(10);
      expect(result.meta.totalPages).toBe(1);
      // ADMIN should NOT have default status filter
      expect(mockPrismaService.inspection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ status: InspectionStatus.ARCHIVED }),
        }),
      );
    });

    it('should default to ARCHIVED status for CUSTOMER role', async () => {
      mockPrismaService.inspection.count.mockResolvedValue(1);
      mockPrismaService.inspection.findMany.mockResolvedValue([
        mockArchivedInspection,
      ]);

      await service.findAll(Role.CUSTOMER, undefined, 1, 10);

      expect(mockPrismaService.inspection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: InspectionStatus.ARCHIVED,
          }),
        }),
      );
    });

    it('should default to ARCHIVED status for INSPECTOR role', async () => {
      mockPrismaService.inspection.count.mockResolvedValue(1);
      mockPrismaService.inspection.findMany.mockResolvedValue([]);

      await service.findAll(Role.INSPECTOR, undefined, 1, 10);

      expect(mockPrismaService.inspection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: InspectionStatus.ARCHIVED }),
        }),
      );
    });

    it('should apply explicit status filter (NEED_REVIEW) overriding role default', async () => {
      mockPrismaService.inspection.count.mockResolvedValue(2);
      mockPrismaService.inspection.findMany.mockResolvedValue([mockInspection]);

      await service.findAll(Role.ADMIN, 'NEED_REVIEW', 1, 10);

      expect(mockPrismaService.inspection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: [InspectionStatus.NEED_REVIEW] },
          }),
        }),
      );
    });

    it('should handle DATABASE special status (exclude NEED_REVIEW)', async () => {
      mockPrismaService.inspection.count.mockResolvedValue(5);
      mockPrismaService.inspection.findMany.mockResolvedValue([
        mockArchivedInspection,
      ]);

      await service.findAll(Role.ADMIN, 'DATABASE', 1, 10);

      expect(mockPrismaService.inspection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { not: InspectionStatus.NEED_REVIEW },
          }),
        }),
      );
    });

    it('should throw BadRequestException for invalid status string', async () => {
      await expect(
        service.findAll(Role.ADMIN, 'INVALID_STATUS', 1, 10),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for page < 1', async () => {
      await expect(
        service.findAll(Role.ADMIN, undefined, 0, 10),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return correct totalPages in meta', async () => {
      mockPrismaService.inspection.count.mockResolvedValue(25);
      mockPrismaService.inspection.findMany.mockResolvedValue([]);

      const result = await service.findAll(Role.ADMIN, undefined, 1, 10);

      expect(result.meta.totalPages).toBe(3); // ceil(25/10)
    });

    it('should throw InternalServerErrorException when DB throws', async () => {
      mockPrismaService.inspection.count.mockRejectedValue(
        new Error('DB connection error'),
      );

      await expect(
        service.findAll(Role.ADMIN, undefined, 1, 10),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // findOne
  // ─────────────────────────────────────────────────────────────────────────
  describe('findOne', () => {
    it('should return any inspection for ADMIN role', async () => {
      mockPrismaService.inspection.findUniqueOrThrow.mockResolvedValue(
        mockInspection,
      );

      const result = await service.findOne(mockInspectionId, Role.ADMIN);

      expect(result).toEqual(mockInspection);
    });

    it('should return any inspection for REVIEWER role', async () => {
      mockPrismaService.inspection.findUniqueOrThrow.mockResolvedValue(
        mockInspection,
      );

      const result = await service.findOne(mockInspectionId, Role.REVIEWER);

      expect(result).toEqual(mockInspection);
    });

    it('should return ARCHIVED inspection for CUSTOMER role', async () => {
      mockPrismaService.inspection.findUniqueOrThrow.mockResolvedValue(
        mockArchivedInspection,
      );

      const result = await service.findOne('mock-archived-id', Role.CUSTOMER);

      expect(result.status).toBe(InspectionStatus.ARCHIVED);
    });

    it('should throw ForbiddenException when CUSTOMER tries to access NEED_REVIEW inspection', async () => {
      mockPrismaService.inspection.findUniqueOrThrow.mockResolvedValue(
        mockInspection, // NEED_REVIEW status
      );

      await expect(
        service.findOne(mockInspectionId, Role.CUSTOMER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when INSPECTOR tries to access APPROVED inspection', async () => {
      const approvedInspection = {
        ...mockInspection,
        status: InspectionStatus.APPROVED,
      };
      mockPrismaService.inspection.findUniqueOrThrow.mockResolvedValue(
        approvedInspection,
      );

      await expect(
        service.findOne(mockInspectionId, Role.INSPECTOR),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when inspection does not exist (Prisma P2025)', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Record not found',
        { code: 'P2025', clientVersion: '5.0.0' },
      );
      mockPrismaService.inspection.findUniqueOrThrow.mockRejectedValue(
        prismaError,
      );

      await expect(
        service.findOne('non-existent-id', Role.ADMIN),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw InternalServerErrorException on unknown DB error', async () => {
      mockPrismaService.inspection.findUniqueOrThrow.mockRejectedValue(
        new Error('Unknown DB error'),
      );

      await expect(
        service.findOne(mockInspectionId, Role.ADMIN),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // searchByKeyword
  // ─────────────────────────────────────────────────────────────────────────
  describe('searchByKeyword', () => {
    it('should return empty array for empty keyword', async () => {
      const result = await service.searchByKeyword('');

      expect(result).toEqual([]);
      expect(mockPrismaService.inspection.findMany).not.toHaveBeenCalled();
    });

    it('should return empty array for whitespace-only keyword', async () => {
      const result = await service.searchByKeyword('   ');

      expect(result).toEqual([]);
      expect(mockPrismaService.inspection.findMany).not.toHaveBeenCalled();
    });

    it('should call findMany with OR conditions for keyword search', async () => {
      mockPrismaService.inspection.findMany.mockResolvedValue([mockInspection]);

      const result = await service.searchByKeyword('Toyota');

      expect(mockPrismaService.inspection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ OR: expect.any(Array) }),
        }),
      );
      expect(result).toHaveLength(1);
    });

    it('should search by pretty_id', async () => {
      mockPrismaService.inspection.findMany.mockResolvedValue([mockInspection]);

      await service.searchByKeyword('YOG');

      const callArgs = mockPrismaService.inspection.findMany.mock.calls[0][0];
      const orConditions = callArgs.where.OR;
      expect(orConditions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ pretty_id: expect.any(Object) }),
        ]),
      );
    });

    it('should search by vehiclePlateNumber (case-insensitive)', async () => {
      mockPrismaService.inspection.findMany.mockResolvedValue([mockInspection]);

      await service.searchByKeyword('ab 1234');

      const callArgs = mockPrismaService.inspection.findMany.mock.calls[0][0];
      const orConditions = callArgs.where.OR;
      expect(orConditions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            vehiclePlateNumber: expect.objectContaining({
              mode: 'insensitive',
            }),
          }),
        ]),
      );
    });

    it('should search by vehicleData.merekKendaraan (JSONB path)', async () => {
      mockPrismaService.inspection.findMany.mockResolvedValue([mockInspection]);

      await service.searchByKeyword('Toyota');

      const callArgs = mockPrismaService.inspection.findMany.mock.calls[0][0];
      const orConditions = callArgs.where.OR;
      expect(orConditions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            vehicleData: expect.objectContaining({
              path: ['merekKendaraan'],
            }),
          }),
        ]),
      );
    });

    it('should search by identityDetails.namaCustomer (JSONB path)', async () => {
      mockPrismaService.inspection.findMany.mockResolvedValue([mockInspection]);

      await service.searchByKeyword('Mock Customer');

      const callArgs = mockPrismaService.inspection.findMany.mock.calls[0][0];
      const orConditions = callArgs.where.OR;
      expect(orConditions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            identityDetails: expect.objectContaining({
              path: ['namaCustomer'],
            }),
          }),
        ]),
      );
    });

    it('should limit results to 50 records', async () => {
      mockPrismaService.inspection.findMany.mockResolvedValue([]);

      await service.searchByKeyword('test');

      expect(mockPrismaService.inspection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 }),
      );
    });

    it('should order results by createdAt desc', async () => {
      mockPrismaService.inspection.findMany.mockResolvedValue([]);

      await service.searchByKeyword('test');

      expect(mockPrismaService.inspection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('should throw InternalServerErrorException on DB error', async () => {
      mockPrismaService.inspection.findMany.mockRejectedValue(
        new Error('DB error'),
      );

      await expect(service.searchByKeyword('test')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // update (change log)
  // ─────────────────────────────────────────────────────────────────────────
  describe('update', () => {
    const mockUpdateDto = {
      overallRating: 'VERY GOOD',
    };

    it('should log changes and return message when fields differ', async () => {
      mockPrismaService.inspection.findUnique.mockResolvedValue(mockInspection);
      mockPrismaService.inspectionChangeLog.createMany.mockResolvedValue({
        count: 1,
      });

      const result = await service.update(
        mockInspectionId,
        mockUpdateDto,
        mockReviewerId,
        Role.REVIEWER,
      );

      expect(
        mockPrismaService.inspectionChangeLog.createMany,
      ).toHaveBeenCalled();
      expect(result.message).toContain('changes have been logged');
    });

    it('should return "No changes" message when DTO matches existing values', async () => {
      // Same overallRating as mockInspection
      mockPrismaService.inspection.findUnique.mockResolvedValue(mockInspection);

      const result = await service.update(
        mockInspectionId,
        { overallRating: 'GOOD' }, // Same value as mockInspection
        mockReviewerId,
        Role.REVIEWER,
      );

      expect(
        mockPrismaService.inspectionChangeLog.createMany,
      ).not.toHaveBeenCalled();
      expect(result.message).toContain('No significant changes');
    });

    it('should throw NotFoundException when inspection does not exist', async () => {
      mockPrismaService.inspection.findUnique.mockResolvedValue(null);

      await expect(
        service.update(
          'non-existent-id',
          mockUpdateDto,
          mockReviewerId,
          Role.REVIEWER,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for APPROVED inspection', async () => {
      const approvedInspection = {
        ...mockInspection,
        status: InspectionStatus.APPROVED,
      };
      mockPrismaService.inspection.findUnique.mockResolvedValue(
        approvedInspection,
      );

      await expect(
        service.update(
          mockInspectionId,
          mockUpdateDto,
          mockReviewerId,
          Role.REVIEWER,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for ARCHIVED inspection', async () => {
      const archivedInspection = {
        ...mockInspection,
        status: InspectionStatus.ARCHIVED,
      };
      mockPrismaService.inspection.findUnique.mockResolvedValue(
        archivedInspection,
      );

      await expect(
        service.update(
          mockInspectionId,
          mockUpdateDto,
          mockReviewerId,
          Role.REVIEWER,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for ARCHIVING inspection', async () => {
      const archivingInspection = {
        ...mockInspection,
        status: InspectionStatus.ARCHIVING,
      };
      mockPrismaService.inspection.findUnique.mockResolvedValue(
        archivingInspection,
      );

      await expect(
        service.update(
          mockInspectionId,
          mockUpdateDto,
          mockReviewerId,
          Role.REVIEWER,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw InternalServerErrorException when changeLog save fails', async () => {
      mockPrismaService.inspection.findUnique.mockResolvedValue(mockInspection);
      mockPrismaService.inspectionChangeLog.createMany.mockRejectedValue(
        new Error('DB write error'),
      );

      await expect(
        service.update(
          mockInspectionId,
          mockUpdateDto,
          mockReviewerId,
          Role.REVIEWER,
        ),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // approveInspection (existing tests — preserved)
  // ─────────────────────────────────────────────────────────────────────────
  describe('approveInspection', () => {
    it('should apply change logs and call PDF generation on full happy path', async () => {
      const inspectionAfterChanges = {
        ...mockInspection,
        overallRating: 'VERY GOOD',
        vehicleData: { merekKendaraan: 'Toyota', tipeKendaraan: 'Veloz' },
        pretty_id: 'YOG-13082025-001',
      };

      // Transaction mock with all methods the service calls
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          inspection: {
            findUnique: jest.fn().mockResolvedValue(mockInspection),
            findUniqueOrThrow: jest.fn().mockResolvedValue(mockInspection),
            update: jest.fn().mockResolvedValue(inspectionAfterChanges),
            findUniqueOrThrow: jest
              .fn()
              .mockResolvedValue(inspectionAfterChanges),
          },
          inspectionChangeLog: {
            findMany: jest.fn().mockResolvedValue(mockChangeLogs),
          },
        };
        return await callback(tx);
      });

      const generatePdfSpy = jest
        .spyOn(service as any, '_generateAndSavePdf')
        .mockResolvedValue({
          pdfPublicUrl: '/pdf/new.pdf',
          pdfCid: 'new-cid',
          pdfHashString: 'new-hash',
        });

      mockPrismaService.inspection.update.mockResolvedValue({
        ...inspectionAfterChanges,
        status: InspectionStatus.APPROVED,
        urlPdf: '/pdf/new.pdf',
      });

      mockConfigService.getOrThrow.mockReturnValue('http://localhost:3000');

      await service.approveInspection(
        mockInspectionId,
        mockReviewerId,
        mockToken,
      );

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(generatePdfSpy).toHaveBeenCalledTimes(2); // full PDF + no-docs PDF
      expect(mockPrismaService.inspection.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockInspectionId },
          data: expect.objectContaining({ status: InspectionStatus.APPROVED }),
        }),
      );
    });

    it('should throw NotFoundException if inspection does not exist', async () => {
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          inspection: {
            findUnique: jest.fn().mockResolvedValue(null),
            findUniqueOrThrow: jest.fn().mockResolvedValue(null),
          },
        };
        return await callback(tx);
      });

      await expect(
        service.approveInspection(mockInspectionId, mockReviewerId, mockToken),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for wrong initial status', async () => {
      const wrongStatusInspection = {
        ...mockInspection,
        status: InspectionStatus.APPROVED,
      };
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          inspection: {
            findUnique: jest
              .fn()
              .mockResolvedValue(wrongStatusInspection),
          },
        };
        return await callback(tx);
      });

      await expect(
        service.approveInspection(mockInspectionId, mockReviewerId, mockToken),
      ).rejects.toThrow(BadRequestException);
    });

    it('should call rollback and throw InternalServerErrorException if PDF generation fails', async () => {
      const inspectionAfterChanges = {
        ...mockInspection,
        overallRating: 'VERY GOOD',
        pretty_id: 'YOG-13082025-001',
      };
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          inspection: {
            findUnique: jest.fn().mockResolvedValue(mockInspection),
            findUniqueOrThrow: jest.fn().mockResolvedValue(mockInspection),
            update: jest.fn().mockResolvedValue(inspectionAfterChanges),
            findUniqueOrThrow: jest
              .fn()
              .mockResolvedValue(inspectionAfterChanges),
          },
          inspectionChangeLog: {
            findMany: jest.fn().mockResolvedValue(mockChangeLogs),
          },
        };
        return await callback(tx);
      });

      jest
        .spyOn(service as any, '_generateAndSavePdf')
        .mockRejectedValue(new Error('PDF generation failed'));

      // Spy on the rollback helper method
      const rollbackSpy = jest
        .spyOn(service as any, 'rollbackInspectionStatusAfterError')
        .mockResolvedValue(undefined);

      mockConfigService.getOrThrow.mockReturnValue('http://localhost:3000');

      await expect(
        service.approveInspection(mockInspectionId, mockReviewerId, mockToken),
      ).rejects.toThrow(InternalServerErrorException);

      // Rollback must have been called with the original status
      expect(rollbackSpy).toHaveBeenCalledWith(
        mockInspectionId,
        InspectionStatus.NEED_REVIEW,
      );
    });
  });
});

