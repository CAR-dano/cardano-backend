import { Test, TestingModule } from '@nestjs/testing';
import { CustomerVehiclesService } from './customer-vehicles.service';
import { PrismaService } from '../prisma/prisma.service';
import { BackblazeService } from '../common/services/backblaze.service';
import { AppLogger } from '../logging/app-logger.service';
import { AuditLoggerService } from '../logging/audit-logger.service';
import {
  VehiclePhotoType,
  VehicleTransmission,
  VehicleType,
} from '@prisma/client';
import { BadRequestException, NotFoundException } from '@nestjs/common';

const mockPrisma = {
  customerVehicle: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
  customerVehiclePhoto: {
    createMany: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  inspection: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn(async (actions: Promise<any>[]) => Promise.all(actions)),
};

const mockStorage = {
  uploadImageBuffer: jest.fn(),
  deleteFile: jest.fn(),
};

const mockLogger = {
  setContext: jest.fn(),
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

const mockAudit = {
  log: jest.fn(),
};

describe('CustomerVehiclesService', () => {
  let service: CustomerVehiclesService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerVehiclesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BackblazeService, useValue: mockStorage },
        { provide: AppLogger, useValue: mockLogger },
        { provide: AuditLoggerService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get(CustomerVehiclesService);
  });

  const createDto = {
    plateNumber: 'AB1234CD',
    year: 2022,
    transmission: VehicleTransmission.AUTOMATIC,
    vehicleType: VehicleType.SUV,
    brand: 'Toyota',
    model: 'Alphard X',
    color: 'Black',
    photos: [
      { type: VehiclePhotoType.FRONT, label: 'Front', isPrimary: true },
      { type: VehiclePhotoType.BACK, label: 'Back' },
    ],
  };

  const mockFile = (name: string) =>
    ({
      originalname: name,
      buffer: Buffer.from('file'),
      mimetype: 'image/jpeg',
    }) as Express.Multer.File;

  describe('createVehicle', () => {
    it('should create vehicle and upload photos', async () => {
      mockPrisma.customerVehicle.create.mockResolvedValue({ id: 'veh-1' });
      mockPrisma.customerVehicle.findUnique.mockResolvedValue({
        id: 'veh-1',
        ...createDto,
        specification: null,
        serviceHistory: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        photos: [],
      });
      mockStorage.uploadImageBuffer.mockResolvedValue('https://cdn/path.jpg');
      mockPrisma.customerVehiclePhoto.createMany.mockResolvedValue({});

      const result = await service.createVehicle('user-1', createDto as any, [
        mockFile('front.jpg'),
        mockFile('back.jpg'),
      ]);

      expect(mockPrisma.customerVehicle.create).toHaveBeenCalled();
      expect(mockStorage.uploadImageBuffer).toHaveBeenCalledTimes(2);
      expect(result.id).toBe('veh-1');
    });

    it('should require front photo metadata', async () => {
      await expect(
        service.createVehicle(
          'user-1',
          { ...createDto, photos: [{ type: VehiclePhotoType.BACK }] } as any,
          [mockFile('back.jpg')],
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('listVehicles', () => {
    it('should return paginated vehicles', async () => {
      mockPrisma.customerVehicle.count.mockResolvedValue(1);
      mockPrisma.customerVehicle.findMany.mockResolvedValue([
        {
          id: 'veh-1',
          ...createDto,
          specification: null,
          serviceHistory: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          photos: [],
        },
      ]);

      const result = await service.listVehicles('user-1', { page: 1, pageSize: 10 });
      expect(result.meta.total).toBe(1);
      expect(result.items).toHaveLength(1);
    });
  });

  describe('getVehicle', () => {
    it('should throw NotFound when vehicle missing', async () => {
      mockPrisma.customerVehicle.findFirst.mockResolvedValue(null);
      await expect(service.getVehicle('user-1', 'veh-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateVehicle', () => {
    it('should update metadata and replace photos when provided', async () => {
      mockPrisma.customerVehicle.findUnique.mockResolvedValueOnce({
        id: 'veh-1',
        userId: 'user-1',
      });
      mockPrisma.customerVehicle.update.mockResolvedValue({});
      mockPrisma.customerVehiclePhoto.findMany.mockResolvedValue([
        { storageKey: 'old-key' },
      ] as any);
      mockPrisma.customerVehiclePhoto.deleteMany.mockResolvedValue({});
      mockStorage.uploadImageBuffer.mockResolvedValue('https://cdn/new.jpg');
      mockPrisma.customerVehicle.findUnique.mockResolvedValueOnce({
        id: 'veh-1',
        ...createDto,
        specification: null,
        serviceHistory: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        photos: [],
      });

      await service.updateVehicle(
        'user-1',
        'veh-1',
        {
          brand: 'Updated',
          photos: createDto.photos,
        } as any,
        [mockFile('front.jpg'), mockFile('back.jpg')],
      );

      expect(mockPrisma.customerVehicle.update).toHaveBeenCalled();
      expect(mockPrisma.customerVehiclePhoto.deleteMany).toHaveBeenCalled();
      expect(mockStorage.uploadImageBuffer).toHaveBeenCalled();
    });
  });
});
