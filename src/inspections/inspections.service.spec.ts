/* eslint-disable @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
import { InspectionsService } from './inspections.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { InspectionQueryService } from './inspection-query.service';
import { InspectionPdfService } from './inspection-pdf.service';
import { InspectionBlockchainService } from './inspection-blockchain.service';
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
  overallRating: 85,
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
    updateMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  inspectionChangeLog: {
    findMany: jest.fn(),
    createMany: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
  },
  photo: {
    deleteMany: jest.fn(),
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
  $queryRaw: jest.fn(),
};

const mockConfigService = {
  getOrThrow: jest.fn().mockReturnValue('http://localhost:3000'),
  get: jest.fn(),
};
const mockRedisService = {
  isHealthy: jest.fn().mockResolvedValue(true),
  get: jest.fn(),
  set: jest.fn(),
  incr: jest.fn(),
};

// ─── Mock Sub-Services ──────────────────────────────────────────────────────

const mockQueryService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  findByVehiclePlateNumber: jest.fn(),
  searchByKeyword: jest.fn(),
  findLatestArchivedInspections: jest.fn(),
  invalidateListCache: jest.fn().mockResolvedValue(undefined),
};

const mockPdfService = {
  generateAndSavePdf: jest.fn(),
  generatePdfFromUrl: jest.fn(),
  getQueueStats: jest.fn().mockReturnValue({
    queueLength: 0,
    running: 0,
    totalProcessed: 0,
    totalErrors: 0,
    circuitBreakerOpen: false,
  }),
};

const mockBlockchainService = {
  processToArchive: jest.fn(),
  deactivateArchive: jest.fn(),
  activateArchive: jest.fn(),
  buildArchiveTransaction: jest.fn(),
  confirmArchive: jest.fn(),
  revertInspectionToApproved: jest.fn(),
  getQueueStats: jest.fn().mockReturnValue({
    queueLength: 0,
    running: 0,
    totalProcessed: 0,
    totalErrors: 0,
  }),
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
        { provide: ConfigService, useValue: mockConfigService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: InspectionQueryService, useValue: mockQueryService },
        { provide: InspectionPdfService, useValue: mockPdfService },
        {
          provide: InspectionBlockchainService,
          useValue: mockBlockchainService,
        },
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
  // Delegated Query Methods
  // ─────────────────────────────────────────────────────────────────────────

  describe('findAll (delegated)', () => {
    it('should delegate to queryService.findAll with all arguments', async () => {
      const expected = {
        data: [mockInspection],
        meta: { total: 1, page: 1, pageSize: 10, totalPages: 1 },
      };
      mockQueryService.findAll.mockResolvedValue(expected);

      const result = await service.findAll(Role.ADMIN, undefined, 1, 10);

      expect(mockQueryService.findAll).toHaveBeenCalledWith(
        Role.ADMIN,
        undefined,
        1,
        10,
      );
      expect(result).toBe(expected);
    });

    it('should pass status filter through to queryService', async () => {
      mockQueryService.findAll.mockResolvedValue({ data: [], meta: {} });

      await service.findAll(Role.CUSTOMER, 'ARCHIVED', 2, 5);

      expect(mockQueryService.findAll).toHaveBeenCalledWith(
        Role.CUSTOMER,
        'ARCHIVED',
        2,
        5,
      );
    });

    it('should propagate errors from queryService', async () => {
      mockQueryService.findAll.mockRejectedValue(
        new BadRequestException('Invalid status'),
      );

      await expect(
        service.findAll(Role.ADMIN, 'INVALID', 1, 10),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne (delegated)', () => {
    it('should delegate to queryService.findOne', async () => {
      mockQueryService.findOne.mockResolvedValue(mockInspection);

      const result = await service.findOne(mockInspectionId, Role.ADMIN);

      expect(mockQueryService.findOne).toHaveBeenCalledWith(
        mockInspectionId,
        Role.ADMIN,
      );
      expect(result).toBe(mockInspection);
    });

    it('should propagate NotFoundException from queryService', async () => {
      mockQueryService.findOne.mockRejectedValue(
        new NotFoundException('Not found'),
      );

      await expect(service.findOne('nonexistent', Role.ADMIN)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should propagate ForbiddenException from queryService', async () => {
      mockQueryService.findOne.mockRejectedValue(
        new ForbiddenException('Access denied'),
      );

      await expect(
        service.findOne(mockInspectionId, Role.CUSTOMER),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('searchByKeyword (delegated)', () => {
    it('should delegate to queryService.searchByKeyword', async () => {
      const expected = { data: [mockInspection], meta: { total: 1 } };
      mockQueryService.searchByKeyword.mockResolvedValue(expected);

      const result = await service.searchByKeyword('Toyota', 1, 10);

      expect(mockQueryService.searchByKeyword).toHaveBeenCalledWith(
        'Toyota',
        1,
        10,
      );
      expect(result).toBe(expected);
    });

    it('should propagate errors from queryService', async () => {
      mockQueryService.searchByKeyword.mockRejectedValue(
        new InternalServerErrorException('DB error'),
      );

      await expect(service.searchByKeyword('test')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('findByVehiclePlateNumber (delegated)', () => {
    it('should delegate to queryService.findByVehiclePlateNumber', async () => {
      const expected = { id: 'db-id', vehiclePlateNumber: 'AB 1234 CD' };
      mockQueryService.findByVehiclePlateNumber.mockResolvedValue(expected);

      const result = await service.findByVehiclePlateNumber('AB 1234 CD');

      expect(mockQueryService.findByVehiclePlateNumber).toHaveBeenCalledWith(
        'AB 1234 CD',
      );
      expect(result).toBe(expected);
    });

    it('should return null when queryService returns null', async () => {
      mockQueryService.findByVehiclePlateNumber.mockResolvedValue(null);

      const result = await service.findByVehiclePlateNumber('UNKNOWN 999');
      expect(result).toBeNull();
    });
  });

  describe('findLatestArchivedInspections (delegated)', () => {
    it('should delegate to queryService.findLatestArchivedInspections', async () => {
      const expected = [
        {
          ...mockArchivedInspection,
          photos: [{ id: 'p1', label: 'Tampak Depan', path: 'photo.jpg' }],
        },
      ];
      mockQueryService.findLatestArchivedInspections.mockResolvedValue(
        expected,
      );

      const result = await service.findLatestArchivedInspections();

      expect(mockQueryService.findLatestArchivedInspections).toHaveBeenCalled();
      expect(result).toBe(expected);
    });

    it('should propagate errors from queryService', async () => {
      mockQueryService.findLatestArchivedInspections.mockRejectedValue(
        new InternalServerErrorException('DB error'),
      );

      await expect(service.findLatestArchivedInspections()).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Delegated Blockchain Methods
  // ─────────────────────────────────────────────────────────────────────────

  describe('processToArchive (delegated)', () => {
    it('should delegate to blockchainService.processToArchive', async () => {
      const expected = {
        ...mockArchivedInspection,
        status: InspectionStatus.ARCHIVED,
      };
      mockBlockchainService.processToArchive.mockResolvedValue(expected);

      const result = await service.processToArchive(
        mockInspectionId,
        'admin-id',
      );

      expect(mockBlockchainService.processToArchive).toHaveBeenCalledWith(
        mockInspectionId,
        'admin-id',
      );
      expect(result).toBe(expected);
    });

    it('should propagate NotFoundException from blockchainService', async () => {
      mockBlockchainService.processToArchive.mockRejectedValue(
        new NotFoundException('Not found'),
      );

      await expect(
        service.processToArchive(mockInspectionId, 'admin-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should propagate BadRequestException when status is not APPROVED', async () => {
      mockBlockchainService.processToArchive.mockRejectedValue(
        new BadRequestException('Not APPROVED'),
      );

      await expect(
        service.processToArchive(mockInspectionId, 'admin-id'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deactivateArchive (delegated)', () => {
    it('should delegate to blockchainService.deactivateArchive', async () => {
      const deactivated = { ...mockArchivedInspection, status: 'DEACTIVATED' };
      mockBlockchainService.deactivateArchive.mockResolvedValue(deactivated);

      const result = await service.deactivateArchive(
        'mock-archived-id',
        'admin-id',
      );

      expect(mockBlockchainService.deactivateArchive).toHaveBeenCalledWith(
        'mock-archived-id',
        'admin-id',
      );
      expect(result.status).toBe('DEACTIVATED');
    });

    it('should propagate NotFoundException from blockchainService', async () => {
      mockBlockchainService.deactivateArchive.mockRejectedValue(
        new NotFoundException('Not found'),
      );

      await expect(
        service.deactivateArchive('nonexistent', 'admin-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should propagate BadRequestException for wrong status', async () => {
      mockBlockchainService.deactivateArchive.mockRejectedValue(
        new BadRequestException('Wrong status'),
      );

      await expect(
        service.deactivateArchive(mockInspectionId, 'admin-id'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('activateArchive (delegated)', () => {
    it('should delegate to blockchainService.activateArchive', async () => {
      const reactivated = {
        ...mockArchivedInspection,
        status: 'ARCHIVED',
        deactivatedAt: null,
      };
      mockBlockchainService.activateArchive.mockResolvedValue(reactivated);

      const result = await service.activateArchive(
        mockInspectionId,
        'admin-id',
      );

      expect(mockBlockchainService.activateArchive).toHaveBeenCalledWith(
        mockInspectionId,
        'admin-id',
      );
      expect(result.status).toBe('ARCHIVED');
    });

    it('should propagate NotFoundException from blockchainService', async () => {
      mockBlockchainService.activateArchive.mockRejectedValue(
        new NotFoundException('Not found'),
      );

      await expect(
        service.activateArchive('nonexistent', 'admin-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should propagate BadRequestException for wrong status', async () => {
      mockBlockchainService.activateArchive.mockRejectedValue(
        new BadRequestException('Wrong status'),
      );

      await expect(
        service.activateArchive(mockInspectionId, 'admin-id'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('confirmArchive (delegated)', () => {
    const mockConfirmDto = { txHash: 'tx-hash-123', nftAssetId: 'asset-123' };

    it('should delegate to blockchainService.confirmArchive', async () => {
      const expected = {
        ...mockArchivedInspection,
        blockchainTxHash: 'tx-hash-123',
        nftAssetId: 'asset-123',
      };
      mockBlockchainService.confirmArchive.mockResolvedValue(expected);

      const result = await service.confirmArchive(
        'mock-archived-id',
        mockConfirmDto as any,
      );

      expect(mockBlockchainService.confirmArchive).toHaveBeenCalledWith(
        'mock-archived-id',
        mockConfirmDto,
      );
      expect(result.blockchainTxHash).toBe('tx-hash-123');
    });

    it('should propagate NotFoundException from blockchainService', async () => {
      mockBlockchainService.confirmArchive.mockRejectedValue(
        new NotFoundException('Not found'),
      );

      await expect(
        service.confirmArchive('nonexistent', mockConfirmDto as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('revertInspectionToApproved (delegated)', () => {
    it('should delegate to blockchainService.revertInspectionToApproved', async () => {
      const reverted = {
        ...mockArchivedInspection,
        status: InspectionStatus.APPROVED,
      };
      mockBlockchainService.revertInspectionToApproved.mockResolvedValue(
        reverted,
      );

      const result = await service.revertInspectionToApproved(
        'mock-archived-id',
        'superadmin-id',
      );

      expect(
        mockBlockchainService.revertInspectionToApproved,
      ).toHaveBeenCalledWith('mock-archived-id', 'superadmin-id');
      expect(result.status).toBe(InspectionStatus.APPROVED);
    });

    it('should propagate NotFoundException from blockchainService', async () => {
      mockBlockchainService.revertInspectionToApproved.mockRejectedValue(
        new NotFoundException('Not found'),
      );

      await expect(
        service.revertInspectionToApproved('nonexistent', 'superadmin-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should propagate BadRequestException for wrong status', async () => {
      mockBlockchainService.revertInspectionToApproved.mockRejectedValue(
        new BadRequestException('Wrong status'),
      );

      await expect(
        service.revertInspectionToApproved(mockInspectionId, 'superadmin-id'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getQueueStats (combines PDF + Blockchain)
  // ─────────────────────────────────────────────────────────────────────────
  describe('getQueueStats', () => {
    it('should return pdf and blockchain queue stats from sub-services', () => {
      const stats = service.getQueueStats();
      expect(stats).toHaveProperty('pdfQueue');
      expect(stats).toHaveProperty('blockchainQueue');
      expect(stats.pdfQueue).toHaveProperty('queueLength');
      expect(stats.pdfQueue).toHaveProperty('running');
      expect(mockPdfService.getQueueStats).toHaveBeenCalled();
      expect(mockBlockchainService.getQueueStats).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // update (change log) — retained in facade, uses PrismaService directly
  // ─────────────────────────────────────────────────────────────────────────
  describe('update', () => {
    const mockUpdateDto = {
      overallRating: 95,
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
        { overallRating: 85 }, // Same value as mockInspection
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
  // create — retained in facade, uses PrismaService + queryService.invalidateListCache
  // ─────────────────────────────────────────────────────────────────────────
  describe('create', () => {
    const mockCreateDto = {
      vehiclePlateNumber: 'AB 1234 CD',
      inspectionDate: '2025-08-13',
      overallRating: 85,
      identityDetails: {
        namaInspektor: mockInspectorId,
        namaCustomer: 'Mock Customer',
        cabangInspeksi: 'mock-branch-id',
      },
      vehicleData: { merekKendaraan: 'Toyota', tipeKendaraan: 'Avanza' },
      equipmentChecklist: {},
      inspectionSummary: {},
      detailedAssessment: {},
      bodyPaintThickness: {},
    } as any;

    it('should create inspection and return id', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        name: 'Mock Inspector',
        inspectionBranchCityId: 'mock-branch-id',
      });
      mockPrismaService.inspectionBranchCity.findUnique.mockResolvedValue({
        city: 'Yogyakarta',
        code: 'YOG',
      });
      mockRedisService.isHealthy.mockResolvedValue(true);
      mockRedisService.incr.mockResolvedValue(1);

      const txMock = {
        inspectionSequence: {
          upsert: jest.fn().mockResolvedValue({ nextSequence: 1 }),
        },
        inspection: {
          create: jest
            .fn()
            .mockResolvedValue({ id: 'new-id', pretty_id: 'YOG-13082025-001' }),
        },
      };
      mockPrismaService.$transaction.mockImplementation((cb) => cb(txMock));

      const result = await service.create(mockCreateDto, mockInspectorId);
      expect(result).toEqual({ id: 'new-id' });
      expect(mockQueryService.invalidateListCache).toHaveBeenCalled();
    });

    it('should throw BadRequestException when inspectorId is missing', async () => {
      const dto = {
        ...mockCreateDto,
        identityDetails: {
          ...mockCreateDto.identityDetails,
          namaInspektor: undefined,
        },
      };
      await expect(service.create(dto, '')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when inspector not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      await expect(
        service.create(mockCreateDto, mockInspectorId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when branchCity not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        name: 'Mock Inspector',
        inspectionBranchCityId: 'mock-branch-id',
      });
      mockPrismaService.inspectionBranchCity.findUnique.mockResolvedValue(null);
      await expect(
        service.create(mockCreateDto, mockInspectorId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid inspectionDate', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        name: 'Mock Inspector',
        inspectionBranchCityId: 'mock-branch-id',
      });
      mockPrismaService.inspectionBranchCity.findUnique.mockResolvedValue({
        city: 'Yogyakarta',
        code: 'YOG',
      });
      const dto = { ...mockCreateDto, inspectionDate: 'invalid-date' };
      await expect(service.create(dto, mockInspectorId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should use branchCity from request body when inspector has none', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        name: 'Mock Inspector',
        inspectionBranchCityId: null,
      });
      mockPrismaService.inspectionBranchCity.findUnique.mockResolvedValue({
        city: 'Yogyakarta',
        code: 'YOG',
      });
      mockRedisService.isHealthy.mockResolvedValue(false);
      mockRedisService.set.mockResolvedValue(undefined);

      const txMock = {
        inspectionSequence: {
          upsert: jest.fn().mockResolvedValue({ nextSequence: 1 }),
        },
        inspection: {
          create: jest.fn().mockResolvedValue({
            id: 'new-id-2',
            pretty_id: 'YOG-13082025-001',
          }),
        },
      };
      mockPrismaService.$transaction.mockImplementation((cb) => cb(txMock));

      const result = await service.create(mockCreateDto, mockInspectorId);
      expect(result).toEqual({ id: 'new-id-2' });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // deleteInspectionPermanently — retained in facade
  // ─────────────────────────────────────────────────────────────────────────
  describe('deleteInspectionPermanently', () => {
    it('should throw NotFoundException when inspection not found', async () => {
      mockPrismaService.inspection.findUnique.mockResolvedValue(null);
      await expect(
        service.deleteInspectionPermanently('nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should delete inspection and associated records successfully', async () => {
      const inspectionWithPhotos = {
        ...mockArchivedInspection,
        photos: [{ id: 'p1', path: 'photo.jpg' }],
        urlPdf: '/pdfarchived/test.pdf',
        urlPdfNoDocs: '/pdfarchived/test-no-docs.pdf',
      };
      mockPrismaService.inspection.findUnique.mockResolvedValue(
        inspectionWithPhotos,
      );

      const txMock = {
        inspectionChangeLog: {
          deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        photo: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
        inspection: { delete: jest.fn().mockResolvedValue({}) },
      };
      mockPrismaService.$transaction.mockImplementation((cb) => cb(txMock));

      await expect(
        service.deleteInspectionPermanently('mock-archived-id'),
      ).resolves.toBeUndefined();
      expect(txMock.inspection.delete).toHaveBeenCalledWith({
        where: { id: 'mock-archived-id' },
      });
      expect(mockQueryService.invalidateListCache).toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException on transaction failure', async () => {
      const inspectionWithPhotos = {
        ...mockArchivedInspection,
        photos: [],
        urlPdf: null,
        urlPdfNoDocs: null,
      };
      mockPrismaService.inspection.findUnique.mockResolvedValue(
        inspectionWithPhotos,
      );
      mockPrismaService.$transaction.mockRejectedValue(
        new Error('Transaction failed'),
      );

      await expect(
        service.deleteInspectionPermanently('mock-archived-id'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // rollbackInspectionStatus — retained in facade
  // ─────────────────────────────────────────────────────────────────────────
  describe('rollbackInspectionStatus', () => {
    it('should rollback inspection status to NEED_REVIEW', async () => {
      const rolledBack = {
        ...mockArchivedInspection,
        status: InspectionStatus.NEED_REVIEW,
      };
      mockPrismaService.$transaction.mockImplementation(async (cb) => {
        const tx = {
          inspection: {
            findUnique: jest.fn().mockResolvedValue(mockArchivedInspection),
            update: jest.fn().mockResolvedValue(rolledBack),
          },
          inspectionChangeLog: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return cb(tx);
      });

      const result = await service.rollbackInspectionStatus(
        'mock-archived-id',
        'superadmin-id',
      );
      expect(result.status).toBe(InspectionStatus.NEED_REVIEW);
      expect(mockQueryService.invalidateListCache).toHaveBeenCalled();
    });

    it('should throw NotFoundException when inspection not found', async () => {
      mockPrismaService.$transaction.mockImplementation(async (cb) => {
        const tx = {
          inspection: { findUnique: jest.fn().mockResolvedValue(null) },
        };
        return cb(tx);
      });

      await expect(
        service.rollbackInspectionStatus('nonexistent', 'superadmin-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when inspection is already NEED_REVIEW', async () => {
      mockPrismaService.$transaction.mockImplementation(async (cb) => {
        const tx = {
          inspection: {
            findUnique: jest.fn().mockResolvedValue(mockInspection),
          }, // NEED_REVIEW
        };
        return cb(tx);
      });

      await expect(
        service.rollbackInspectionStatus(mockInspectionId, 'superadmin-id'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // bulkApproveInspections — retained in facade
  // ─────────────────────────────────────────────────────────────────────────
  describe('bulkApproveInspections', () => {
    it('should return successful and failed results', async () => {
      jest
        .spyOn(service, 'approveInspection')
        .mockResolvedValueOnce({
          ...mockInspection,
          status: InspectionStatus.APPROVED,
        } as any)
        .mockRejectedValueOnce(new Error('Approval failed'));

      const result = await service.bulkApproveInspections(
        ['id-1', 'id-2'],
        mockReviewerId,
        mockToken,
      );

      expect(result.summary.total).toBe(2);
      expect(result.summary.successful).toBe(1);
      expect(result.summary.failed).toBe(1);
      expect(result.successful).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
      expect(mockQueryService.invalidateListCache).toHaveBeenCalled();
    }, 10000);

    it('should return all successful when all approvals succeed', async () => {
      jest.spyOn(service, 'approveInspection').mockResolvedValue({
        ...mockInspection,
        status: InspectionStatus.APPROVED,
      } as any);

      const result = await service.bulkApproveInspections(
        ['id-1', 'id-2'],
        mockReviewerId,
        mockToken,
      );

      expect(result.summary.successful).toBe(2);
      expect(result.summary.failed).toBe(0);
    }, 10000);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // approveInspection — retained in facade, uses pdfService.generateAndSavePdf
  // ─────────────────────────────────────────────────────────────────────────
  describe('approveInspection', () => {
    it('should apply change logs and call PDF generation on full happy path', async () => {
      const inspectionAfterChanges = {
        ...mockInspection,
        overallRating: 95,
        vehicleData: { merekKendaraan: 'Toyota', tipeKendaraan: 'Veloz' },
        pretty_id: 'YOG-13082025-001',
      };

      // Transaction mock with all methods the service calls
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          inspection: {
            findUnique: jest.fn().mockResolvedValue(mockInspection),
            findUniqueOrThrow: jest
              .fn()
              .mockResolvedValue(inspectionAfterChanges),
            update: jest.fn().mockResolvedValue(inspectionAfterChanges),
          },
          inspectionChangeLog: {
            findMany: jest.fn().mockResolvedValue(mockChangeLogs),
          },
        };
        return await callback(tx);
      });

      mockPdfService.generateAndSavePdf.mockResolvedValue({
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
      expect(mockPdfService.generateAndSavePdf).toHaveBeenCalledTimes(2); // full PDF + no-docs PDF
      expect(mockPrismaService.inspection.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockInspectionId },
          data: expect.objectContaining({ status: InspectionStatus.APPROVED }),
        }),
      );
      expect(mockQueryService.invalidateListCache).toHaveBeenCalled();
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
            findUnique: jest.fn().mockResolvedValue(wrongStatusInspection),
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
        overallRating: 95,
        pretty_id: 'YOG-13082025-001',
      };
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          inspection: {
            findUnique: jest.fn().mockResolvedValue(mockInspection),
            findUniqueOrThrow: jest
              .fn()
              .mockResolvedValue(inspectionAfterChanges),
            update: jest.fn().mockResolvedValue(inspectionAfterChanges),
          },
          inspectionChangeLog: {
            findMany: jest.fn().mockResolvedValue(mockChangeLogs),
          },
        };
        return await callback(tx);
      });

      mockPdfService.generateAndSavePdf.mockRejectedValue(
        new Error('PDF generation failed'),
      );

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
