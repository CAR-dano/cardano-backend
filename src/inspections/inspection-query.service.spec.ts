/* eslint-disable @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
import { InspectionQueryService } from './inspection-query.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import {
  Inspection,
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

const mockInspection = {
  id: mockInspectionId,
  pretty_id: 'YOG-13082025-001',
  vehiclePlateNumber: 'AB 1234 CD',
  inspectionDate: new Date('2025-08-13'),
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
  createdAt: new Date('2025-08-13T10:00:00.000Z'),
  updatedAt: new Date('2025-08-13T10:00:00.000Z'),
  urlPdf: null,
  blockchainTxHash: null,
} as unknown as Inspection;

const mockArchivedInspection = {
  ...mockInspection,
  id: 'mock-archived-id',
  status: InspectionStatus.ARCHIVED,
  urlPdf: '/pdf/mock.pdf',
  pdfFileHash: 'abc123',
  archivedAt: new Date('2025-08-14T10:00:00.000Z'),
} as unknown as Inspection;

// ─── Mock Services ───────────────────────────────────────────────────────────

const mockPrismaService = {
  inspection: {
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  $queryRaw: jest.fn(),
};

const mockRedisService = {
  isHealthy: jest.fn().mockResolvedValue(true),
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  incr: jest.fn().mockResolvedValue(1),
};

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe('InspectionQueryService', () => {
  let service: InspectionQueryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InspectionQueryService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    service = module.get<InspectionQueryService>(InspectionQueryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // invalidateListCache
  // ─────────────────────────────────────────────────────────────────────────
  describe('invalidateListCache', () => {
    it('should increment the list version key in Redis', async () => {
      await service.invalidateListCache();
      expect(mockRedisService.incr).toHaveBeenCalledWith(
        'inspections:list_version',
      );
    });

    it('should not throw when Redis fails', async () => {
      mockRedisService.incr.mockRejectedValueOnce(new Error('Redis down'));
      await expect(service.invalidateListCache()).resolves.toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // findAll
  // ─────────────────────────────────────────────────────────────────────────
  describe('findAll', () => {
    beforeEach(() => {
      // Default: cache miss
      mockRedisService.get.mockResolvedValue(null);
    });

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
          where: expect.not.objectContaining({
            status: InspectionStatus.ARCHIVED,
          }),
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
          where: expect.objectContaining({
            status: InspectionStatus.ARCHIVED,
          }),
        }),
      );
    });

    it('should default to ARCHIVED status for DEVELOPER role', async () => {
      mockPrismaService.inspection.count.mockResolvedValue(0);
      mockPrismaService.inspection.findMany.mockResolvedValue([]);

      await service.findAll(Role.DEVELOPER, undefined, 1, 10);

      expect(mockPrismaService.inspection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: InspectionStatus.ARCHIVED,
          }),
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

    it('should handle comma-separated status strings', async () => {
      mockPrismaService.inspection.count.mockResolvedValue(3);
      mockPrismaService.inspection.findMany.mockResolvedValue([]);

      await service.findAll(Role.ADMIN, 'ARCHIVED,APPROVED', 1, 10);

      expect(mockPrismaService.inspection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: {
              in: [InspectionStatus.ARCHIVED, InspectionStatus.APPROVED],
            },
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

    it('should handle array status parameter', async () => {
      mockPrismaService.inspection.count.mockResolvedValue(1);
      mockPrismaService.inspection.findMany.mockResolvedValue([]);

      await service.findAll(
        Role.ADMIN,
        [InspectionStatus.ARCHIVED, InspectionStatus.APPROVED],
        1,
        10,
      );

      expect(mockPrismaService.inspection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: {
              in: [InspectionStatus.ARCHIVED, InspectionStatus.APPROVED],
            },
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

    it('should return cached result when cache hits', async () => {
      const cachedResult = {
        data: [mockInspection],
        meta: { total: 1, page: 1, pageSize: 10, totalPages: 1 },
      };
      const serialized = JSON.stringify(cachedResult);
      mockRedisService.get
        .mockResolvedValueOnce('0') // version
        .mockResolvedValueOnce(serialized); // cache hit

      const result = await service.findAll(Role.ADMIN, undefined, 1, 10);

      // Cache returns JSON-parsed data (dates become strings), so compare with parsed version
      expect(result).toEqual(JSON.parse(serialized));
      expect(mockPrismaService.inspection.findMany).not.toHaveBeenCalled();
    });

    it('should cache result after DB query', async () => {
      mockPrismaService.inspection.count.mockResolvedValue(1);
      mockPrismaService.inspection.findMany.mockResolvedValue([mockInspection]);

      await service.findAll(Role.ADMIN, undefined, 1, 10);

      expect(mockRedisService.set).toHaveBeenCalledWith(
        expect.stringContaining('inspections:list:'),
        expect.any(String),
        300,
      );
    });

    it('should not throw when cache set fails', async () => {
      mockPrismaService.inspection.count.mockResolvedValue(1);
      mockPrismaService.inspection.findMany.mockResolvedValue([mockInspection]);
      mockRedisService.set.mockRejectedValueOnce(new Error('Redis error'));

      const result = await service.findAll(Role.ADMIN, undefined, 1, 10);
      expect(result.data).toHaveLength(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // findOne
  // ─────────────────────────────────────────────────────────────────────────
  describe('findOne', () => {
    beforeEach(() => {
      mockRedisService.get.mockResolvedValue(null);
      mockRedisService.isHealthy.mockResolvedValue(true);
    });

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

    it('should return any inspection for SUPERADMIN role', async () => {
      mockPrismaService.inspection.findUniqueOrThrow.mockResolvedValue(
        mockInspection,
      );

      const result = await service.findOne(mockInspectionId, Role.SUPERADMIN);

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

    it('should return cached result when cache hits', async () => {
      const serialized = JSON.stringify(mockInspection);
      mockRedisService.get
        .mockResolvedValueOnce('0') // version
        .mockResolvedValueOnce(serialized); // cache hit

      const result = await service.findOne(mockInspectionId, Role.ADMIN);

      // Cache returns JSON-parsed data (dates become strings), so compare with parsed version
      expect(result).toEqual(JSON.parse(serialized));
      expect(
        mockPrismaService.inspection.findUniqueOrThrow,
      ).not.toHaveBeenCalled();
    });

    it('should cache result after DB query', async () => {
      mockPrismaService.inspection.findUniqueOrThrow.mockResolvedValue(
        mockArchivedInspection,
      );

      await service.findOne('mock-archived-id', Role.ADMIN);

      expect(mockRedisService.set).toHaveBeenCalledWith(
        expect.stringContaining('inspections:detail:'),
        expect.any(String),
        300,
      );
    });

    it('should gracefully handle Redis unhealthy state', async () => {
      mockRedisService.isHealthy.mockResolvedValue(false);
      mockPrismaService.inspection.findUniqueOrThrow.mockResolvedValue(
        mockArchivedInspection,
      );

      const result = await service.findOne('mock-archived-id', Role.ADMIN);

      expect(result.status).toBe(InspectionStatus.ARCHIVED);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // findByVehiclePlateNumber
  // ─────────────────────────────────────────────────────────────────────────
  describe('findByVehiclePlateNumber', () => {
    beforeEach(() => {
      mockRedisService.get.mockResolvedValue(null);
    });

    it('should return cached result when cache hits', async () => {
      const cachedData = {
        id: 'cached-id',
        vehiclePlateNumber: 'AB 1234 CD',
      };
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

      const dbRow = {
        id: 'db-id',
        vehiclePlateNumber: 'AB 1234 CD',
        status: 'ARCHIVED',
      };
      mockPrismaService.$queryRaw.mockResolvedValue([dbRow]);

      const result = await service.findByVehiclePlateNumber('AB 1234 CD');
      expect(result).toEqual(dbRow);
    });

    it('should return null when no row found', async () => {
      mockRedisService.get
        .mockResolvedValueOnce('0')
        .mockResolvedValueOnce(null);

      mockPrismaService.$queryRaw.mockResolvedValue([]);

      const result = await service.findByVehiclePlateNumber('UNKNOWN 999');
      expect(result).toBeNull();
    });

    it('should cache result after DB query', async () => {
      mockRedisService.get
        .mockResolvedValueOnce('0')
        .mockResolvedValueOnce(null);

      const dbRow = {
        id: 'db-id',
        vehiclePlateNumber: 'AB 1234 CD',
        status: 'ARCHIVED',
      };
      mockPrismaService.$queryRaw.mockResolvedValue([dbRow]);

      await service.findByVehiclePlateNumber('AB 1234 CD');

      expect(mockRedisService.set).toHaveBeenCalledWith(
        expect.stringContaining('inspections:search:plate:'),
        expect.any(String),
        300,
      );
    });

    it('should throw InternalServerErrorException on DB error', async () => {
      mockRedisService.get
        .mockResolvedValueOnce('0')
        .mockResolvedValueOnce(null);

      mockPrismaService.$queryRaw.mockRejectedValue(new Error('DB error'));

      await expect(
        service.findByVehiclePlateNumber('AB 1234 CD'),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should not throw when cache retrieval fails', async () => {
      mockRedisService.get
        .mockResolvedValueOnce('0')
        .mockRejectedValueOnce(new Error('Redis error'));

      const dbRow = {
        id: 'db-id',
        vehiclePlateNumber: 'AB 1234 CD',
        status: 'ARCHIVED',
      };
      mockPrismaService.$queryRaw.mockResolvedValue([dbRow]);

      const result = await service.findByVehiclePlateNumber('AB 1234 CD');
      expect(result).toEqual(dbRow);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // searchByKeyword
  // ─────────────────────────────────────────────────────────────────────────
  describe('searchByKeyword', () => {
    beforeEach(() => {
      mockRedisService.get.mockResolvedValue(null);
    });

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
      mockPrismaService.inspection.count.mockResolvedValue(1);
      mockPrismaService.inspection.findMany.mockResolvedValue([mockInspection]);

      await service.searchByKeyword('YOG');

      const callArgs =
        mockPrismaService.inspection.findMany.mock.calls[0][0];
      const orConditions = callArgs.where.OR;
      expect(orConditions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ pretty_id: expect.any(Object) }),
        ]),
      );
    });

    it('should search by vehiclePlateNumber (case-insensitive)', async () => {
      mockPrismaService.inspection.count.mockResolvedValue(1);
      mockPrismaService.inspection.findMany.mockResolvedValue([mockInspection]);

      await service.searchByKeyword('ab 1234');

      const callArgs =
        mockPrismaService.inspection.findMany.mock.calls[0][0];
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
      mockPrismaService.inspection.count.mockResolvedValue(1);
      mockPrismaService.inspection.findMany.mockResolvedValue([mockInspection]);

      await service.searchByKeyword('Toyota');

      const callArgs =
        mockPrismaService.inspection.findMany.mock.calls[0][0];
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
      mockPrismaService.inspection.count.mockResolvedValue(1);
      mockPrismaService.inspection.findMany.mockResolvedValue([mockInspection]);

      await service.searchByKeyword('Mock Customer');

      const callArgs =
        mockPrismaService.inspection.findMany.mock.calls[0][0];
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
      mockPrismaService.inspection.count.mockResolvedValue(0);
      mockPrismaService.inspection.findMany.mockResolvedValue([]);

      await service.searchByKeyword('test');

      expect(mockPrismaService.inspection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('should return correct pagination meta', async () => {
      mockPrismaService.inspection.count.mockResolvedValue(25);
      mockPrismaService.inspection.findMany.mockResolvedValue([]);

      const result = await service.searchByKeyword('test', 2, 10);

      expect(result.meta.total).toBe(25);
      expect(result.meta.page).toBe(2);
      expect(result.meta.pageSize).toBe(10);
      expect(result.meta.totalPages).toBe(3);
    });

    it('should throw InternalServerErrorException on DB error', async () => {
      mockPrismaService.inspection.findMany.mockRejectedValue(
        new Error('DB error'),
      );

      await expect(service.searchByKeyword('test')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should return cached result when cache hits', async () => {
      const cachedResult = {
        data: [mockInspection],
        meta: { total: 1, page: 1, pageSize: 10, totalPages: 1 },
      };
      const serialized = JSON.stringify(cachedResult);
      mockRedisService.get
        .mockResolvedValueOnce('0') // version
        .mockResolvedValueOnce(serialized); // cache hit

      const result = await service.searchByKeyword('Toyota', 1, 10);

      // Cache returns JSON-parsed data (dates become strings), so compare with parsed version
      expect(result).toEqual(JSON.parse(serialized));
      expect(mockPrismaService.inspection.findMany).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // findLatestArchivedInspections
  // ─────────────────────────────────────────────────────────────────────────
  describe('findLatestArchivedInspections', () => {
    it('should return latest archived inspections with photos', async () => {
      const archivedWithPhotos = [
        {
          ...mockArchivedInspection,
          photos: [
            { id: 'p1', label: 'Tampak Depan', path: 'photo.jpg' },
          ],
        },
      ];
      mockPrismaService.inspection.findMany.mockResolvedValue(
        archivedWithPhotos,
      );

      const result = await service.findLatestArchivedInspections();
      expect(result).toHaveLength(1);
      expect((result[0] as any).photos).toHaveLength(1);
    });

    it('should filter out inspections without Tampak Depan photo', async () => {
      const archivedWithoutPhotos = [
        { ...mockArchivedInspection, photos: [] },
      ];
      mockPrismaService.inspection.findMany.mockResolvedValue(
        archivedWithoutPhotos,
      );

      const result = await service.findLatestArchivedInspections();
      expect(result).toHaveLength(0);
    });

    it('should query with ARCHIVED status and Tampak Depan photo filter', async () => {
      mockPrismaService.inspection.findMany.mockResolvedValue([]);

      await service.findLatestArchivedInspections();

      expect(mockPrismaService.inspection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: InspectionStatus.ARCHIVED,
            photos: { some: { label: 'Tampak Depan' } },
          }),
          take: 5,
          orderBy: { archivedAt: 'desc' },
        }),
      );
    });

    it('should return multiple inspections up to limit of 5', async () => {
      const inspections = Array.from({ length: 5 }, (_, i) => ({
        ...mockArchivedInspection,
        id: `archived-${i}`,
        photos: [{ id: `p${i}`, label: 'Tampak Depan', path: `photo${i}.jpg` }],
      }));
      mockPrismaService.inspection.findMany.mockResolvedValue(inspections);

      const result = await service.findLatestArchivedInspections();
      expect(result).toHaveLength(5);
    });

    it('should throw InternalServerErrorException on DB error', async () => {
      mockPrismaService.inspection.findMany.mockRejectedValue(
        new Error('DB error'),
      );
      await expect(
        service.findLatestArchivedInspections(),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });
});
