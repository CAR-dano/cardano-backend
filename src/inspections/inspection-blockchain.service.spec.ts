/* eslint-disable @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
import { InspectionBlockchainService } from './inspection-blockchain.service';
import { PrismaService } from '../prisma/prisma.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { Inspection, InspectionStatus, Prisma } from '@prisma/client';
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

// ─── Shared Mock Data ───────────────────────────────────────────────────────

const mockInspectionId = 'mock-inspection-id';
const mockUserId = 'mock-admin-id';
const mockSuperAdminId = 'mock-superadmin-id';

const mockApprovedInspection = {
  id: mockInspectionId,
  pretty_id: 'YOG-13082025-001',
  inspectorId: 'mock-inspector-id',
  reviewerId: null,
  branchCityId: 'mock-branch-id',
  vehiclePlateNumber: 'AB 1234 CD',
  inspectionDate: new Date('2025-08-13'),
  overallRating: 85,
  status: InspectionStatus.APPROVED,
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
  urlPdf: '/pdf/mock.pdf',
  pdfFileHash: 'hash-abc',
  pdfFileHashNoDocs: 'hash-def-12345678',
  ipfsPdf: null,
  urlPdfNoDocs: null,
  ipfsPdfNoDocs: null,
  blockchainTxHash: null,
  nftAssetId: null,
  createdAt: new Date('2025-08-13T10:00:00.000Z'),
  updatedAt: new Date('2025-08-13T10:00:00.000Z'),
  archivedAt: null,
  deactivatedAt: null,
} as unknown as Inspection;

const mockArchivedInspection = {
  ...mockApprovedInspection,
  id: 'mock-archived-id',
  status: InspectionStatus.ARCHIVED,
  archivedAt: new Date('2025-08-14T10:00:00.000Z'),
  blockchainTxHash: 'tx-hash-123',
  nftAssetId: 'asset-456',
} as unknown as Inspection;

const mockDeactivatedInspection = {
  ...mockArchivedInspection,
  status: InspectionStatus.DEACTIVATED,
  deactivatedAt: new Date('2025-08-15T10:00:00.000Z'),
} as unknown as Inspection;

// ─── Mock Services ───────────────────────────────────────────────────────────

const mockPrismaService = {
  inspection: {
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  inspectionChangeLog: {
    create: jest.fn(),
  },
  $transaction: jest
    .fn()
    .mockImplementation((callback) => callback(mockPrismaService)),
};

const mockBlockchainService = {
  mintInspectionNft: jest.fn(),
  buildAikenMintTransaction: jest.fn(),
};

const mockConfigService = {
  get: jest.fn().mockReturnValue('http://localhost:3000'),
  getOrThrow: jest.fn().mockReturnValue('http://localhost:3000'),
};

const mockRedisService = {
  isHealthy: jest.fn().mockResolvedValue(true),
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  incr: jest.fn().mockResolvedValue(1),
};

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe('InspectionBlockchainService', () => {
  let service: InspectionBlockchainService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InspectionBlockchainService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: BlockchainService, useValue: mockBlockchainService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    service = module.get<InspectionBlockchainService>(
      InspectionBlockchainService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getQueueStats
  // ─────────────────────────────────────────────────────────────────────────
  describe('getQueueStats', () => {
    it('should return queue statistics with initial values', () => {
      const stats = service.getQueueStats();

      expect(stats).toHaveProperty('queueLength', 0);
      expect(stats).toHaveProperty('running', 0);
      expect(stats).toHaveProperty('totalProcessed', 0);
      expect(stats).toHaveProperty('totalErrors', 0);
      expect(stats).toHaveProperty('consecutiveErrors', 0);
      expect(stats).toHaveProperty('circuitBreakerOpen', false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // hashVehicleNumber
  // ─────────────────────────────────────────────────────────────────────────
  describe('hashVehicleNumber', () => {
    it('should return a SHA-256 hex string for a valid plate number', () => {
      const hash = service.hashVehicleNumber('AB 1234 CD');

      expect(hash).toHaveLength(64); // SHA-256 produces 64 hex chars
      expect(hash).toMatch(/^[a-f0-9]+$/);
    });

    it('should normalize input by trimming and uppercasing', () => {
      const hash1 = service.hashVehicleNumber('  ab 1234 cd  ');
      const hash2 = service.hashVehicleNumber('AB 1234 CD');

      expect(hash1).toBe(hash2);
    });

    it('should return empty string for empty input', () => {
      expect(service.hashVehicleNumber('')).toBe('');
    });

    it('should return empty string for null-like input', () => {
      expect(service.hashVehicleNumber(null as any)).toBe('');
      expect(service.hashVehicleNumber(undefined as any)).toBe('');
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = service.hashVehicleNumber('AB 1234 CD');
      const hash2 = service.hashVehicleNumber('XY 9876 ZZ');

      expect(hash1).not.toBe(hash2);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getVehicleNumberHashForMetadata
  // ─────────────────────────────────────────────────────────────────────────
  describe('getVehicleNumberHashForMetadata', () => {
    it('should return hash and algorithm', () => {
      const result = service.getVehicleNumberHashForMetadata('AB 1234 CD');

      expect(result).toHaveProperty('vehicleNumberHash');
      expect(result).toHaveProperty('vehicleNumberAlg', 'sha256');
      expect(result.vehicleNumberHash).toHaveLength(64);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // normalizeVehicleField
  // ─────────────────────────────────────────────────────────────────────────
  describe('normalizeVehicleField', () => {
    it('should trim, collapse spaces, and title-case', () => {
      expect(service.normalizeVehicleField('  toyota  avanza  ')).toBe(
        'Toyota Avanza',
      );
    });

    it('should return undefined for null input', () => {
      expect(service.normalizeVehicleField(null)).toBeUndefined();
    });

    it('should return undefined for undefined input', () => {
      expect(service.normalizeVehicleField(undefined)).toBeUndefined();
    });

    it('should return undefined for empty string input', () => {
      expect(service.normalizeVehicleField('')).toBeUndefined();
    });

    it('should handle single word', () => {
      expect(service.normalizeVehicleField('toyota')).toBe('Toyota');
    });

    it('should handle already title-cased input', () => {
      expect(service.normalizeVehicleField('Toyota Avanza')).toBe(
        'Toyota Avanza',
      );
    });

    it('should handle ALL CAPS input', () => {
      expect(service.normalizeVehicleField('TOYOTA AVANZA')).toBe(
        'Toyota Avanza',
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // processToArchive
  // ─────────────────────────────────────────────────────────────────────────
  describe('processToArchive', () => {
    it('should throw NotFoundException when inspection not found', async () => {
      mockPrismaService.inspection.findUnique.mockResolvedValue(null);

      await expect(
        service.processToArchive(mockInspectionId, mockUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when status is not APPROVED', async () => {
      mockPrismaService.inspection.findUnique.mockResolvedValue({
        ...mockApprovedInspection,
        status: InspectionStatus.NEED_REVIEW,
      });

      await expect(
        service.processToArchive(mockInspectionId, mockUserId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when vehiclePlateNumber is missing', async () => {
      mockPrismaService.inspection.findUnique.mockResolvedValue({
        ...mockApprovedInspection,
        vehiclePlateNumber: null,
      });

      await expect(
        service.processToArchive(mockInspectionId, mockUserId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when pdfFileHash is missing', async () => {
      mockPrismaService.inspection.findUnique.mockResolvedValue({
        ...mockApprovedInspection,
        pdfFileHash: null,
      });

      await expect(
        service.processToArchive(mockInspectionId, mockUserId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when pdfFileHashNoDocs is missing', async () => {
      mockPrismaService.inspection.findUnique.mockResolvedValue({
        ...mockApprovedInspection,
        pdfFileHashNoDocs: null,
      });

      await expect(
        service.processToArchive(mockInspectionId, mockUserId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should archive successfully when blockchain minting succeeds', async () => {
      mockPrismaService.inspection.findUnique.mockResolvedValue(
        mockApprovedInspection,
      );
      mockBlockchainService.mintInspectionNft.mockResolvedValue({
        txHash: 'tx-123',
        assetId: 'asset-456',
      });

      const archivedResult = {
        ...mockApprovedInspection,
        status: InspectionStatus.ARCHIVED,
        nftAssetId: 'asset-456',
        blockchainTxHash: 'tx-123',
        archivedAt: expect.any(Date),
      };
      mockPrismaService.inspection.update.mockResolvedValue(archivedResult);

      const result = await service.processToArchive(
        mockInspectionId,
        mockUserId,
      );

      expect(result.status).toBe(InspectionStatus.ARCHIVED);
      expect(mockBlockchainService.mintInspectionNft).toHaveBeenCalled();
      expect(mockPrismaService.inspection.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockInspectionId },
          data: expect.objectContaining({
            status: InspectionStatus.ARCHIVED,
          }),
        }),
      );
    });

    it('should remain APPROVED when blockchain minting fails', async () => {
      mockPrismaService.inspection.findUnique.mockResolvedValue(
        mockApprovedInspection,
      );
      mockBlockchainService.mintInspectionNft.mockRejectedValue(
        new Error('Blockchain error'),
      );

      mockPrismaService.inspection.update.mockResolvedValue({
        ...mockApprovedInspection,
        status: InspectionStatus.APPROVED,
      });

      const result = await service.processToArchive(
        mockInspectionId,
        mockUserId,
      );

      expect(result.status).toBe(InspectionStatus.APPROVED);
    });

    it('should invalidate list cache after successful archive', async () => {
      mockPrismaService.inspection.findUnique.mockResolvedValue(
        mockApprovedInspection,
      );
      mockBlockchainService.mintInspectionNft.mockResolvedValue({
        txHash: 'tx-123',
        assetId: 'asset-456',
      });
      mockPrismaService.inspection.update.mockResolvedValue({
        ...mockApprovedInspection,
        status: InspectionStatus.ARCHIVED,
      });

      await service.processToArchive(mockInspectionId, mockUserId);

      expect(mockRedisService.incr).toHaveBeenCalledWith(
        'inspections:list_version',
      );
    });

    it('should handle P2002 unique constraint conflict on nftAssetId gracefully', async () => {
      mockPrismaService.inspection.findUnique.mockResolvedValue(
        mockApprovedInspection,
      );
      mockBlockchainService.mintInspectionNft.mockResolvedValue({
        txHash: 'tx-123',
        assetId: 'asset-dup',
      });

      // First update throws P2002 on nft_asset_id
      const p2002Error = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '5.0.0',
          meta: { target: ['nft_asset_id'] },
        },
      );
      mockPrismaService.inspection.update
        .mockRejectedValueOnce(p2002Error) // first try fails
        .mockResolvedValueOnce({
          // retry without nftAssetId succeeds
          ...mockApprovedInspection,
          status: InspectionStatus.ARCHIVED,
        });

      const result = await service.processToArchive(
        mockInspectionId,
        mockUserId,
      );

      expect(result.status).toBe(InspectionStatus.ARCHIVED);
      expect(mockPrismaService.inspection.update).toHaveBeenCalledTimes(2);
    });

    it('should handle vehicleData stored as JSON string', async () => {
      const inspectionWithStringVehicleData = {
        ...mockApprovedInspection,
        vehicleData: JSON.stringify({
          merekKendaraan: 'Honda',
          tipeKendaraan: 'Civic',
        }),
      };
      mockPrismaService.inspection.findUnique.mockResolvedValue(
        inspectionWithStringVehicleData,
      );
      mockBlockchainService.mintInspectionNft.mockResolvedValue({
        txHash: 'tx-123',
        assetId: 'asset-456',
      });
      mockPrismaService.inspection.update.mockResolvedValue({
        ...inspectionWithStringVehicleData,
        status: InspectionStatus.ARCHIVED,
      });

      const result = await service.processToArchive(
        mockInspectionId,
        mockUserId,
      );

      expect(result.status).toBe(InspectionStatus.ARCHIVED);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // deactivateArchive
  // ─────────────────────────────────────────────────────────────────────────
  describe('deactivateArchive', () => {
    it('should deactivate an ARCHIVED inspection', async () => {
      const deactivated = {
        ...mockArchivedInspection,
        status: InspectionStatus.DEACTIVATED,
        deactivatedAt: new Date(),
      };
      mockPrismaService.inspection.update.mockResolvedValue(deactivated);

      const result = await service.deactivateArchive(
        'mock-archived-id',
        mockUserId,
      );

      expect(result.status).toBe(InspectionStatus.DEACTIVATED);
    });

    it('should throw NotFoundException when inspection not found (P2025)', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Not found',
        { code: 'P2025', clientVersion: '5.0.0' },
      );
      mockPrismaService.inspection.update.mockRejectedValue(prismaError);
      mockPrismaService.inspection.findUnique.mockResolvedValue(null);

      await expect(
        service.deactivateArchive('nonexistent', mockUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when inspection has wrong status (P2025)', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Not found',
        { code: 'P2025', clientVersion: '5.0.0' },
      );
      mockPrismaService.inspection.update.mockRejectedValue(prismaError);
      mockPrismaService.inspection.findUnique.mockResolvedValue({
        status: InspectionStatus.NEED_REVIEW,
      });

      await expect(
        service.deactivateArchive(mockInspectionId, mockUserId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw InternalServerErrorException on unknown DB error', async () => {
      mockPrismaService.inspection.update.mockRejectedValue(
        new Error('Unknown error'),
      );

      await expect(
        service.deactivateArchive(mockInspectionId, mockUserId),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should invalidate list cache after deactivation', async () => {
      mockPrismaService.inspection.update.mockResolvedValue({
        ...mockArchivedInspection,
        status: InspectionStatus.DEACTIVATED,
      });

      await service.deactivateArchive('mock-archived-id', mockUserId);

      expect(mockRedisService.incr).toHaveBeenCalledWith(
        'inspections:list_version',
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // activateArchive
  // ─────────────────────────────────────────────────────────────────────────
  describe('activateArchive', () => {
    it('should reactivate a DEACTIVATED inspection to ARCHIVED', async () => {
      const reactivated = {
        ...mockArchivedInspection,
        status: InspectionStatus.ARCHIVED,
        deactivatedAt: null,
      };
      mockPrismaService.inspection.update.mockResolvedValue(reactivated);

      const result = await service.activateArchive(
        mockInspectionId,
        mockUserId,
      );

      expect(result.status).toBe(InspectionStatus.ARCHIVED);
    });

    it('should throw NotFoundException when inspection not found (P2025)', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Not found',
        { code: 'P2025', clientVersion: '5.0.0' },
      );
      mockPrismaService.inspection.update.mockRejectedValue(prismaError);
      mockPrismaService.inspection.findUnique.mockResolvedValue(null);

      await expect(
        service.activateArchive('nonexistent', mockUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when inspection has wrong status', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Not found',
        { code: 'P2025', clientVersion: '5.0.0' },
      );
      mockPrismaService.inspection.update.mockRejectedValue(prismaError);
      mockPrismaService.inspection.findUnique.mockResolvedValue({
        status: InspectionStatus.APPROVED,
      });

      await expect(
        service.activateArchive(mockInspectionId, mockUserId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw InternalServerErrorException on unknown DB error', async () => {
      mockPrismaService.inspection.update.mockRejectedValue(
        new Error('Unknown error'),
      );

      await expect(
        service.activateArchive(mockInspectionId, mockUserId),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should invalidate list cache after reactivation', async () => {
      mockPrismaService.inspection.update.mockResolvedValue({
        ...mockArchivedInspection,
        deactivatedAt: null,
      });

      await service.activateArchive(mockInspectionId, mockUserId);

      expect(mockRedisService.incr).toHaveBeenCalledWith(
        'inspections:list_version',
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // buildArchiveTransaction
  // ─────────────────────────────────────────────────────────────────────────
  describe('buildArchiveTransaction', () => {
    it('should build a mint transaction for a valid APPROVED inspection', async () => {
      mockPrismaService.inspection.findUnique.mockResolvedValue(
        mockApprovedInspection,
      );
      const txResult = {
        unsignedTx: 'unsigned-tx-hex',
        nftAssetId: 'new-asset-id',
      };
      mockBlockchainService.buildAikenMintTransaction.mockResolvedValue(
        txResult,
      );

      const result = await service.buildArchiveTransaction(
        mockInspectionId,
        'addr_test1qz...',
      );

      expect(result).toEqual(txResult);
      expect(
        mockBlockchainService.buildAikenMintTransaction,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          adminAddress: 'addr_test1qz...',
          inspectionData: expect.objectContaining({
            vehicleNumber: 'AB 1234 CD',
            pdfHash: 'hash-def-12345678',
          }),
        }),
      );
    });

    it('should throw NotFoundException when inspection not found', async () => {
      mockPrismaService.inspection.findUnique.mockResolvedValue(null);

      await expect(
        service.buildArchiveTransaction(mockInspectionId, 'addr_test1qz...'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when status is not APPROVED', async () => {
      mockPrismaService.inspection.findUnique.mockResolvedValue({
        ...mockApprovedInspection,
        status: InspectionStatus.NEED_REVIEW,
      });

      await expect(
        service.buildArchiveTransaction(mockInspectionId, 'addr_test1qz...'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when vehiclePlateNumber is missing', async () => {
      mockPrismaService.inspection.findUnique.mockResolvedValue({
        ...mockApprovedInspection,
        vehiclePlateNumber: null,
      });

      await expect(
        service.buildArchiveTransaction(mockInspectionId, 'addr_test1qz...'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when pdfFileHashNoDocs is missing', async () => {
      mockPrismaService.inspection.findUnique.mockResolvedValue({
        ...mockApprovedInspection,
        pdfFileHashNoDocs: null,
      });

      await expect(
        service.buildArchiveTransaction(mockInspectionId, 'addr_test1qz...'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // confirmArchive
  // ─────────────────────────────────────────────────────────────────────────
  describe('confirmArchive', () => {
    const mockConfirmDto = {
      txHash: 'tx-hash-123',
      nftAssetId: 'asset-123',
    };

    it('should confirm archive and return updated inspection', async () => {
      mockPrismaService.inspection.findUnique.mockResolvedValue(
        mockApprovedInspection,
      );
      mockPrismaService.inspection.update.mockResolvedValue({
        ...mockApprovedInspection,
        status: InspectionStatus.ARCHIVED,
        blockchainTxHash: 'tx-hash-123',
        nftAssetId: 'asset-123',
      });

      const result = await service.confirmArchive(
        mockInspectionId,
        mockConfirmDto,
      );

      expect(result.status).toBe(InspectionStatus.ARCHIVED);
      expect(result.blockchainTxHash).toBe('tx-hash-123');
      expect(result.nftAssetId).toBe('asset-123');
    });

    it('should throw NotFoundException when inspection not found', async () => {
      mockPrismaService.inspection.findUnique.mockResolvedValue(null);

      await expect(
        service.confirmArchive('nonexistent', mockConfirmDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should invalidate list cache after confirming archive', async () => {
      mockPrismaService.inspection.findUnique.mockResolvedValue(
        mockApprovedInspection,
      );
      mockPrismaService.inspection.update.mockResolvedValue({
        ...mockApprovedInspection,
        status: InspectionStatus.ARCHIVED,
      });

      await service.confirmArchive(mockInspectionId, mockConfirmDto);

      expect(mockRedisService.incr).toHaveBeenCalledWith(
        'inspections:list_version',
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // revertInspectionToApproved
  // ─────────────────────────────────────────────────────────────────────────
  describe('revertInspectionToApproved', () => {
    it('should revert ARCHIVED inspection to APPROVED', async () => {
      const reverted = {
        ...mockArchivedInspection,
        status: InspectionStatus.APPROVED,
      };
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

      const result = await service.revertInspectionToApproved(
        'mock-archived-id',
        mockSuperAdminId,
      );

      expect(result.status).toBe(InspectionStatus.APPROVED);
    });

    it('should revert FAIL_ARCHIVE inspection to APPROVED', async () => {
      const failArchiveInspection = {
        ...mockArchivedInspection,
        status: InspectionStatus.FAIL_ARCHIVE,
      };
      const reverted = {
        ...failArchiveInspection,
        status: InspectionStatus.APPROVED,
      };
      mockPrismaService.$transaction.mockImplementation(async (cb) => {
        const tx = {
          inspection: {
            findUnique: jest.fn().mockResolvedValue(failArchiveInspection),
            update: jest.fn().mockResolvedValue(reverted),
          },
          inspectionChangeLog: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return cb(tx);
      });

      const result = await service.revertInspectionToApproved(
        mockInspectionId,
        mockSuperAdminId,
      );

      expect(result.status).toBe(InspectionStatus.APPROVED);
    });

    it('should throw NotFoundException when inspection not found', async () => {
      mockPrismaService.$transaction.mockImplementation(async (cb) => {
        const tx = {
          inspection: {
            findUnique: jest.fn().mockResolvedValue(null),
          },
        };
        return cb(tx);
      });

      await expect(
        service.revertInspectionToApproved('nonexistent', mockSuperAdminId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when status is NEED_REVIEW', async () => {
      const needReviewInspection = {
        ...mockApprovedInspection,
        status: InspectionStatus.NEED_REVIEW,
      };
      mockPrismaService.$transaction.mockImplementation(async (cb) => {
        const tx = {
          inspection: {
            findUnique: jest.fn().mockResolvedValue(needReviewInspection),
          },
        };
        return cb(tx);
      });

      await expect(
        service.revertInspectionToApproved(mockInspectionId, mockSuperAdminId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when status is APPROVED', async () => {
      mockPrismaService.$transaction.mockImplementation(async (cb) => {
        const tx = {
          inspection: {
            findUnique: jest.fn().mockResolvedValue(mockApprovedInspection),
          },
        };
        return cb(tx);
      });

      await expect(
        service.revertInspectionToApproved(mockInspectionId, mockSuperAdminId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should clear archived fields when reverting from ARCHIVED status', async () => {
      let capturedUpdateData: any;
      mockPrismaService.$transaction.mockImplementation(async (cb) => {
        const tx = {
          inspection: {
            findUnique: jest.fn().mockResolvedValue(mockArchivedInspection),
            update: jest.fn().mockImplementation((args) => {
              capturedUpdateData = args.data;
              return {
                ...mockArchivedInspection,
                status: InspectionStatus.APPROVED,
                archivedAt: null,
                nftAssetId: null,
                blockchainTxHash: null,
              };
            }),
          },
          inspectionChangeLog: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return cb(tx);
      });

      await service.revertInspectionToApproved(
        'mock-archived-id',
        mockSuperAdminId,
      );

      expect(capturedUpdateData.archivedAt).toBeNull();
      expect(capturedUpdateData.nftAssetId).toBeNull();
      expect(capturedUpdateData.blockchainTxHash).toBeNull();
    });

    it('should create a change log entry', async () => {
      let changeLogCreated = false;
      mockPrismaService.$transaction.mockImplementation(async (cb) => {
        const tx = {
          inspection: {
            findUnique: jest.fn().mockResolvedValue(mockArchivedInspection),
            update: jest.fn().mockResolvedValue({
              ...mockArchivedInspection,
              status: InspectionStatus.APPROVED,
            }),
          },
          inspectionChangeLog: {
            create: jest.fn().mockImplementation((args) => {
              changeLogCreated = true;
              expect(args.data.fieldName).toBe('status');
              expect(args.data.oldValue).toBe(InspectionStatus.ARCHIVED);
              expect(args.data.newValue).toBe(InspectionStatus.APPROVED);
              expect(args.data.changedByUserId).toBe(mockSuperAdminId);
              return {};
            }),
          },
        };
        return cb(tx);
      });

      await service.revertInspectionToApproved(
        'mock-archived-id',
        mockSuperAdminId,
      );

      expect(changeLogCreated).toBe(true);
    });

    it('should invalidate list cache after revert', async () => {
      mockPrismaService.$transaction.mockImplementation(async (cb) => {
        const tx = {
          inspection: {
            findUnique: jest.fn().mockResolvedValue(mockArchivedInspection),
            update: jest.fn().mockResolvedValue({
              ...mockArchivedInspection,
              status: InspectionStatus.APPROVED,
            }),
          },
          inspectionChangeLog: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return cb(tx);
      });

      await service.revertInspectionToApproved(
        'mock-archived-id',
        mockSuperAdminId,
      );

      expect(mockRedisService.incr).toHaveBeenCalledWith(
        'inspections:list_version',
      );
    });

    it('should throw InternalServerErrorException on unknown transaction error', async () => {
      mockPrismaService.$transaction.mockRejectedValue(
        new Error('Transaction failed'),
      );

      await expect(
        service.revertInspectionToApproved(mockInspectionId, mockSuperAdminId),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });
});
