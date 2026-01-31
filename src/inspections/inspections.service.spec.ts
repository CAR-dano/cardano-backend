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

// Mock data
const mockInspectionId = 'mock-inspection-id';
const mockReviewerId = 'mock-reviewer-id';
const mockToken = 'mock-jwt-token';

const mockInspection: Inspection = {
  id: mockInspectionId,
  pretty_id: 'YOG-13082025-001',
  inspectorId: 'mock-inspector-id',
  reviewerId: null,
  branchCityId: 'mock-branch-id',
  vehiclePlateNumber: 'AB 1234 CD',
  inspectionDate: new Date(),
  overallRating: 'GOOD',
  status: InspectionStatus.NEED_REVIEW,
  identityDetails: {
    namaInspektor: 'Mock Inspector',
    namaCustomer: 'Mock Customer',
    cabangInspeksi: 'Mock Branch',
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
  createdAt: new Date(),
  updatedAt: new Date(),
  archivedAt: null,
  deactivatedAt: null,
  url_pdf_cloud: null,
  url_pdf_no_docs_cloud: null,
};

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

describe('InspectionsService', () => {
  let service: InspectionsService;
  let prisma: PrismaService;
  let ipfsService: IpfsService;

  const mockPrismaService = {
    inspection: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    inspectionChangeLog: {
      findMany: jest.fn(),
    },
    $transaction: jest
      .fn()
      .mockImplementation((callback) => callback(mockPrismaService)),
  };

  const mockBlockchainService = {};
  const mockConfigService = {
    getOrThrow: jest.fn(),
  };
  const mockIpfsService = {
    add: jest.fn(),
  };
  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
    isHealthy: jest.fn().mockResolvedValue(true),
    incr: jest.fn(),
  };

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
    prisma = module.get<PrismaService>(PrismaService);
    ipfsService = module.get<IpfsService>(IpfsService);

    // Alias findUnique mocks to findUniqueOrThrow for consistency
    mockPrismaService.inspection.findUniqueOrThrow =
      mockPrismaService.inspection.findUnique;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('approveInspection', () => {
    it('should first apply changes, then generate PDF, and finally approve', async () => {
      // ARRANGE
      const inspectionAfterChanges = {
        ...mockInspection,
        overallRating: 'VERY GOOD',
        vehicleData: { merekKendaraan: 'Toyota', tipeKendaraan: 'Veloz' },
      };

      // Mock the transaction part
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          inspection: {
            findUnique: jest.fn().mockResolvedValue(mockInspection),
            findUniqueOrThrow: jest.fn().mockResolvedValue(mockInspection),
            update: jest.fn().mockResolvedValue(inspectionAfterChanges),
          },
          inspectionChangeLog: {
            findMany: jest.fn().mockResolvedValue(mockChangeLogs),
          },
        };
        return await callback(tx);
      });

      // Mock the PDF generation part (which happens after the transaction)
      const generatePdfSpy = jest
        .spyOn(service as any, '_generateAndSavePdf')
        .mockResolvedValue({
          pdfPublicUrl: '/pdf/new.pdf',
          pdfCid: 'new-cid',
          pdfHashString: 'new-hash',
        });

      // Mock the final update call (which also happens after the transaction)
      mockPrismaService.inspection.update.mockResolvedValue({
        ...inspectionAfterChanges,
        status: InspectionStatus.APPROVED,
        urlPdf: '/pdf/new.pdf',
      });

      mockConfigService.getOrThrow.mockReturnValue('http://localhost:3000');

      // ACT
      await service.approveInspection(
        mockInspectionId,
        mockReviewerId,
        mockToken,
      );

      // ASSERT

      // 1. Verify that the transaction was called to update the inspection data first.
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      const transactionCallback =
        mockPrismaService.$transaction.mock.calls[0][0];
      const txMock = {
        inspection: {
          findUnique: jest.fn().mockResolvedValue(mockInspection),
          findUniqueOrThrow: jest.fn().mockResolvedValue(mockInspection),
          update: jest.fn().mockResolvedValue(inspectionAfterChanges),
        },
        inspectionChangeLog: {
          findMany: jest.fn().mockResolvedValue(mockChangeLogs),
        },
      };
      await transactionCallback(txMock);
      expect(txMock.inspection.update).toHaveBeenCalledWith({
        where: { id: mockInspectionId },
        data: expect.objectContaining({
          overallRating: 'VERY GOOD',
          vehicleData: expect.objectContaining({
            tipeKendaraan: 'Veloz',
          }),
        }),
      });

      // 2. Verify that PDF generation was called after the initial update.
      expect(generatePdfSpy).toHaveBeenCalled();

      // 3. Verify the final update call to save PDF data and set status to APPROVED.
      expect(prisma.inspection.update).toHaveBeenCalledWith({
        where: { id: mockInspectionId },
        data: {
          status: InspectionStatus.APPROVED,
          reviewer: { connect: { id: mockReviewerId } },
          urlPdf: '/pdf/new.pdf',
          pdfFileHash: 'new-hash',
          ipfsPdf: 'ipfs://new-cid',
          urlPdfNoDocs: '/pdf/new.pdf',
          pdfFileHashNoDocs: 'new-hash',
          ipfsPdfNoDocs: 'ipfs://new-cid',
        },
      });
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
            findUniqueOrThrow: jest.fn().mockResolvedValue(wrongStatusInspection),
          },
        };
        return await callback(tx);
      });

      await expect(
        service.approveInspection(mockInspectionId, mockReviewerId, mockToken),
      ).rejects.toThrow(BadRequestException);
    });

    it('should revert status to FAIL_ARCHIVE if PDF generation fails', async () => {
      // ARRANGE
      const inspectionAfterChanges = {
        ...mockInspection,
        overallRating: 'VERY GOOD',
      };
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          inspection: {
            findUnique: jest.fn().mockResolvedValue(mockInspection),
            findUniqueOrThrow: jest.fn().mockResolvedValue(mockInspection),
            update: jest.fn().mockResolvedValue(inspectionAfterChanges),
          },
          inspectionChangeLog: {
            findMany: jest.fn().mockResolvedValue(mockChangeLogs),
          },
        };
        return await callback(tx);
      });

      const pdfError = new Error('PDF generation failed');
      jest
        .spyOn(service as any, '_generateAndSavePdf')
        .mockRejectedValue(pdfError);

      mockConfigService.getOrThrow.mockReturnValue('http://localhost:3000');

      // ACT & ASSERT
      await expect(
        service.approveInspection(mockInspectionId, mockReviewerId, mockToken),
      ).rejects.toThrow(InternalServerErrorException);

      expect(prisma.inspection.update).toHaveBeenCalledWith({
        where: { id: mockInspectionId },
        data: {
          status: InspectionStatus.NEED_REVIEW,
          reviewerId: null,
        },
      });
    });
  });

  describe('findOne', () => {
    it('should return from cache if available', async () => {
      mockRedisService.get.mockResolvedValueOnce('0'); // version
      mockRedisService.get.mockResolvedValueOnce(JSON.stringify(mockInspection)); // data

      const result = await service.findOne(mockInspectionId, Role.ADMIN);

      // JSON.parse converts dates to strings, so we compare with serialized version
      expect(result).toEqual(JSON.parse(JSON.stringify(mockInspection)));
      expect(mockRedisService.get).toHaveBeenCalledTimes(2);
      expect(mockPrismaService.inspection.findUniqueOrThrow).not.toHaveBeenCalled();
    });

    it('should fetch from DB and cache if NOT in cache', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockPrismaService.inspection.findUniqueOrThrow.mockResolvedValue(
        mockInspection,
      );

      const result = await service.findOne(mockInspectionId, Role.ADMIN);

      expect(result).toEqual(JSON.parse(JSON.stringify(mockInspection)));
      expect(mockPrismaService.inspection.findUniqueOrThrow).toHaveBeenCalled();
      expect(mockRedisService.set).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if user cannot access', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockPrismaService.inspection.findUniqueOrThrow.mockResolvedValue({
        ...mockInspection,
        status: InspectionStatus.NEED_REVIEW,
      });

      await expect(
        service.findOne(mockInspectionId, Role.CUSTOMER),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
