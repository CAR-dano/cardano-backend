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
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ThrottlerGuard } from '@nestjs/throttler';

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
  deactivateInspection: jest.fn(),
  reactivateInspection: jest.fn(),
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

      // Controller handles the status parsing internally
      await controller.findAll(Role.ADMIN, 'NEED_REVIEW', 1, 10);

      // Service should be called with the parsed array
      expect(mockInspectionsService.findAll).toHaveBeenCalledWith(
        Role.ADMIN,
        [InspectionStatus.NEED_REVIEW],
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
    it('should call service.searchByKeyword and return mapped DTOs array', async () => {
      mockInspectionsService.searchByKeyword.mockResolvedValue([
        mockArchivedInspection,
      ]);

      const result = await controller.searchByKeyword('Toyota');

      expect(mockInspectionsService.searchByKeyword).toHaveBeenCalledWith(
        'Toyota',
      );
      expect(result).toHaveLength(1);
    });

    it('should return empty array when no results found', async () => {
      mockInspectionsService.searchByKeyword.mockResolvedValue([]);

      const result = await controller.searchByKeyword('nonexistent-keyword');

      expect(result).toEqual([]);
    });

    it('should return multiple results when multiple matches found', async () => {
      mockInspectionsService.searchByKeyword.mockResolvedValue([
        mockArchivedInspection,
        { ...mockArchivedInspection, id: 'mock-archived-id-2', pretty_id: 'YOG-14082025-001' },
      ]);

      const result = await controller.searchByKeyword('Toyota');

      expect(result).toHaveLength(2);
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
});
