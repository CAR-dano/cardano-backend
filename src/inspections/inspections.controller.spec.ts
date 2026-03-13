/*
 * --------------------------------------------------------------------------
 * File: inspections.controller.spec.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Unit tests for the InspectionsController.
 * All service dependencies are mocked to isolate controller logic.
 * --------------------------------------------------------------------------
 */

import { Test, TestingModule } from '@nestjs/testing';
import { InspectionsController } from './inspections.controller';
import { InspectionsService } from './inspections.service';
import { PhotosService } from '../photos/photos.service';
import { InspectionStatus, Role, Prisma } from '@prisma/client';
import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

// ─── Shared Mock Data ───────────────────────────────────────────────────────

const mockInspectionId = 'mock-inspection-id';
const mockUserId = 'mock-user-id';

const mockInspection = {
  id: mockInspectionId,
  pretty_id: 'YOG-13082025-001',
  inspectorId: 'mock-inspector-id',
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
  photos: [],
};

const mockArchivedInspection = {
  ...mockInspection,
  id: 'mock-archived-id',
  status: InspectionStatus.ARCHIVED,
  urlPdf: '/pdf/mock.pdf',
  pdfFileHash: 'abc123',
};

const mockPaginatedResult = {
  data: [mockInspection],
  meta: {
    total: 1,
    page: 1,
    pageSize: 10,
    totalPages: 1,
  },
};

const mockPhoto = {
  id: 'photo-id-1',
  inspectionId: mockInspectionId,
  label: 'front',
  needAttention: false,
  path: '/tmp/photo.png',
  filename: 'photo.png',
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─── Mock Services ───────────────────────────────────────────────────────────

const mockInspectionsService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  searchByKeyword: jest.fn(),
  findByVehiclePlateNumber: jest.fn(),
  update: jest.fn(),
  approveInspection: jest.fn(),
  bulkApproveInspections: jest.fn(),
  processToArchive: jest.fn(),
  buildArchiveTransaction: jest.fn(),
  confirmArchive: jest.fn(),
  deactivateArchive: jest.fn(),
  activateArchive: jest.fn(),
  deleteInspectionPermanently: jest.fn(),
  rollbackInspectionStatus: jest.fn(),
  revertInspectionToApproved: jest.fn(),
  getQueueStats: jest.fn(),
};

