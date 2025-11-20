import { Test, TestingModule } from '@nestjs/testing';
import { PhotosService } from './photos.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { BackblazeService } from '../backblaze/backblaze.service';
import { MetricsService } from '../metrics/metrics.service';
import { BadRequestException } from '@nestjs/common';

const prismaMock = {
  inspection: {
    findUnique: jest.fn(),
  },
  photo: {
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

const backblazeMock = {
  isConfigured: jest.fn(),
  uploadPhotoBuffer: jest.fn(),
  deleteFile: jest.fn(),
};

const configMock = {
  get: jest.fn(),
};

const metricsMock = {
  recordPhotoUpload: jest.fn(),
  recordPhotoDelete: jest.fn(),
};

describe('PhotosService', () => {
  let service: PhotosService;

  beforeEach(async () => {
    jest.resetAllMocks();
    metricsMock.recordPhotoUpload.mockReset();
    metricsMock.recordPhotoDelete.mockReset();

    prismaMock.inspection.findUnique.mockResolvedValue({ id: 'inspection-id' });

    configMock.get.mockImplementation((key: string) => {
      if (key === 'USE_BACKBLAZE_PHOTOS') {
        return 'true';
      }
      if (key === 'LOCAL_PHOTO_BASE_URL') {
        return '/uploads';
      }
      if (key === 'BACKBLAZE_PUBLIC_BASE_URL') {
        return 'https://cdn.example.com/photos';
      }
      return undefined;
    });

    backblazeMock.isConfigured.mockReturnValue(true);
    backblazeMock.uploadPhotoBuffer.mockResolvedValue({
      fileId: 'file-id',
      fileName: 'inspection-photos/2025/01/file.jpg',
      publicUrl: 'https://cdn.example.com/photos/inspection-photos/2025/01/file.jpg',
    });

    prismaMock.photo.create.mockResolvedValue({
      id: 'photo-id',
      inspectionId: 'inspection-id',
      path: 'inspection-photos/2025/01/file.jpg',
      publicUrl: 'https://cdn.example.com/photos/inspection-photos/2025/01/file.jpg',
      backblazeFileId: 'file-id',
      backblazeFileName: 'inspection-photos/2025/01/file.jpg',
      label: null,
      category: null,
      isMandatory: false,
      originalLabel: null,
      needAttention: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      displayInPdf: true,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PhotosService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ConfigService, useValue: configMock },
        { provide: BackblazeService, useValue: backblazeMock },
        { provide: MetricsService, useValue: metricsMock },
      ],
    }).compile();

    service = module.get<PhotosService>(PhotosService);
  });

  it('should upload photo to Backblaze when feature flag enabled', async () => {
    const file: Express.Multer.File = {
      fieldname: 'photo',
      originalname: 'damage.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      size: 1024,
      stream: undefined as any,
      destination: undefined as any,
      filename: undefined as any,
      path: undefined as any,
      buffer: Buffer.from('test'),
    };

    const photo = await service.addPhoto('inspection-id', file, {
      label: 'Damage',
      needAttention: 'true',
      isMandatory: 'false',
      category: 'EXTERIOR',
    });

    expect(backblazeMock.uploadPhotoBuffer).toHaveBeenCalledTimes(1);
    expect(prismaMock.photo.create).toHaveBeenCalledTimes(1);
    expect(photo.publicUrl).toContain('https://cdn.example.com/photos');
    expect(metricsMock.recordPhotoUpload).toHaveBeenCalledWith(
      'backblaze',
      true,
      expect.any(Number),
    );
  });

  it('should reject when file buffer missing', async () => {
    const file: Express.Multer.File = {
      fieldname: 'photo',
      originalname: 'damage.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      size: 1024,
      stream: undefined as any,
      destination: undefined as any,
      filename: undefined as any,
      path: undefined as any,
      buffer: undefined as any,
    };

    await expect(
      service.addPhoto('inspection-id', file, {
        label: 'Damage',
        needAttention: 'true',
        isMandatory: 'false',
        category: 'EXTERIOR',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
