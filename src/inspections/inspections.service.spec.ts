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

const mockBlockchainService = {};
const mockConfigService = {
  getOrThrow: jest.fn().mockReturnValue('http://localhost:3000'),
};
const mockIpfsService = {
  add: jest.fn(),
};
const mockRedisService = {
  isHealthy: jest.fn().mockResolvedValue(true),
  get: jest.fn(),
  set: jest.fn(),
  incr: jest.fn(),
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
    it('should return empty data for empty keyword', async () => {
      const result = await service.searchByKeyword('');

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(mockPrismaService.inspection.findMany).not.toHaveBeenCalled();
    });

    it('should return empty data for whitespace-only keyword', async () => {
      const result = await service.searchByKeyword('   ');

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(mockPrismaService.inspection.findMany).not.toHaveBeenCalled();
    });

    it('should call findMany with OR conditions for keyword search', async () => {
      mockPrismaService.inspection.count.mockResolvedValue(1);
      mockPrismaService.inspection.findMany.mockResolvedValue([mockInspection]);

      const result = await service.searchByKeyword('Toyota');

      expect(mockPrismaService.inspection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ OR: expect.any(Array) }),
        }),
      );
      expect(result.data).toHaveLength(1);
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

    it('should limit results to pageSize records', async () => {
      mockPrismaService.inspection.count.mockResolvedValue(0);
      mockPrismaService.inspection.findMany.mockResolvedValue([]);

      await service.searchByKeyword('test', 1, 10);

      expect(mockPrismaService.inspection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 }),
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
  // create
  // ─────────────────────────────────────────────────────────────────────────
  describe('create', () => {
    const mockCreateDto = {
      vehiclePlateNumber: 'AB 1234 CD',
      inspectionDate: '2025-08-13',
      overallRating: 'GOOD',
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
          create: jest.fn().mockResolvedValue({ id: 'new-id', pretty_id: 'YOG-13082025-001' }),
        },
      };
      mockPrismaService.$transaction.mockImplementation((cb) => cb(txMock));

      const result = await service.create(mockCreateDto, mockInspectorId);
      expect(result).toEqual({ id: 'new-id' });
    });

    it('should throw BadRequestException when inspectorId is missing', async () => {
      const dto = { ...mockCreateDto, identityDetails: { ...mockCreateDto.identityDetails, namaInspektor: undefined } };
      await expect(service.create(dto, '')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when inspector not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      await expect(service.create(mockCreateDto, mockInspectorId)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when branchCity not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        name: 'Mock Inspector',
        inspectionBranchCityId: 'mock-branch-id',
      });
      mockPrismaService.inspectionBranchCity.findUnique.mockResolvedValue(null);
      await expect(service.create(mockCreateDto, mockInspectorId)).rejects.toThrow(BadRequestException);
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
      await expect(service.create(dto, mockInspectorId)).rejects.toThrow(BadRequestException);
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
      mockRedisService.set.mockResolvedValue(undefined); // ensure set returns a Promise

      const txMock = {
        inspectionSequence: {
          upsert: jest.fn().mockResolvedValue({ nextSequence: 1 }),
        },
        inspection: {
          create: jest.fn().mockResolvedValue({ id: 'new-id-2', pretty_id: 'YOG-13082025-001' }),
        },
      };
      mockPrismaService.$transaction.mockImplementation((cb) => cb(txMock));

      const result = await service.create(mockCreateDto, mockInspectorId);
      expect(result).toEqual({ id: 'new-id-2' });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // findByVehiclePlateNumber
  // ─────────────────────────────────────────────────────────────────────────
  describe('findByVehiclePlateNumber', () => {
    it('should return cached result when cache hits', async () => {
      const cachedData = { id: 'cached-id', vehiclePlateNumber: 'AB 1234 CD' };
      mockRedisService.get
        .mockResolvedValueOnce('0') // version key
        .mockResolvedValueOnce(JSON.stringify(cachedData)); // cache hit

      const result = await service.findByVehiclePlateNumber('AB 1234 CD');
      expect(result).toEqual(cachedData);
    });

    it('should query DB and return result on cache miss', async () => {
      mockRedisService.get
        .mockResolvedValueOnce('0') // version
        .mockResolvedValueOnce(null); // cache miss

      const dbRow = { id: 'db-id', vehiclePlateNumber: 'AB 1234 CD', status: 'ARCHIVED' };
      mockPrismaService.$queryRaw = jest.fn().mockResolvedValue([dbRow]);

      const result = await service.findByVehiclePlateNumber('AB 1234 CD');
      expect(result).toEqual(dbRow);
    });

    it('should return null when no row found', async () => {
      mockRedisService.get
        .mockResolvedValueOnce('0')
        .mockResolvedValueOnce(null);

      mockPrismaService.$queryRaw = jest.fn().mockResolvedValue([]);

      const result = await service.findByVehiclePlateNumber('UNKNOWN 999');
      expect(result).toBeNull();
    });

    it('should throw InternalServerErrorException on DB error', async () => {
      mockRedisService.get
        .mockResolvedValueOnce('0')
        .mockResolvedValueOnce(null);

      mockPrismaService.$queryRaw = jest.fn().mockRejectedValue(new Error('DB error'));

      await expect(service.findByVehiclePlateNumber('AB 1234 CD')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // deactivateArchive
  // ─────────────────────────────────────────────────────────────────────────
  describe('deactivateArchive', () => {
    it('should deactivate an ARCHIVED inspection', async () => {
      const deactivated = { ...mockArchivedInspection, status: 'DEACTIVATED' };
      mockPrismaService.inspection.update.mockResolvedValue(deactivated);

      const result = await service.deactivateArchive('mock-archived-id', 'admin-id');
      expect(result.status).toBe('DEACTIVATED');
    });

    it('should throw NotFoundException when inspection not found (P2025)', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError('Not found', {
        code: 'P2025',
        clientVersion: '5.0.0',
      });
      mockPrismaService.inspection.update.mockRejectedValue(prismaError);
      mockPrismaService.inspection.findUnique.mockResolvedValue(null);

      await expect(service.deactivateArchive('nonexistent', 'admin-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when inspection has wrong status (P2025)', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError('Not found', {
        code: 'P2025',
        clientVersion: '5.0.0',
      });
      mockPrismaService.inspection.update.mockRejectedValue(prismaError);
      mockPrismaService.inspection.findUnique.mockResolvedValue({
        status: 'NEED_REVIEW',
      });

      await expect(service.deactivateArchive(mockInspectionId, 'admin-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw InternalServerErrorException on unknown DB error', async () => {
      mockPrismaService.inspection.update.mockRejectedValue(new Error('Unknown error'));

      await expect(service.deactivateArchive(mockInspectionId, 'admin-id')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // activateArchive
  // ─────────────────────────────────────────────────────────────────────────
  describe('activateArchive', () => {
    it('should reactivate a DEACTIVATED inspection', async () => {
      const reactivated = { ...mockArchivedInspection, status: 'ARCHIVED', deactivatedAt: null };
      mockPrismaService.inspection.update.mockResolvedValue(reactivated);

      const result = await service.activateArchive(mockInspectionId, 'admin-id');
      expect(result.status).toBe('ARCHIVED');
    });

    it('should throw NotFoundException when inspection not found (P2025)', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError('Not found', {
        code: 'P2025',
        clientVersion: '5.0.0',
      });
      mockPrismaService.inspection.update.mockRejectedValue(prismaError);
      mockPrismaService.inspection.findUnique.mockResolvedValue(null);

      await expect(service.activateArchive('nonexistent', 'admin-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when inspection has wrong status', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError('Not found', {
        code: 'P2025',
        clientVersion: '5.0.0',
      });
      mockPrismaService.inspection.update.mockRejectedValue(prismaError);
      mockPrismaService.inspection.findUnique.mockResolvedValue({
        status: 'APPROVED',
      });

      await expect(service.activateArchive(mockInspectionId, 'admin-id')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // processToArchive
  // ─────────────────────────────────────────────────────────────────────────
  describe('processToArchive', () => {
    const mockApprovedInspection = {
      ...mockInspection,
      status: InspectionStatus.APPROVED,
      vehiclePlateNumber: 'AB 1234 CD',
      pdfFileHash: 'hash-abc',
      pdfFileHashNoDocs: 'hash-def',
      vehicleData: { merekKendaraan: 'Toyota', tipeKendaraan: 'Avanza' },
      pretty_id: 'YOG-13082025-001',
    };

    it('should throw NotFoundException when inspection not found', async () => {
      mockPrismaService.inspection.findUnique.mockResolvedValue(null);
      await expect(service.processToArchive(mockInspectionId, 'admin-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when status is not APPROVED', async () => {
      mockPrismaService.inspection.findUnique.mockResolvedValue(mockInspection); // NEED_REVIEW
      await expect(service.processToArchive(mockInspectionId, 'admin-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when vehiclePlateNumber is missing', async () => {
      mockPrismaService.inspection.findUnique.mockResolvedValue({
        ...mockApprovedInspection,
        vehiclePlateNumber: null,
      });
      await expect(service.processToArchive(mockInspectionId, 'admin-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when pdfFileHash is missing', async () => {
      mockPrismaService.inspection.findUnique.mockResolvedValue({
        ...mockApprovedInspection,
        pdfFileHash: null,
      });
      await expect(service.processToArchive(mockInspectionId, 'admin-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when pdfFileHashNoDocs is missing', async () => {
      mockPrismaService.inspection.findUnique.mockResolvedValue({
        ...mockApprovedInspection,
        pdfFileHashNoDocs: null,
      });
      await expect(service.processToArchive(mockInspectionId, 'admin-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should archive successfully when blockchain succeeds', async () => {
      mockPrismaService.inspection.findUnique.mockResolvedValue(mockApprovedInspection);

      const blockchainSvcMock = {
        mintInspectionNft: jest.fn().mockResolvedValue({ txHash: 'tx-123', assetId: 'asset-456' }),
      };
      // Re-create service with blockchain mock
      const module = await Test.createTestingModule({
        providers: [
          InspectionsService,
          { provide: PrismaService, useValue: mockPrismaService },
          { provide: BlockchainService, useValue: blockchainSvcMock },
          { provide: ConfigService, useValue: mockConfigService },
          { provide: IpfsService, useValue: mockIpfsService },
          { provide: RedisService, useValue: mockRedisService },
        ],
      }).compile();
      const svc = module.get<InspectionsService>(InspectionsService);

      mockPrismaService.inspection.update.mockResolvedValue({
        ...mockApprovedInspection,
        status: InspectionStatus.ARCHIVED,
        nftAssetId: 'asset-456',
        blockchainTxHash: 'tx-123',
        archivedAt: new Date(),
      });

      const result = await svc.processToArchive(mockInspectionId, 'admin-id');
      expect(result.status).toBe(InspectionStatus.ARCHIVED);
    });

    it('should remain APPROVED when blockchain minting fails', async () => {
      mockPrismaService.inspection.findUnique.mockResolvedValue(mockApprovedInspection);

      const blockchainSvcMock = {
        mintInspectionNft: jest.fn().mockRejectedValue(new Error('Blockchain error')),
      };
      const module = await Test.createTestingModule({
        providers: [
          InspectionsService,
          { provide: PrismaService, useValue: mockPrismaService },
          { provide: BlockchainService, useValue: blockchainSvcMock },
          { provide: ConfigService, useValue: mockConfigService },
          { provide: IpfsService, useValue: mockIpfsService },
          { provide: RedisService, useValue: mockRedisService },
        ],
      }).compile();
      const svc = module.get<InspectionsService>(InspectionsService);

      mockPrismaService.inspection.update.mockResolvedValue({
        ...mockApprovedInspection,
        status: InspectionStatus.APPROVED,
      });

      const result = await svc.processToArchive(mockInspectionId, 'admin-id');
      expect(result.status).toBe(InspectionStatus.APPROVED);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // findLatestArchivedInspections
  // ─────────────────────────────────────────────────────────────────────────
  describe('findLatestArchivedInspections', () => {
    it('should return latest archived inspections with photos', async () => {
      const archivedWithPhotos = [
        { ...mockArchivedInspection, photos: [{ id: 'p1', label: 'Tampak Depan', path: 'photo.jpg' }] },
      ];
      mockPrismaService.inspection.findMany.mockResolvedValue(archivedWithPhotos);

      const result = await service.findLatestArchivedInspections();
      expect(result).toHaveLength(1);
      expect((result[0] as any).photos).toHaveLength(1);
    });

    it('should filter out inspections without Tampak Depan photo', async () => {
      const archivedWithoutPhotos = [
        { ...mockArchivedInspection, photos: [] },
      ];
      mockPrismaService.inspection.findMany.mockResolvedValue(archivedWithoutPhotos);

      const result = await service.findLatestArchivedInspections();
      expect(result).toHaveLength(0);
    });

    it('should throw InternalServerErrorException on DB error', async () => {
      mockPrismaService.inspection.findMany.mockRejectedValue(new Error('DB error'));
      await expect(service.findLatestArchivedInspections()).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // deleteInspectionPermanently
  // ─────────────────────────────────────────────────────────────────────────
  describe('deleteInspectionPermanently', () => {
    it('should throw NotFoundException when inspection not found', async () => {
      mockPrismaService.inspection.findUnique.mockResolvedValue(null);
      await expect(service.deleteInspectionPermanently('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should delete inspection and associated records successfully', async () => {
      const inspectionWithPhotos = {
        ...mockArchivedInspection,
        photos: [{ id: 'p1', path: 'photo.jpg' }],
        urlPdf: '/pdfarchived/test.pdf',
        urlPdfNoDocs: '/pdfarchived/test-no-docs.pdf',
      };
      mockPrismaService.inspection.findUnique.mockResolvedValue(inspectionWithPhotos);

      const txMock = {
        inspectionChangeLog: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
        photo: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
        inspection: { delete: jest.fn().mockResolvedValue({}) },
      };
      mockPrismaService.$transaction.mockImplementation((cb) => cb(txMock));

      await expect(service.deleteInspectionPermanently('mock-archived-id')).resolves.toBeUndefined();
      expect(txMock.inspection.delete).toHaveBeenCalledWith({ where: { id: 'mock-archived-id' } });
    });

    it('should throw InternalServerErrorException on transaction failure', async () => {
      const inspectionWithPhotos = {
        ...mockArchivedInspection,
        photos: [],
        urlPdf: null,
        urlPdfNoDocs: null,
      };
      mockPrismaService.inspection.findUnique.mockResolvedValue(inspectionWithPhotos);
      mockPrismaService.$transaction.mockRejectedValue(new Error('Transaction failed'));

      await expect(service.deleteInspectionPermanently('mock-archived-id')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // rollbackInspectionStatus
  // ─────────────────────────────────────────────────────────────────────────
  describe('rollbackInspectionStatus', () => {
    it('should rollback inspection status to NEED_REVIEW', async () => {
      const rolledBack = { ...mockArchivedInspection, status: InspectionStatus.NEED_REVIEW };
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

      const result = await service.rollbackInspectionStatus('mock-archived-id', 'superadmin-id');
      expect(result.status).toBe(InspectionStatus.NEED_REVIEW);
    });

    it('should throw NotFoundException when inspection not found', async () => {
      mockPrismaService.$transaction.mockImplementation(async (cb) => {
        const tx = {
          inspection: { findUnique: jest.fn().mockResolvedValue(null) },
        };
        return cb(tx);
      });

      await expect(service.rollbackInspectionStatus('nonexistent', 'superadmin-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when inspection is already NEED_REVIEW', async () => {
      mockPrismaService.$transaction.mockImplementation(async (cb) => {
        const tx = {
          inspection: { findUnique: jest.fn().mockResolvedValue(mockInspection) }, // NEED_REVIEW
        };
        return cb(tx);
      });

      await expect(service.rollbackInspectionStatus(mockInspectionId, 'superadmin-id')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // revertInspectionToApproved
  // ─────────────────────────────────────────────────────────────────────────
  describe('revertInspectionToApproved', () => {
    it('should revert ARCHIVED inspection to APPROVED', async () => {
      const reverted = { ...mockArchivedInspection, status: InspectionStatus.APPROVED };
      mockPrismaService.$transaction.mockImplementation(async (cb) => {
        const tx = {
          inspection: {
            findUnique: jest.fn().mockResolvedValue(mockArchivedInspection),
            update: jest.fn().mockResolvedValue(reverted),
          },
          inspectionChangeLog: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return cb(tx);
      });

      const result = await service.revertInspectionToApproved('mock-archived-id', 'superadmin-id');
      expect(result.status).toBe(InspectionStatus.APPROVED);
    });

    it('should throw NotFoundException when inspection not found', async () => {
      mockPrismaService.$transaction.mockImplementation(async (cb) => {
        const tx = {
          inspection: { findUnique: jest.fn().mockResolvedValue(null) },
        };
        return cb(tx);
      });

      await expect(
        service.revertInspectionToApproved('nonexistent', 'superadmin-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when status is NEED_REVIEW (not ARCHIVED/FAIL_ARCHIVE)', async () => {
      mockPrismaService.$transaction.mockImplementation(async (cb) => {
        const tx = {
          inspection: { findUnique: jest.fn().mockResolvedValue(mockInspection) }, // NEED_REVIEW
        };
        return cb(tx);
      });

      await expect(
        service.revertInspectionToApproved(mockInspectionId, 'superadmin-id'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // confirmArchive
  // ─────────────────────────────────────────────────────────────────────────
  describe('confirmArchive', () => {
    const mockConfirmDto = { txHash: 'tx-hash-123', nftAssetId: 'asset-123' };

    it('should confirm archive and return updated inspection', async () => {
      mockPrismaService.inspection.findUnique.mockResolvedValue(mockArchivedInspection);
      mockPrismaService.inspection.update.mockResolvedValue({
        ...mockArchivedInspection,
        status: InspectionStatus.ARCHIVED,
        blockchainTxHash: 'tx-hash-123',
        nftAssetId: 'asset-123',
      });

      const result = await service.confirmArchive('mock-archived-id', mockConfirmDto);
      expect(result.status).toBe(InspectionStatus.ARCHIVED);
      expect(result.blockchainTxHash).toBe('tx-hash-123');
    });

    it('should throw NotFoundException when inspection not found', async () => {
      mockPrismaService.inspection.findUnique.mockResolvedValue(null);
      await expect(service.confirmArchive('nonexistent', mockConfirmDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // bulkApproveInspections
  // ─────────────────────────────────────────────────────────────────────────
  describe('bulkApproveInspections', () => {
    it('should return successful and failed results', async () => {
      jest.spyOn(service, 'approveInspection')
        .mockResolvedValueOnce({ ...mockInspection, status: InspectionStatus.APPROVED } as any)
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
    }, 10000);

    it('should return all successful when all approvals succeed', async () => {
      jest.spyOn(service, 'approveInspection')
        .mockResolvedValue({ ...mockInspection, status: InspectionStatus.APPROVED } as any);

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
  // getQueueStats
  // ─────────────────────────────────────────────────────────────────────────
  describe('getQueueStats', () => {
    it('should return pdf and blockchain queue stats', () => {
      const stats = service.getQueueStats();
      expect(stats).toHaveProperty('pdfQueue');
      expect(stats).toHaveProperty('blockchainQueue');
      expect(stats.pdfQueue).toHaveProperty('queueLength');
      expect(stats.pdfQueue).toHaveProperty('running');
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
            findUniqueOrThrow: jest.fn().mockResolvedValue(inspectionAfterChanges),
            update: jest.fn().mockResolvedValue(inspectionAfterChanges),
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
            findUniqueOrThrow: jest.fn().mockResolvedValue(inspectionAfterChanges),
            update: jest.fn().mockResolvedValue(inspectionAfterChanges),
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

