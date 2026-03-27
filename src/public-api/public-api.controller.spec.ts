/*
 * --------------------------------------------------------------------------
 * File: public-api.controller.spec.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Unit tests for the PublicApiController.
 * --------------------------------------------------------------------------
 */

import { Test, TestingModule } from '@nestjs/testing';
import { PublicApiController } from './public-api.controller';
import { UsersService } from '../users/users.service';
import { InspectionsService } from '../inspections/inspections.service';
import { PublicApiService } from './public-api.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { UserResponseDto } from '../users/dto/user-response.dto';

// --- Mock Dependencies ---

const mockUsersService = {
  findAllInspectors: jest.fn(),
};

const mockInspectionsService = {
  findLatestArchivedInspections: jest.fn(),
};

const mockPublicApiService = {
  findOne: jest.fn(),
  findOneWithoutDocuments: jest.fn(),
  findChangesByInspectionId: jest.fn(),
};

const mockPrismaService = {
  $queryRaw: jest.fn(),
  executeWithReconnect: jest.fn(),
};

// Base inspector entity for tests
const baseInspector = {
  id: 'inspector-uuid-1',
  email: 'inspector@test.com',
  username: 'inspector1',
  name: 'Inspector One',
  role: Role.INSPECTOR,
  isActive: true,
  walletAddress: null,
  whatsappNumber: null,
  password: 'hashed',
  googleId: null,
  hashedRefreshToken: null,
  sessionVersion: 1,
  pinHash: null,
  inspectionBranchCityId: null,
  inspectionBranchCity: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Build a minimal inspection entity with photos for testing
const buildMockInspection = (id: string, overrides: any = {}) => ({
  id,
  vehiclePlateNumber: 'B 1234 CD',
  vehicleData: { merekKendaraan: 'Toyota', tipeKendaraan: 'Avanza' },
  status: 'ARCHIVED',
  photos: [
    {
      id: 'photo-1',
      path: 'front-view.jpg',
      label: 'Tampak Depan',
      inspectionId: id,
    },
  ],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('PublicApiController', () => {
  let controller: PublicApiController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublicApiController],
      providers: [
        { provide: UsersService, useValue: mockUsersService },
        { provide: InspectionsService, useValue: mockInspectionsService },
        { provide: PublicApiService, useValue: mockPublicApiService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    controller = module.get<PublicApiController>(PublicApiController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // dbHealthCheck
  // ---------------------------------------------------------------------------
  describe('dbHealthCheck', () => {
    it('should return { status: "ok" } when DB is healthy', async () => {
      // Make executeWithReconnect actually invoke the callback so line 96 is covered
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockPrismaService.executeWithReconnect.mockImplementation(
        async (_name: string, fn: () => Promise<any>) => fn(),
      );

      const result = await controller.dbHealthCheck();

      expect(result).toEqual({ status: 'ok' });
      expect(mockPrismaService.executeWithReconnect).toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException when DB check fails', async () => {
      mockPrismaService.executeWithReconnect.mockRejectedValue(
        new Error('Connection refused'),
      );

      await expect(controller.dbHealthCheck()).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // findAllInspectors
  // ---------------------------------------------------------------------------
  describe('findAllInspectors', () => {
    it('should return array of inspector UserResponseDtos', async () => {
      mockUsersService.findAllInspectors.mockResolvedValue([baseInspector]);

      const result = await controller.findAllInspectors();

      expect(mockUsersService.findAllInspectors).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(UserResponseDto);
      expect(result[0].role).toBe(Role.INSPECTOR);
    });

    it('should return empty array when no inspectors found', async () => {
      mockUsersService.findAllInspectors.mockResolvedValue([]);

      const result = await controller.findAllInspectors();

      expect(result).toEqual([]);
    });

    it('should propagate errors from usersService.findAllInspectors', async () => {
      mockUsersService.findAllInspectors.mockRejectedValue(
        new Error('DB Error'),
      );

      await expect(controller.findAllInspectors()).rejects.toThrow('DB Error');
    });
  });

  // ---------------------------------------------------------------------------
  // getLatestArchivedInspections
  // ---------------------------------------------------------------------------
  describe('getLatestArchivedInspections', () => {
    it('should return array of LatestArchivedInspectionResponseDto', async () => {
      const inspection = buildMockInspection('insp-1');
      mockInspectionsService.findLatestArchivedInspections.mockResolvedValue([
        inspection,
      ]);

      const result = await controller.getLatestArchivedInspections();

      expect(result).toHaveLength(1);
      expect(result[0].vehiclePlateNumber).toBe('B 1234 CD');
      expect(result[0].photo.label).toBe('Tampak Depan');
    });

    it('should return empty array when no archived inspections', async () => {
      mockInspectionsService.findLatestArchivedInspections.mockResolvedValue(
        [],
      );

      const result = await controller.getLatestArchivedInspections();

      expect(result).toEqual([]);
    });

    it('should throw InternalServerErrorException when inspection missing Tampak Depan photo', async () => {
      const inspection = buildMockInspection('insp-2', { photos: [] });
      mockInspectionsService.findLatestArchivedInspections.mockResolvedValue([
        inspection,
      ]);

      await expect(controller.getLatestArchivedInspections()).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should propagate errors from inspectionsService', async () => {
      mockInspectionsService.findLatestArchivedInspections.mockRejectedValue(
        new Error('DB Error'),
      );

      await expect(controller.getLatestArchivedInspections()).rejects.toThrow(
        'DB Error',
      );
    });
  });

  // ---------------------------------------------------------------------------
  // findOne
  // ---------------------------------------------------------------------------
  describe('findOne', () => {
    const inspectionId = 'insp-uuid-1';

    it('should return InspectionResponseDto when inspection found', async () => {
      const mockInspection = buildMockInspection(inspectionId);
      mockPublicApiService.findOne.mockResolvedValue(mockInspection);

      const result = await controller.findOne(inspectionId);

      expect(mockPublicApiService.findOne).toHaveBeenCalledWith(inspectionId);
      expect(result).toBeDefined();
    });

    it('should propagate NotFoundException from publicApiService.findOne', async () => {
      mockPublicApiService.findOne.mockRejectedValue(
        new NotFoundException('Inspection not found'),
      );

      await expect(controller.findOne(inspectionId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // findOneWithoutDocuments
  // ---------------------------------------------------------------------------
  describe('findOneWithoutDocuments', () => {
    const inspectionId = 'insp-uuid-2';

    it('should return InspectionResponseDto without sensitive documents', async () => {
      const mockInspection = buildMockInspection(inspectionId);
      mockPublicApiService.findOneWithoutDocuments.mockResolvedValue(
        mockInspection,
      );

      const result = await controller.findOneWithoutDocuments(inspectionId);

      expect(mockPublicApiService.findOneWithoutDocuments).toHaveBeenCalledWith(
        inspectionId,
      );
      expect(result).toBeDefined();
    });

    it('should propagate NotFoundException from publicApiService', async () => {
      mockPublicApiService.findOneWithoutDocuments.mockRejectedValue(
        new NotFoundException('Not found'),
      );

      await expect(
        controller.findOneWithoutDocuments(inspectionId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // findChangesByInspectionId
  // ---------------------------------------------------------------------------
  describe('findChangesByInspectionId', () => {
    const inspectionId = 'insp-uuid-3';

    it('should return change logs for the inspection', async () => {
      const mockChangeLogs = [
        { id: 'log-1', inspectionId, changes: {} },
        { id: 'log-2', inspectionId, changes: {} },
      ];
      mockPublicApiService.findChangesByInspectionId.mockResolvedValue(
        mockChangeLogs,
      );

      const result = await controller.findChangesByInspectionId(inspectionId);

      expect(
        mockPublicApiService.findChangesByInspectionId,
      ).toHaveBeenCalledWith(inspectionId);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no change logs exist', async () => {
      mockPublicApiService.findChangesByInspectionId.mockResolvedValue([]);

      const result = await controller.findChangesByInspectionId(inspectionId);

      expect(result).toEqual([]);
    });

    it('should propagate errors from publicApiService', async () => {
      mockPublicApiService.findChangesByInspectionId.mockRejectedValue(
        new NotFoundException('Inspection not found'),
      );

      await expect(
        controller.findChangesByInspectionId(inspectionId),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
