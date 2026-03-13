import { Test, TestingModule } from '@nestjs/testing';
import { PhotosService } from './photos.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

// ─── Mock Data ────────────────────────────────────────────────────────────────

const mockInspectionId = 'insp-001';
const mockPhotoId = 'photo-001';

const mockPhoto = {
  id: mockPhotoId,
  inspectionId: mockInspectionId,
  path: 'uploads/test.jpg',
  label: 'Front view',
  category: 'exterior',
  isMandatory: false,
  originalLabel: null,
  needAttention: false,
  displayInPdf: true,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

const mockInspectionWithPhotos = {
  id: mockInspectionId,
  photos: [mockPhoto],
};

const mockFile = {
  filename: 'test.jpg',
  location: undefined, // local storage path
  originalname: 'test.jpg',
  mimetype: 'image/jpeg',
  size: 1024,
  buffer: Buffer.from(''),
  fieldname: 'file',
  encoding: '7bit',
  destination: './uploads',
  path: './uploads/test.jpg',
  stream: null,
} as unknown as Express.Multer.File;

// ─── Mock Prisma ──────────────────────────────────────────────────────────────

const mockPrismaService = {
  inspection: {
    findUnique: jest.fn(),
  },
  photo: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    createMany: jest.fn(),
  },
};

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('PhotosService', () => {
  let service: PhotosService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PhotosService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<PhotosService>(PhotosService);
    prisma = module.get<PrismaService>(PrismaService) as any;

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // addPhoto
  // ──────────────────────────────────────────────────────────────────────────
  describe('addPhoto', () => {
    const dto = { label: 'Front', needAttention: 'false', isMandatory: 'false', category: 'exterior' };

    it('should create and return a photo record', async () => {
      mockPrismaService.photo.create.mockResolvedValue(mockPhoto);

      const result = await service.addPhoto(mockInspectionId, mockFile, dto as any);

      expect(result).toEqual(mockPhoto);
      expect(mockPrismaService.photo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            inspection: { connect: { id: mockInspectionId } },
            path: mockFile.filename,
            needAttention: false,
            isMandatory: false,
          }),
        }),
      );
    });

    it('should use S3 location when file.location is defined', async () => {
      const s3File = { ...mockFile, location: 'https://s3.example.com/photo.jpg' } as any;
      mockPrismaService.photo.create.mockResolvedValue({ ...mockPhoto, path: s3File.location });

      const result = await service.addPhoto(mockInspectionId, s3File, dto as any);

      expect(mockPrismaService.photo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ path: s3File.location }),
        }),
      );
      expect(result.path).toBe(s3File.location);
    });

    it('should treat empty label string as undefined', async () => {
      mockPrismaService.photo.create.mockResolvedValue({ ...mockPhoto, label: undefined });

      await service.addPhoto(mockInspectionId, mockFile, { ...dto, label: '' } as any);

      expect(mockPrismaService.photo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ label: undefined }),
        }),
      );
    });

    it('should throw NotFoundException when FK constraint violated (P2003)', async () => {
      const fkError = new Prisma.PrismaClientKnownRequestError('FK violation', {
        code: 'P2003',
        clientVersion: '5.0.0',
      });
      mockPrismaService.photo.create.mockRejectedValue(fkError);

      await expect(
        service.addPhoto('non-existent', mockFile, dto as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw InternalServerErrorException on generic DB error', async () => {
      mockPrismaService.photo.create.mockRejectedValue(new Error('DB error'));

      await expect(
        service.addPhoto(mockInspectionId, mockFile, dto as any),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should parse needAttention and isMandatory as booleans from string', async () => {
      mockPrismaService.photo.create.mockResolvedValue({ ...mockPhoto, needAttention: true, isMandatory: true });

      await service.addPhoto(
        mockInspectionId,
        mockFile,
        { label: 'X', needAttention: 'true', isMandatory: 'true', category: 'ext' } as any,
      );

      expect(mockPrismaService.photo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ needAttention: true, isMandatory: true }),
        }),
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // findForInspection
  // ──────────────────────────────────────────────────────────────────────────
  describe('findForInspection', () => {
    it('should return photos array for existing inspection', async () => {
      mockPrismaService.inspection.findUnique.mockResolvedValue(mockInspectionWithPhotos);

      const result = await service.findForInspection(mockInspectionId);

      expect(result).toEqual([mockPhoto]);
      expect(mockPrismaService.inspection.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockInspectionId },
          include: { photos: { orderBy: { createdAt: 'asc' } } },
        }),
      );
    });

    it('should return empty array when inspection has no photos', async () => {
      mockPrismaService.inspection.findUnique.mockResolvedValue({ id: mockInspectionId, photos: [] });

      const result = await service.findForInspection(mockInspectionId);

      expect(result).toEqual([]);
    });

    it('should throw NotFoundException when inspection does not exist', async () => {
      mockPrismaService.inspection.findUnique.mockResolvedValue(null);

      await expect(
        service.findForInspection('non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // updatePhoto
  // ──────────────────────────────────────────────────────────────────────────
  describe('updatePhoto', () => {
    it('should update label and return updated photo', async () => {
      mockPrismaService.photo.findUniqueOrThrow.mockResolvedValue(mockPhoto);
      const updatedPhoto = { ...mockPhoto, label: 'New label' };
      mockPrismaService.photo.update.mockResolvedValue(updatedPhoto);

      const result = await service.updatePhoto(
        mockInspectionId,
        mockPhotoId,
        { label: 'New label' } as any,
      );

      expect(result.label).toBe('New label');
      expect(mockPrismaService.photo.update).toHaveBeenCalled();
    });

    it('should update needAttention from string to boolean', async () => {
      mockPrismaService.photo.findUniqueOrThrow.mockResolvedValue(mockPhoto);
      mockPrismaService.photo.update.mockResolvedValue({ ...mockPhoto, needAttention: true });

      await service.updatePhoto(
        mockInspectionId,
        mockPhotoId,
        { needAttention: 'true' } as any,
      );

      expect(mockPrismaService.photo.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ needAttention: true }),
        }),
      );
    });

    it('should update displayInPdf from string to boolean', async () => {
      mockPrismaService.photo.findUniqueOrThrow.mockResolvedValue(mockPhoto);
      mockPrismaService.photo.update.mockResolvedValue({ ...mockPhoto, displayInPdf: false });

      await service.updatePhoto(
        mockInspectionId,
        mockPhotoId,
        { displayInPdf: 'false' } as any,
      );

      expect(mockPrismaService.photo.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ displayInPdf: false }),
        }),
      );
    });

    it('should return existing photo without DB call when no changes provided', async () => {
      mockPrismaService.photo.findUniqueOrThrow.mockResolvedValue(mockPhoto);

      const result = await service.updatePhoto(
        mockInspectionId,
        mockPhotoId,
        {} as any,
      );

      expect(result).toEqual(mockPhoto);
      expect(mockPrismaService.photo.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when photo not found (P2025)', async () => {
      const notFoundError = new Prisma.PrismaClientKnownRequestError('Not found', {
        code: 'P2025',
        clientVersion: '5.0.0',
      });
      mockPrismaService.photo.findUniqueOrThrow.mockRejectedValue(notFoundError);

      await expect(
        service.updatePhoto(mockInspectionId, 'bad-id', { label: 'x' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update file path when new photo file provided', async () => {
      const photoWithLocalPath = { ...mockPhoto, path: 'uploads/old.jpg' };
      mockPrismaService.photo.findUniqueOrThrow.mockResolvedValue(photoWithLocalPath);
      const newFile = { ...mockFile, filename: 'new.jpg' } as any;
      mockPrismaService.photo.update.mockResolvedValue({ ...photoWithLocalPath, path: 'new.jpg' });

      // Mock fs.unlink to avoid actual filesystem operations
      jest.spyOn(require('fs/promises'), 'unlink').mockResolvedValue(undefined);

      const result = await service.updatePhoto(
        mockInspectionId,
        mockPhotoId,
        {} as any,
        newFile,
      );

      expect(mockPrismaService.photo.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ path: 'new.jpg' }),
        }),
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // deletePhoto
  // ──────────────────────────────────────────────────────────────────────────
  describe('deletePhoto', () => {
    it('should delete photo record successfully', async () => {
      mockPrismaService.photo.findUniqueOrThrow.mockResolvedValue({ path: 'https://s3.example.com/photo.jpg' });
      mockPrismaService.photo.delete.mockResolvedValue(mockPhoto);

      await service.deletePhoto(mockPhotoId);

      expect(mockPrismaService.photo.delete).toHaveBeenCalledWith({ where: { id: mockPhotoId } });
    });

    it('should throw NotFoundException when photo not found (P2025)', async () => {
      const notFoundError = new Prisma.PrismaClientKnownRequestError('Not found', {
        code: 'P2025',
        clientVersion: '5.0.0',
      });
      mockPrismaService.photo.findUniqueOrThrow.mockRejectedValue(notFoundError);

      await expect(service.deletePhoto('bad-id')).rejects.toThrow(NotFoundException);
    });

    it('should throw InternalServerErrorException on unknown DB error', async () => {
      mockPrismaService.photo.findUniqueOrThrow.mockRejectedValue(new Error('DB crash'));

      await expect(service.deletePhoto(mockPhotoId)).rejects.toThrow(InternalServerErrorException);
    });

    it('should skip local file deletion when path is an HTTP URL', async () => {
      const httpPhoto = { path: 'https://cdn.example.com/photo.jpg' };
      mockPrismaService.photo.findUniqueOrThrow.mockResolvedValue(httpPhoto);
      mockPrismaService.photo.delete.mockResolvedValue(mockPhoto);

      const unlinkSpy = jest.spyOn(require('fs/promises'), 'unlink');

      await service.deletePhoto(mockPhotoId);

      expect(unlinkSpy).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // addMultiplePhotos
  // ──────────────────────────────────────────────────────────────────────────
  describe('addMultiplePhotos', () => {
    const metadataJson = JSON.stringify([
      { label: 'Front', category: 'exterior', isMandatory: false, needAttention: false },
    ]);

    it('should create multiple photos and return them', async () => {
      mockPrismaService.photo.createMany.mockResolvedValue({ count: 1 });
      mockPrismaService.photo.findMany.mockResolvedValue([mockPhoto]);

      const result = await service.addMultiplePhotos(mockInspectionId, [mockFile], metadataJson);

      expect(result).toHaveLength(1);
      expect(mockPrismaService.photo.createMany).toHaveBeenCalled();
      expect(mockPrismaService.photo.findMany).toHaveBeenCalled();
    });

    it('should throw BadRequestException when no files provided', async () => {
      await expect(
        service.addMultiplePhotos(mockInspectionId, [], metadataJson),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when metadata string is missing', async () => {
      await expect(
        service.addMultiplePhotos(mockInspectionId, [mockFile], ''),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when metadata count mismatches file count', async () => {
      const twoItems = JSON.stringify([
        { label: 'A', category: 'ext', isMandatory: false, needAttention: false },
        { label: 'B', category: 'ext', isMandatory: false, needAttention: false },
      ]);

      await expect(
        service.addMultiplePhotos(mockInspectionId, [mockFile], twoItems),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when metadata is not a valid JSON array', async () => {
      await expect(
        service.addMultiplePhotos(mockInspectionId, [mockFile], '"not an array"'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when metadata JSON is malformed', async () => {
      await expect(
        service.addMultiplePhotos(mockInspectionId, [mockFile], '{invalid json}'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException on FK violation (P2003)', async () => {
      mockPrismaService.photo.createMany.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('FK violation', {
          code: 'P2003',
          clientVersion: '5.0.0',
        }),
      );

      await expect(
        service.addMultiplePhotos('non-existent', [mockFile], metadataJson),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw InternalServerErrorException on generic DB error', async () => {
      mockPrismaService.photo.createMany.mockRejectedValue(new Error('DB crash'));

      await expect(
        service.addMultiplePhotos(mockInspectionId, [mockFile], metadataJson),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should use S3 location when file.location is defined', async () => {
      const s3File = { ...mockFile, location: 'https://s3.example.com/file.jpg' } as any;
      mockPrismaService.photo.createMany.mockResolvedValue({ count: 1 });
      mockPrismaService.photo.findMany.mockResolvedValue([{ ...mockPhoto, path: s3File.location }]);

      const result = await service.addMultiplePhotos(mockInspectionId, [s3File], metadataJson);

      expect(mockPrismaService.photo.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ path: s3File.location }),
          ]),
        }),
      );
    });
  });
});