const mockPhotosService = {
  findForInspection: jest.fn(),
  addPhoto: jest.fn(),
  addMultiplePhotos: jest.fn(),
  updatePhoto: jest.fn(),
  deletePhoto: jest.fn(),
};

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe('InspectionsController', () => {
  let controller: InspectionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InspectionsController],
      providers: [
        { provide: InspectionsService, useValue: mockInspectionsService },
        { provide: PhotosService, useValue: mockPhotosService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'NODE_ENV') return 'test';
              if (key === 'APP_URL') return 'http://localhost:3000';
              return null;
            }),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<InspectionsController>(InspectionsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // create (POST /)
  // ─────────────────────────────────────────────────────────────────────────
  describe('create', () => {
    const mockDto = {
      vehiclePlateNumber: 'AB 1234 CD',
      inspectionDate: new Date('2025-08-13'),
      overallRating: 'GOOD',
    } as any;

    const mockReq = {
      url: '/inspections',
      headers: {},
    } as unknown as Request;

    it('should call service.create and return the new inspection id', async () => {
      mockInspectionsService.create.mockResolvedValue({ id: mockInspectionId });

      const result = await controller.create(mockDto, mockUserId, mockReq);

      expect(mockInspectionsService.create).toHaveBeenCalledWith(
        mockDto,
        mockUserId,
      );
      expect(result).toEqual({ id: mockInspectionId });
    });

    it('should re-throw HttpException with normalized body', async () => {
      const { BadRequestException: BE } = await import('@nestjs/common');
      mockInspectionsService.create.mockRejectedValue(
        new BE('Validation failed'),
      );

      await expect(controller.create(mockDto, mockUserId, mockReq)).rejects.toThrow();
    });

    it('should throw InternalServerErrorException for unknown errors', async () => {
      mockInspectionsService.create.mockRejectedValue(
        new Error('Unexpected DB error'),
      );

      await expect(
        controller.create(mockDto, mockUserId, mockReq),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // findAll
  // ─────────────────────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('should call service.findAll and return paginated result with mapped DTOs', async () => {
      mockInspectionsService.findAll.mockResolvedValue(mockPaginatedResult);

      const result = await controller.findAll(Role.ADMIN, undefined, 1, 10);

      expect(mockInspectionsService.findAll).toHaveBeenCalledWith(
        Role.ADMIN,
        undefined,
        1,
        10,
      );
      expect(result.meta).toEqual(mockPaginatedResult.meta);
      expect(result.data).toHaveLength(1);
    });

    it('should parse comma-separated status string and pass to service', async () => {
      mockInspectionsService.findAll.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, pageSize: 10, totalPages: 0 },
      });

      await controller.findAll(Role.ADMIN, 'NEED_REVIEW', 1, 10);

      expect(mockInspectionsService.findAll).toHaveBeenCalledWith(
        Role.ADMIN,
        [InspectionStatus.NEED_REVIEW],
        1,
        10,
      );
    });

    it('should parse array of statuses passed as string[]', async () => {
      mockInspectionsService.findAll.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, pageSize: 10, totalPages: 0 },
      });

      await controller.findAll(Role.ADMIN, ['NEED_REVIEW', 'APPROVED'] as any, 1, 10);

      expect(mockInspectionsService.findAll).toHaveBeenCalledWith(
        Role.ADMIN,
        [InspectionStatus.NEED_REVIEW, InspectionStatus.APPROVED],
        1,
        10,
      );
    });

    it('should throw BadRequestException for invalid status string', async () => {
      await expect(
        controller.findAll(Role.ADMIN, 'INVALID_STATUS', 1, 10),
      ).rejects.toThrow(BadRequestException);

      expect(mockInspectionsService.findAll).not.toHaveBeenCalled();
    });

    it('should default page=1 and pageSize=10 when not provided', async () => {
      mockInspectionsService.findAll.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, pageSize: 10, totalPages: 0 },
      });

      await controller.findAll();

      expect(mockInspectionsService.findAll).toHaveBeenCalledWith(
        undefined,
        undefined,
        1,
        10,
      );
    });

    it('should default invalid page/pageSize to 1/10', async () => {
      mockInspectionsService.findAll.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, pageSize: 10, totalPages: 0 },
      });

      await controller.findAll(undefined, undefined, -1 as any, 0 as any);

      expect(mockInspectionsService.findAll).toHaveBeenCalledWith(
        undefined,
        undefined,
        1,
        10,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // findOne
  // ─────────────────────────────────────────────────────────────────────────
  describe('findOne', () => {
    it('should call service.findOne and return mapped DTO', async () => {
      mockInspectionsService.findOne.mockResolvedValue(mockArchivedInspection);

      const result = await controller.findOne(
        'mock-archived-id',
        Role.ADMIN,
      );

      expect(mockInspectionsService.findOne).toHaveBeenCalledWith(
        'mock-archived-id',
        Role.ADMIN,
      );
      expect(result).toBeDefined();
      expect(result.id).toBe('mock-archived-id');
    });

    it('should propagate NotFoundException from service', async () => {
      mockInspectionsService.findOne.mockRejectedValue(
        new NotFoundException('Inspection not found'),
      );

      await expect(
        controller.findOne('non-existent-id', Role.ADMIN),
      ).rejects.toThrow(NotFoundException);
    });

    it('should propagate ForbiddenException from service for unauthorized role', async () => {
      mockInspectionsService.findOne.mockRejectedValue(
        new ForbiddenException('Access denied'),
      );

      await expect(
        controller.findOne(mockInspectionId, Role.CUSTOMER),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // searchByKeyword
  // ─────────────────────────────────────────────────────────────────────────
  describe('searchByKeyword', () => {
    it('should call service.searchByKeyword and return mapped paginated result', async () => {
      mockInspectionsService.searchByKeyword.mockResolvedValue(mockPaginatedResult);

      const result = await controller.searchByKeyword('Toyota', 1, 10);

      expect(mockInspectionsService.searchByKeyword).toHaveBeenCalledWith(
        'Toyota',
        1,
        10,
      );
      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual(mockPaginatedResult.meta);
    });

    it('should return empty data when no results found', async () => {
      mockInspectionsService.searchByKeyword.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, pageSize: 10, totalPages: 0 },
      });

      const result = await controller.searchByKeyword('nonexistent-keyword', 1, 10);

      expect(result.data).toEqual([]);
    });

    it('should return multiple results in data when multiple matches found', async () => {
      mockInspectionsService.searchByKeyword.mockResolvedValue({
        ...mockPaginatedResult,
        data: [
          mockInspection,
          { ...mockInspection, id: 'mock-inspection-id-2', pretty_id: 'YOG-14082025-001' },
        ],
        meta: { ...mockPaginatedResult.meta, total: 2 },
      });

      const result = await controller.searchByKeyword('Toyota', 1, 10);

      expect(result.data).toHaveLength(2);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // update (PUT /:id)
  // ─────────────────────────────────────────────────────────────────────────
  describe('update', () => {
    it('should call service.update and return the message', async () => {
      const mockMessage = {
        message: '1 changes have been logged for inspection ID "mock-inspection-id".',
      };
      mockInspectionsService.update.mockResolvedValue(mockMessage);

      const result = await controller.update(
        mockInspectionId,
        { overallRating: 'VERY GOOD' },
        mockUserId,
        Role.REVIEWER,
      );

      expect(mockInspectionsService.update).toHaveBeenCalledWith(
        mockInspectionId,
        { overallRating: 'VERY GOOD' },
        mockUserId,
        Role.REVIEWER,
      );
      expect(result.message).toContain('changes have been logged');
    });

    it('should propagate NotFoundException from service', async () => {
      mockInspectionsService.update.mockRejectedValue(
        new NotFoundException('Inspection not found'),
      );

      await expect(
        controller.update(
          'non-existent-id',
          { overallRating: 'VERY GOOD' },
          mockUserId,
          Role.REVIEWER,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should propagate BadRequestException when inspection has invalid status', async () => {
      mockInspectionsService.update.mockRejectedValue(
        new BadRequestException('Cannot update APPROVED inspection'),
      );

      await expect(
        controller.update(
          mockInspectionId,
          { overallRating: 'VERY GOOD' },
          mockUserId,
          Role.REVIEWER,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // searchByVehicleNumber
  // ─────────────────────────────────────────────────────────────────────────
  describe('searchByVehicleNumber', () => {
    it('should call service.findByVehiclePlateNumber and return DTO when found', async () => {
      mockInspectionsService.findByVehiclePlateNumber.mockResolvedValue(
        mockArchivedInspection,
      );

      const result = await controller.searchByVehicleNumber('AB 1234 CD');

      expect(
        mockInspectionsService.findByVehiclePlateNumber,
      ).toHaveBeenCalledWith('AB 1234 CD');
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException when plate number not found', async () => {
      mockInspectionsService.findByVehiclePlateNumber.mockResolvedValue(null);

      await expect(
        controller.searchByVehicleNumber('ZZ 9999 ZZ'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // approveInspection (PATCH /:id/approve)
  // ─────────────────────────────────────────────────────────────────────────
  describe('approveInspection', () => {
    const mockReq = {
      headers: { authorization: 'Bearer mock-token' },
    } as unknown as Request;

    it('should call service.approveInspection with id, reviewerId, and token', async () => {
      const approvedInspection = { ...mockInspection, status: InspectionStatus.APPROVED };
      mockInspectionsService.approveInspection.mockResolvedValue(approvedInspection);

      const result = await controller.approveInspection(mockInspectionId, mockUserId, mockReq);

      expect(mockInspectionsService.approveInspection).toHaveBeenCalledWith(
        mockInspectionId,
        mockUserId,
        'mock-token',
      );
      expect(result.id).toBe(mockInspectionId);
    });

    it('should pass null token when no authorization header', async () => {
      const reqWithoutAuth = { headers: {} } as unknown as Request;
      const approvedInspection = { ...mockInspection, status: InspectionStatus.APPROVED };
      mockInspectionsService.approveInspection.mockResolvedValue(approvedInspection);

      await controller.approveInspection(mockInspectionId, mockUserId, reqWithoutAuth);

      expect(mockInspectionsService.approveInspection).toHaveBeenCalledWith(
        mockInspectionId,
        mockUserId,
        null,
      );
    });

    it('should propagate BadRequestException from service', async () => {
      mockInspectionsService.approveInspection.mockRejectedValue(
        new BadRequestException('Cannot approve inspection in current status'),
      );

      await expect(
        controller.approveInspection(mockInspectionId, mockUserId, mockReq),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // bulkApproveInspections (POST /bulk-approve)
  // ─────────────────────────────────────────────────────────────────────────
  describe('bulkApproveInspections', () => {
    const mockReq = {
      headers: { authorization: 'Bearer mock-token' },
    } as unknown as Request;

    const mockBulkApproveDto = {
      inspectionIds: ['id-1', 'id-2'],
    };

    it('should call service.bulkApproveInspections and return the result', async () => {
      const mockResult = {
        results: [
          { id: 'id-1', success: true },
          { id: 'id-2', success: true },
        ],
        summary: { total: 2, successful: 2, failed: 0 },
      };
      mockInspectionsService.bulkApproveInspections.mockResolvedValue(mockResult);

      const result = await controller.bulkApproveInspections(
        mockBulkApproveDto as any,
        mockUserId,
        mockReq,
      );

      expect(mockInspectionsService.bulkApproveInspections).toHaveBeenCalledWith(
        ['id-1', 'id-2'],
        mockUserId,
        'mock-token',
      );
      expect(result.summary.successful).toBe(2);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // processToArchive (PUT /:id/archive)
  // ─────────────────────────────────────────────────────────────────────────
  describe('processToArchive', () => {
    it('should call service.processToArchive and return DTO', async () => {
      mockInspectionsService.processToArchive.mockResolvedValue(mockArchivedInspection);

      const result = await controller.processToArchive(
        'mock-archived-id',
        mockUserId,
      );

      expect(mockInspectionsService.processToArchive).toHaveBeenCalledWith(
        'mock-archived-id',
        mockUserId,
      );
      expect(result.id).toBe('mock-archived-id');
    });

    it('should propagate NotFoundException', async () => {
      mockInspectionsService.processToArchive.mockRejectedValue(
        new NotFoundException('Inspection not found'),
      );

      await expect(
        controller.processToArchive('bad-id', mockUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // buildArchiveTransaction (POST /:id/build-archive-tx)
  // ─────────────────────────────────────────────────────────────────────────
  describe('buildArchiveTransaction', () => {
    const mockBuildResponse = {
      unsignedTx: 'base64-tx-data',
      inspectionId: mockInspectionId,
    };

    it('should call service.buildArchiveTransaction with id and adminAddress', async () => {
      mockInspectionsService.buildArchiveTransaction.mockResolvedValue(
        mockBuildResponse,
      );

      const result = await controller.buildArchiveTransaction(mockInspectionId, {
        adminAddress: 'addr1test',
      } as any);

      expect(mockInspectionsService.buildArchiveTransaction).toHaveBeenCalledWith(
        mockInspectionId,
        'addr1test',
      );
      expect(result).toEqual(mockBuildResponse);
    });

    it('should throw BadRequestException when adminAddress is missing', async () => {
      await expect(
        controller.buildArchiveTransaction(mockInspectionId, {} as any),
      ).rejects.toThrow(BadRequestException);

      expect(mockInspectionsService.buildArchiveTransaction).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // confirmArchive (POST /:id/confirm-archive)
  // ─────────────────────────────────────────────────────────────────────────
  describe('confirmArchive', () => {
    const mockConfirmDto = {
      txHash: 'abc123txhash',
      nftAssetId: 'asset1nft',
    };

    it('should call service.confirmArchive and return DTO', async () => {
      mockInspectionsService.confirmArchive.mockResolvedValue(mockArchivedInspection);

      const result = await controller.confirmArchive(
        'mock-archived-id',
        mockConfirmDto as any,
      );

      expect(mockInspectionsService.confirmArchive).toHaveBeenCalledWith(
        'mock-archived-id',
        mockConfirmDto,
      );
      expect(result).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // deactivateArchive (PATCH /:id/deactivate)
  // ─────────────────────────────────────────────────────────────────────────
  describe('deactivateArchive', () => {
    it('should call service.deactivateArchive and return DTO', async () => {
      const deactivatedInspection = {
        ...mockArchivedInspection,
        status: InspectionStatus.DEACTIVATED,
      };
      mockInspectionsService.deactivateArchive.mockResolvedValue(deactivatedInspection);

      const result = await controller.deactivateArchive(
        'mock-archived-id',
        mockUserId,
      );

      expect(mockInspectionsService.deactivateArchive).toHaveBeenCalledWith(
        'mock-archived-id',
        mockUserId,
      );
      expect(result).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // activateArchive (PATCH /:id/activate)
  // ─────────────────────────────────────────────────────────────────────────
  describe('activateArchive', () => {
    it('should call service.activateArchive and return DTO', async () => {
      mockInspectionsService.activateArchive.mockResolvedValue(mockArchivedInspection);

      const result = await controller.activateArchive(
        'mock-archived-id',
        mockUserId,
      );

      expect(mockInspectionsService.activateArchive).toHaveBeenCalledWith(
        'mock-archived-id',
        mockUserId,
      );
      expect(result).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // deleteInspectionPermanently (DELETE /:id/permanently)
  // ─────────────────────────────────────────────────────────────────────────
  describe('deleteInspectionPermanently', () => {
    it('should call service.deleteInspectionPermanently', async () => {
      mockInspectionsService.deleteInspectionPermanently.mockResolvedValue(undefined);

      await controller.deleteInspectionPermanently(mockInspectionId);

      expect(
        mockInspectionsService.deleteInspectionPermanently,
      ).toHaveBeenCalledWith(mockInspectionId);
    });

    it('should propagate NotFoundException from service', async () => {
      mockInspectionsService.deleteInspectionPermanently.mockRejectedValue(
        new NotFoundException('Inspection not found'),
      );

      await expect(
        controller.deleteInspectionPermanently('bad-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // revertInspectionToReview (PATCH /:id/revert-to-review)
  // ─────────────────────────────────────────────────────────────────────────
  describe('revertInspectionToReview', () => {
    it('should call service.rollbackInspectionStatus and return void', async () => {
      mockInspectionsService.rollbackInspectionStatus.mockResolvedValue(undefined);

      const result = await controller.revertInspectionToReview(
        mockInspectionId,
        mockUserId,
      );

      expect(mockInspectionsService.rollbackInspectionStatus).toHaveBeenCalledWith(
        mockInspectionId,
        mockUserId,
      );
      expect(result).toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // revertInspectionToApproved (PATCH /:id/revert-to-approved)
  // ─────────────────────────────────────────────────────────────────────────
  describe('revertInspectionToApproved', () => {
    it('should call service.revertInspectionToApproved and return void', async () => {
      mockInspectionsService.revertInspectionToApproved.mockResolvedValue(undefined);

      const result = await controller.revertInspectionToApproved(
        mockInspectionId,
        mockUserId,
      );

      expect(mockInspectionsService.revertInspectionToApproved).toHaveBeenCalledWith(
        mockInspectionId,
        mockUserId,
      );
      expect(result).toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getQueueStats (GET /queue-stats)
  // ─────────────────────────────────────────────────────────────────────────
  describe('getQueueStats', () => {
    it('should call service.getQueueStats and return stats', () => {
      const mockStats = {
        pdfQueue: { queueLength: 0, running: 0 },
        blockchainQueue: { queueLength: 0, running: 0 },
      };
      mockInspectionsService.getQueueStats.mockReturnValue(mockStats);

      const result = controller.getQueueStats();

      expect(mockInspectionsService.getQueueStats).toHaveBeenCalled();
      expect(result).toEqual(mockStats);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getPhotosForInspection (GET /:id/photos)
  // ─────────────────────────────────────────────────────────────────────────
  describe('getPhotosForInspection', () => {
    it('should call photosService.findForInspection and return mapped DTOs', async () => {
      mockPhotosService.findForInspection.mockResolvedValue([mockPhoto]);

      const result = await controller.getPhotosForInspection(mockInspectionId);

      expect(mockPhotosService.findForInspection).toHaveBeenCalledWith(mockInspectionId);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('photo-id-1');
    });

    it('should return empty array when no photos exist', async () => {
      mockPhotosService.findForInspection.mockResolvedValue([]);

      const result = await controller.getPhotosForInspection(mockInspectionId);

      expect(result).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // deletePhoto (DELETE /:id/photos/:photoId)
  // ─────────────────────────────────────────────────────────────────────────
  describe('deletePhoto', () => {
    it('should call photosService.deletePhoto with photoId and userId', async () => {
      mockPhotosService.deletePhoto.mockResolvedValue(undefined);

      await controller.deletePhoto(mockInspectionId, 'photo-id-1', mockUserId);

      expect(mockPhotosService.deletePhoto).toHaveBeenCalledWith(
        'photo-id-1',
        mockUserId,
      );
    });

    it('should propagate NotFoundException from photosService', async () => {
      mockPhotosService.deletePhoto.mockRejectedValue(
        new NotFoundException('Photo not found'),
      );

      await expect(
        controller.deletePhoto(mockInspectionId, 'bad-photo-id', mockUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // updatePhoto (PUT /:id/photos/:photoId)
  // ─────────────────────────────────────────────────────────────────────────
  describe('updatePhoto', () => {
    it('should call photosService.updatePhoto and return mapped DTO', async () => {
      const updatedPhoto = { ...mockPhoto, label: 'side' };
      mockPhotosService.updatePhoto.mockResolvedValue(updatedPhoto);

      const result = await controller.updatePhoto(
        mockInspectionId,
        'photo-id-1',
        { label: 'side' } as any,
        mockUserId,
        undefined,
      );

      expect(mockPhotosService.updatePhoto).toHaveBeenCalledWith(
        mockInspectionId,
        'photo-id-1',
        { label: 'side' },
        undefined,
        mockUserId,
      );
      expect(result.id).toBe('photo-id-1');
    });

    it('should pass valid file object to updatePhoto service', async () => {
      const newFile = {
        filename: 'new.png',
        mimetype: 'image/png',
        path: '/tmp/new.png',
      } as any;
      mockPhotosService.updatePhoto.mockResolvedValue(mockPhoto);

      await controller.updatePhoto(
        mockInspectionId,
        'photo-id-1',
        {} as any,
        mockUserId,
        newFile,
      );

      expect(mockPhotosService.updatePhoto).toHaveBeenCalledWith(
        mockInspectionId,
        'photo-id-1',
        {},
        newFile,
        mockUserId,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // addSinglePhoto (POST /:id/photos/single)
  // ─────────────────────────────────────────────────────────────────────────
  describe('addSinglePhoto', () => {
    const mockFile = {
      filename: 'photo.png',
      mimetype: 'image/png',
      path: '/tmp/photo.png',
    } as any;

    it('should parse metadata and call photosService.addPhoto', async () => {
      mockPhotosService.addPhoto.mockResolvedValue(mockPhoto);

      const result = await controller.addSinglePhoto(
        mockInspectionId,
        { metadata: JSON.stringify({ label: 'front', needAttention: 'false' }) } as any,
        mockFile,
      );

      expect(mockPhotosService.addPhoto).toHaveBeenCalledWith(
        mockInspectionId,
        mockFile,
        { label: 'front', needAttention: 'false' },
      );
      expect(result.id).toBe('photo-id-1');
    });

    it('should throw BadRequestException when no file provided', async () => {
      await expect(
        controller.addSinglePhoto(
          mockInspectionId,
          { metadata: '{}' } as any,
          null as any,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid metadata JSON', async () => {
      await expect(
        controller.addSinglePhoto(
          mockInspectionId,
          { metadata: 'not-json' } as any,
          mockFile,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for metadata without label', async () => {
      await expect(
        controller.addSinglePhoto(
          mockInspectionId,
          { metadata: JSON.stringify({ needAttention: 'false' }) } as any,
          mockFile,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
