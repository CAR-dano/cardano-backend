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
  $queryRawUnsafe: jest.fn(),
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

    it('should query DB and return optimized result on cache miss', async () => {
      mockRedisService.get
        .mockResolvedValueOnce('0') // version
        .mockResolvedValueOnce(null); // cache miss

      const dbRow = {
        id: 'db-id',
        vehiclePlateNumber: 'AB 1234 CD',
        status: 'ARCHIVED',
        identityDetails: { namaCustomer: 'Test', namaInspektor: 'Inspector' },
        vehicleData: { merekKendaraan: 'Toyota', tipeKendaraan: 'Avanza' },
        inspectionDate: new Date(),
        urlPdf: null,
      };
      mockPrismaService.$queryRaw.mockResolvedValue([dbRow]);

      const result = await service.findByVehiclePlateNumber('AB 1234 CD');
      
      // Should return optimized structure
      expect(result).toHaveProperty('id', 'db-id');
      expect(result).toHaveProperty('vehiclePlateNumber', 'AB 1234 CD');
      expect(result).toHaveProperty('status', 'ARCHIVED');
      expect(result).toHaveProperty('identityDetails');
      expect(result).toHaveProperty('vehicleData');
      expect(result).toHaveProperty('inspectionDate');
      expect(result).toHaveProperty('urlPdf');
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

    it('should not throw when cache retrieval fails and return optimized result', async () => {
      mockRedisService.get
        .mockResolvedValueOnce('0')
        .mockRejectedValueOnce(new Error('Redis error'));

      const dbRow = {
        id: 'db-id',
        vehiclePlateNumber: 'AB 1234 CD',
        status: 'ARCHIVED',
        identityDetails: { namaCustomer: 'Test', namaInspektor: 'Inspector' },
        vehicleData: { merekKendaraan: 'Toyota', tipeKendaraan: 'Avanza' },
        inspectionDate: new Date(),
        urlPdf: null,
      };
      mockPrismaService.$queryRaw.mockResolvedValue([dbRow]);

      const result = await service.findByVehiclePlateNumber('AB 1234 CD');
      
      // Should return optimized structure even when cache fails
      expect(result).toHaveProperty('id', 'db-id');
      expect(result).toHaveProperty('vehiclePlateNumber', 'AB 1234 CD');
      expect(result).toHaveProperty('status', 'ARCHIVED');
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
      expect(mockPrismaService.$queryRawUnsafe).not.toHaveBeenCalled();
    });

    it('should return empty data for whitespace-only keyword', async () => {
      const result = await service.searchByKeyword('   ');

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(mockPrismaService.$queryRawUnsafe).not.toHaveBeenCalled();
    });

    it('should use $queryRawUnsafe for FTS search instead of findMany', async () => {
      mockPrismaService.$queryRawUnsafe
        .mockResolvedValueOnce([{ total: BigInt(1) }])
        .mockResolvedValueOnce([mockInspection]);

      await service.searchByKeyword('Toyota');

      expect(mockPrismaService.$queryRawUnsafe).toHaveBeenCalled();
      expect(mockPrismaService.inspection.findMany).not.toHaveBeenCalled();
    });

    it('should return search results with correct pagination', async () => {
      mockPrismaService.$queryRawUnsafe
        .mockResolvedValueOnce([{ total: BigInt(25) }])
        .mockResolvedValueOnce([mockInspection]);

      const result = await service.searchByKeyword('test', 2, 10);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(25);
      expect(result.meta.page).toBe(2);
      expect(result.meta.pageSize).toBe(10);
      expect(result.meta.totalPages).toBe(3);
    });

    it('should return empty result when no matches found', async () => {
      mockPrismaService.$queryRawUnsafe
        .mockResolvedValueOnce([{ total: BigInt(0) }])
        .mockResolvedValueOnce([]);

      const result = await service.searchByKeyword('nonexistent');

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
      expect(mockPrismaService.$queryRawUnsafe).toHaveBeenCalledTimes(1);
    });

    it('should return empty data when count is 0 (skip data query)', async () => {
      mockPrismaService.$queryRawUnsafe.mockResolvedValueOnce([{ total: BigInt(0) }]);

      const result = await service.searchByKeyword('nonexistent');

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(mockPrismaService.$queryRawUnsafe).toHaveBeenCalledTimes(1);
    });

    it('should throw InternalServerErrorException on DB error', async () => {
      mockPrismaService.$queryRawUnsafe.mockReset();
      mockPrismaService.$queryRawUnsafe.mockRejectedValue(new Error('DB error'));

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
        .mockResolvedValueOnce('0')
        .mockResolvedValueOnce(serialized);

      const result = await service.searchByKeyword('Toyota', 1, 10);

      expect(result).toEqual(JSON.parse(serialized));
      expect(mockPrismaService.$queryRawUnsafe).not.toHaveBeenCalled();
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

  // ─────────────────────────────────────────────────────────────────────────
  // optimizeListPayload (Payload Optimization Tests)
  // ─────────────────────────────────────────────────────────────────────────
  describe('optimizeListPayload', () => {
    it('should remove unused root-level fields (pretty_id, createdAt, updatedAt, blockchainTxHash)', async () => {
      mockPrismaService.inspection.count.mockResolvedValue(1);
      mockPrismaService.inspection.findMany.mockResolvedValue([mockInspection]);

      const result = await service.findAll(Role.ADMIN, undefined, 1, 10);
      const inspection = result.data[0];

      // Should keep only required root fields
      expect(inspection).toHaveProperty('id');
      expect(inspection).toHaveProperty('vehiclePlateNumber');
      expect(inspection).toHaveProperty('inspectionDate');
      expect(inspection).toHaveProperty('status');
      expect(inspection).toHaveProperty('urlPdf');
      expect(inspection).toHaveProperty('identityDetails');
      expect(inspection).toHaveProperty('vehicleData');

      // Should NOT have these fields
      expect(inspection).not.toHaveProperty('pretty_id');
      expect(inspection).not.toHaveProperty('createdAt');
      expect(inspection).not.toHaveProperty('updatedAt');
      expect(inspection).not.toHaveProperty('blockchainTxHash');
    });

    it('should filter identityDetails to only include namaCustomer and namaInspektor', async () => {
      const inspectionWithFullIdentity = {
        ...mockInspection,
        identityDetails: {
          namaInspektor: 'Mock Inspector',
          namaCustomer: 'Mock Customer',
          cabangInspeksi: 'Yogyakarta', // Should be removed
          alamatCustomer: 'Jl. Mock Street', // Should be removed
          nomorTelepon: '08123456789', // Should be removed
          email: 'mock@example.com', // Should be removed
          nik: '1234567890123456', // Should be removed
        } as Prisma.JsonObject,
      };

      mockPrismaService.inspection.count.mockResolvedValue(1);
      mockPrismaService.inspection.findMany.mockResolvedValue([
        inspectionWithFullIdentity,
      ]);

      const result = await service.findAll(Role.ADMIN, undefined, 1, 10);
      const identityDetails = result.data[0].identityDetails;

      // Should only have these 2 fields
      expect(Object.keys(identityDetails)).toHaveLength(2);
      expect(identityDetails).toHaveProperty('namaCustomer', 'Mock Customer');
      expect(identityDetails).toHaveProperty('namaInspektor', 'Mock Inspector');

      // Should NOT have these fields
      expect(identityDetails).not.toHaveProperty('cabangInspeksi');
      expect(identityDetails).not.toHaveProperty('alamatCustomer');
      expect(identityDetails).not.toHaveProperty('nomorTelepon');
      expect(identityDetails).not.toHaveProperty('email');
      expect(identityDetails).not.toHaveProperty('nik');
    });

    it('should filter vehicleData to only include merekKendaraan and tipeKendaraan', async () => {
      const inspectionWithFullVehicle = {
        ...mockInspection,
        vehicleData: {
          merekKendaraan: 'Toyota',
          tipeKendaraan: 'Avanza',
          tahunPembuatan: 2020, // Should be removed
          warna: 'Silver', // Should be removed
          nomorRangka: 'MH123456', // Should be removed
          nomorMesin: 'ABC123', // Should be removed
          kapasitasMesin: 1500, // Should be removed
          bahanBakar: 'Bensin', // Should be removed
        } as Prisma.JsonObject,
      };

      mockPrismaService.inspection.count.mockResolvedValue(1);
      mockPrismaService.inspection.findMany.mockResolvedValue([
        inspectionWithFullVehicle,
      ]);

      const result = await service.findAll(Role.ADMIN, undefined, 1, 10);
      const vehicleData = result.data[0].vehicleData;

      // Should only have these 2 fields
      expect(Object.keys(vehicleData)).toHaveLength(2);
      expect(vehicleData).toHaveProperty('merekKendaraan', 'Toyota');
      expect(vehicleData).toHaveProperty('tipeKendaraan', 'Avanza');

      // Should NOT have these fields
      expect(vehicleData).not.toHaveProperty('tahunPembuatan');
      expect(vehicleData).not.toHaveProperty('warna');
      expect(vehicleData).not.toHaveProperty('nomorRangka');
      expect(vehicleData).not.toHaveProperty('nomorMesin');
      expect(vehicleData).not.toHaveProperty('kapasitasMesin');
      expect(vehicleData).not.toHaveProperty('bahanBakar');
    });

    it('should handle null identityDetails gracefully', async () => {
      const inspectionWithNullIdentity = {
        ...mockInspection,
        identityDetails: null,
      };

      mockPrismaService.inspection.count.mockResolvedValue(1);
      mockPrismaService.inspection.findMany.mockResolvedValue([
        inspectionWithNullIdentity,
      ]);

      const result = await service.findAll(Role.ADMIN, undefined, 1, 10);
      expect(result.data[0].identityDetails).toBeNull();
    });

    it('should handle null vehicleData gracefully', async () => {
      const inspectionWithNullVehicle = {
        ...mockInspection,
        vehicleData: null,
      };

      mockPrismaService.inspection.count.mockResolvedValue(1);
      mockPrismaService.inspection.findMany.mockResolvedValue([
        inspectionWithNullVehicle,
      ]);

      const result = await service.findAll(Role.ADMIN, undefined, 1, 10);
      expect(result.data[0].vehicleData).toBeNull();
    });

    it('should handle missing fields in identityDetails (use null as default)', async () => {
      const inspectionWithPartialIdentity = {
        ...mockInspection,
        identityDetails: {
          namaCustomer: 'John Doe',
          // namaInspektor is missing
        } as Prisma.JsonObject,
      };

      mockPrismaService.inspection.count.mockResolvedValue(1);
      mockPrismaService.inspection.findMany.mockResolvedValue([
        inspectionWithPartialIdentity,
      ]);

      const result = await service.findAll(Role.ADMIN, undefined, 1, 10);
      const identityDetails = result.data[0].identityDetails;

      expect(identityDetails.namaCustomer).toBe('John Doe');
      expect(identityDetails.namaInspektor).toBeNull();
    });

    it('should handle missing fields in vehicleData (use null as default)', async () => {
      const inspectionWithPartialVehicle = {
        ...mockInspection,
        vehicleData: {
          merekKendaraan: 'Honda',
          // tipeKendaraan is missing
        } as Prisma.JsonObject,
      };

      mockPrismaService.inspection.count.mockResolvedValue(1);
      mockPrismaService.inspection.findMany.mockResolvedValue([
        inspectionWithPartialVehicle,
      ]);

      const result = await service.findAll(Role.ADMIN, undefined, 1, 10);
      const vehicleData = result.data[0].vehicleData;

      expect(vehicleData.merekKendaraan).toBe('Honda');
      expect(vehicleData.tipeKendaraan).toBeNull();
    });

    it('should apply optimization to multiple inspections', async () => {
      const multipleInspections = [
        mockInspection,
        { ...mockInspection, id: 'id-2', vehiclePlateNumber: 'XY 9999 ZZ' },
        { ...mockInspection, id: 'id-3', vehiclePlateNumber: 'AB 5555 CD' },
      ];

      mockPrismaService.inspection.count.mockResolvedValue(3);
      mockPrismaService.inspection.findMany.mockResolvedValue(
        multipleInspections,
      );

      const result = await service.findAll(Role.ADMIN, undefined, 1, 10);

      expect(result.data).toHaveLength(3);
      result.data.forEach((inspection) => {
        // All should be optimized
        expect(inspection).not.toHaveProperty('pretty_id');
        expect(inspection).not.toHaveProperty('createdAt');
        expect(inspection).not.toHaveProperty('updatedAt');
        expect(inspection).not.toHaveProperty('blockchainTxHash');
        expect(Object.keys(inspection.identityDetails)).toHaveLength(2);
        expect(Object.keys(inspection.vehicleData)).toHaveLength(2);
      });
    });

    it('should apply optimization in searchByKeyword method', async () => {
      mockPrismaService.$queryRawUnsafe
        .mockResolvedValueOnce([{ total: BigInt(1) }])
        .mockResolvedValueOnce([mockInspection]);

      const result = await service.searchByKeyword('Toyota');
      const inspection = result.data[0];

      // Should be optimized
      expect(inspection).not.toHaveProperty('pretty_id');
      expect(inspection).not.toHaveProperty('createdAt');
      expect(Object.keys(inspection.identityDetails)).toHaveLength(2);
      expect(Object.keys(inspection.vehicleData)).toHaveLength(2);
    });

    it('should apply optimization in findByVehiclePlateNumber method', async () => {
      mockRedisService.get
        .mockResolvedValueOnce('0')
        .mockResolvedValueOnce(null);

      mockPrismaService.$queryRaw.mockResolvedValue([mockInspection]);

      const result = await service.findByVehiclePlateNumber('AB 1234 CD');

      // Should be optimized
      expect(result).not.toHaveProperty('pretty_id');
      expect(result).not.toHaveProperty('createdAt');
      expect(Object.keys(result.identityDetails)).toHaveLength(2);
      expect(Object.keys(result.vehicleData)).toHaveLength(2);
    });

    it('should maintain backward compatibility - nested structure unchanged', async () => {
      mockPrismaService.inspection.count.mockResolvedValue(1);
      mockPrismaService.inspection.findMany.mockResolvedValue([mockInspection]);

      const result = await service.findAll(Role.ADMIN, undefined, 1, 10);
      const inspection = result.data[0];

      // Structure should still be nested (not flattened)
      expect(typeof inspection.identityDetails).toBe('object');
      expect(typeof inspection.vehicleData).toBe('object');
      expect(inspection.identityDetails).toHaveProperty('namaCustomer');
      expect(inspection.identityDetails).toHaveProperty('namaInspektor');
      expect(inspection.vehicleData).toHaveProperty('merekKendaraan');
      expect(inspection.vehicleData).toHaveProperty('tipeKendaraan');
    });

    it('should reduce payload size significantly (integration verification)', async () => {
      const fullInspection = {
        ...mockInspection,
        identityDetails: {
          namaInspektor: 'Mock Inspector',
          namaCustomer: 'Mock Customer',
          cabangInspeksi: 'Yogyakarta',
          alamatCustomer: 'Jl. Long Street Name Number 123',
          nomorTelepon: '08123456789',
          email: 'customer@example.com',
          nik: '1234567890123456',
          pekerjaan: 'Software Engineer',
          tanggalLahir: '1990-01-01',
          jenisKelamin: 'Laki-laki',
        } as Prisma.JsonObject,
        vehicleData: {
          merekKendaraan: 'Toyota',
          tipeKendaraan: 'Avanza',
          tahunPembuatan: 2020,
          warna: 'Silver Metallic',
          nomorRangka: 'MH123456789ABCDEFG',
          nomorMesin: 'ABC123XYZ789',
          kapasitasMesin: 1500,
          bahanBakar: 'Bensin',
          transmisi: 'Manual',
          jumlahPenumpang: 7,
        } as Prisma.JsonObject,
      };

      mockPrismaService.inspection.count.mockResolvedValue(1);
      mockPrismaService.inspection.findMany.mockResolvedValue([fullInspection]);

      const result = await service.findAll(Role.ADMIN, undefined, 1, 10);
      const optimized = result.data[0];

      // Calculate approximate payload sizes (rough estimate)
      const originalSize = JSON.stringify(fullInspection).length;
      const optimizedSize = JSON.stringify(optimized).length;
      const reduction = ((originalSize - optimizedSize) / originalSize) * 100;

      // Should reduce by at least 40% (target is ~62%, but allows for variation)
      expect(reduction).toBeGreaterThan(40);
    });
  });
});
