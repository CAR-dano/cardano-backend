/*
 * --------------------------------------------------------------------------
 * File: public-api.service.spec.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Unit tests for PublicApiService
 * --------------------------------------------------------------------------
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  InternalServerErrorException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PublicApiService } from './public-api.service';
import { PrismaService } from '../prisma/prisma.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePrismaNotFound(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Record not found', {
    code: 'P2025',
    clientVersion: '0.0.0',
  });
}

const makePhoto = (overrides: Record<string, unknown> = {}) => ({
  id: 'photo-1',
  label: 'Eksterior Depan',
  category: 'eksterior',
  url: 'http://example.com/photo.jpg',
  ...overrides,
});

const makeInspection = (overrides: Record<string, unknown> = {}) => ({
  id: 'insp-1',
  photos: [],
  changeLogs: [],
  ...overrides,
});

const makeChangeLog = (overrides: Record<string, unknown> = {}) => ({
  id: 'cl-1',
  inspectionId: 'insp-1',
  fieldName: 'mesin',
  subFieldName: 'kondisi',
  subsubfieldname: null,
  oldValue: 'Baik',
  newValue: 'Rusak',
  changedAt: new Date('2025-01-01T00:00:00Z'),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------

const buildPrismaMock = () => ({
  inspection: {
    findUniqueOrThrow: jest.fn(),
    findUnique: jest.fn(),
  },
});

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('PublicApiService', () => {
  let service: PublicApiService;
  let prismaMock: ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    prismaMock = buildPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublicApiService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<PublicApiService>(PublicApiService);
  });

  afterEach(() => jest.clearAllMocks());

  // -------------------------------------------------------------------------
  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // -------------------------------------------------------------------------
  describe('findOne', () => {
    it('should return the inspection when found', async () => {
      const inspection = makeInspection({ photos: [makePhoto()] });
      prismaMock.inspection.findUniqueOrThrow.mockResolvedValue(inspection);

      const result = (await service.findOne('insp-1')) as any;

      expect(result).toEqual(inspection);
      expect(prismaMock.inspection.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: 'insp-1' },
        include: { photos: true },
      });
    });

    it('should throw NotFoundException on P2025 error', async () => {
      prismaMock.inspection.findUniqueOrThrow.mockRejectedValue(
        makePrismaNotFound(),
      );

      await expect(service.findOne('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should re-throw ForbiddenException as-is', async () => {
      prismaMock.inspection.findUniqueOrThrow.mockRejectedValue(
        new ForbiddenException('no access'),
      );

      await expect(service.findOne('insp-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw InternalServerErrorException for unexpected errors', async () => {
      prismaMock.inspection.findUniqueOrThrow.mockRejectedValue(
        new Error('DB timeout'),
      );

      await expect(service.findOne('insp-1')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw InternalServerErrorException for non-Error throws', async () => {
      prismaMock.inspection.findUniqueOrThrow.mockRejectedValue('string error');

      await expect(service.findOne('insp-1')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // -------------------------------------------------------------------------
  describe('findOneWithoutDocuments', () => {
    it('should return inspection with all photos when none are document photos', async () => {
      const photos = [
        makePhoto({ label: 'Eksterior Depan', category: 'eksterior' }),
        makePhoto({ id: 'photo-2', label: 'Interior', category: 'interior' }),
      ];
      const inspection = makeInspection({ photos });
      prismaMock.inspection.findUniqueOrThrow.mockResolvedValue(inspection);

      const result = (await service.findOneWithoutDocuments('insp-1')) as any;

      expect(result.photos).toHaveLength(2);
    });

    it('should filter out photos with label containing "stnk"', async () => {
      const photos = [
        makePhoto({ id: 'p1', label: 'stnk kendaraan', category: 'lain' }),
        makePhoto({ id: 'p2', label: 'Eksterior', category: 'eksterior' }),
      ];
      prismaMock.inspection.findUniqueOrThrow.mockResolvedValue(
        makeInspection({ photos }),
      );

      const result = (await service.findOneWithoutDocuments('insp-1')) as any;

      expect(result.photos).toHaveLength(1);
      expect(result.photos[0].id).toBe('p2');
    });

    it('should filter out photos with label "STNK" (uppercase)', async () => {
      const photos = [
        makePhoto({ id: 'p1', label: 'STNK', category: 'dokumen' }),
        makePhoto({ id: 'p2', label: 'Foto Ban', category: 'roda' }),
      ];
      prismaMock.inspection.findUniqueOrThrow.mockResolvedValue(
        makeInspection({ photos }),
      );

      const result = (await service.findOneWithoutDocuments('insp-1')) as any;

      expect(result.photos).toHaveLength(1);
      expect(result.photos[0].id).toBe('p2');
    });

    it('should filter out photos with category containing "bpkb"', async () => {
      const photos = [
        makePhoto({ id: 'p1', label: 'Dokumen BPKB', category: 'bpkb' }),
        makePhoto({ id: 'p2', label: 'Mesin', category: 'mesin' }),
      ];
      prismaMock.inspection.findUniqueOrThrow.mockResolvedValue(
        makeInspection({ photos }),
      );

      const result = (await service.findOneWithoutDocuments('insp-1')) as any;

      expect(result.photos).toHaveLength(1);
    });

    it('should filter out photos with label "Foto Dokumen"', async () => {
      const photos = [
        makePhoto({ id: 'p1', label: 'Foto Dokumen', category: 'doc' }),
        makePhoto({ id: 'p2', label: 'Ban', category: 'ban' }),
      ];
      prismaMock.inspection.findUniqueOrThrow.mockResolvedValue(
        makeInspection({ photos }),
      );

      const result = (await service.findOneWithoutDocuments('insp-1')) as any;

      expect(result.photos).toHaveLength(1);
    });

    it('should handle photos with null label or category gracefully', async () => {
      const photos = [
        makePhoto({ id: 'p1', label: null, category: null }),
        makePhoto({ id: 'p2', label: 'stnk', category: null }),
      ];
      prismaMock.inspection.findUniqueOrThrow.mockResolvedValue(
        makeInspection({ photos }),
      );

      const result = (await service.findOneWithoutDocuments('insp-1')) as any;

      // p1 has null label/category — kept; p2 has stnk — filtered
      expect(result.photos).toHaveLength(1);
      expect(result.photos[0].id).toBe('p1');
    });

    it('should handle inspection with no photos array', async () => {
      prismaMock.inspection.findUniqueOrThrow.mockResolvedValue(
        makeInspection({ photos: null }),
      );

      const result = (await service.findOneWithoutDocuments('insp-1')) as any;

      expect(result.photos).toBeNull();
    });

    it('should throw NotFoundException on P2025 error', async () => {
      prismaMock.inspection.findUniqueOrThrow.mockRejectedValue(
        makePrismaNotFound(),
      );

      await expect(
        service.findOneWithoutDocuments('missing-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw InternalServerErrorException for unexpected errors', async () => {
      prismaMock.inspection.findUniqueOrThrow.mockRejectedValue(
        new Error('Connection reset'),
      );

      await expect(service.findOneWithoutDocuments('insp-1')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // -------------------------------------------------------------------------
  describe('findChangesByInspectionId', () => {
    it('should throw NotFoundException when inspection not found', async () => {
      prismaMock.inspection.findUnique.mockResolvedValue(null);

      await expect(
        service.findChangesByInspectionId('missing-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return empty array when inspection has no change logs', async () => {
      prismaMock.inspection.findUnique.mockResolvedValue(
        makeInspection({ changeLogs: [] }),
      );

      const result = await service.findChangesByInspectionId('insp-1');

      expect(result).toEqual([]);
    });

    it('should return unique latest change logs per field key', async () => {
      const log1 = makeChangeLog({
        id: 'cl-1',
        fieldName: 'mesin',
        subFieldName: 'kondisi',
        subsubfieldname: null,
        changedAt: new Date('2025-01-02T00:00:00Z'),
      });
      const log2 = makeChangeLog({
        id: 'cl-2',
        fieldName: 'mesin',
        subFieldName: 'kondisi',
        subsubfieldname: null,
        changedAt: new Date('2025-01-01T00:00:00Z'), // older
      });
      const log3 = makeChangeLog({
        id: 'cl-3',
        fieldName: 'bodi',
        subFieldName: 'cat',
        subsubfieldname: null,
        changedAt: new Date('2025-01-01T00:00:00Z'),
      });

      // DB already returns sorted desc (newest first)
      prismaMock.inspection.findUnique.mockResolvedValue(
        makeInspection({ changeLogs: [log1, log2, log3] }),
      );

      const result = await service.findChangesByInspectionId('insp-1');

      // Only one entry per unique key
      expect(result).toHaveLength(2);
      // First entry for mesin-kondisi should be the newest one (cl-1)
      const mesinLog = result.find((l) => l.fieldName === 'mesin');
      expect(mesinLog?.id).toBe('cl-1');
    });

    it('should query with correct include and orderBy', async () => {
      prismaMock.inspection.findUnique.mockResolvedValue(
        makeInspection({ changeLogs: [] }),
      );

      await service.findChangesByInspectionId('insp-1');

      expect(prismaMock.inspection.findUnique).toHaveBeenCalledWith({
        where: { id: 'insp-1' },
        include: {
          changeLogs: {
            orderBy: { changedAt: 'desc' },
          },
        },
      });
    });

    it('should keep separate logs for different field keys', async () => {
      const logs = [
        makeChangeLog({
          id: 'cl-1',
          fieldName: 'a',
          subFieldName: 'x',
          subsubfieldname: null,
        }),
        makeChangeLog({
          id: 'cl-2',
          fieldName: 'a',
          subFieldName: 'y',
          subsubfieldname: null,
        }),
        makeChangeLog({
          id: 'cl-3',
          fieldName: 'b',
          subFieldName: 'x',
          subsubfieldname: null,
        }),
      ];
      prismaMock.inspection.findUnique.mockResolvedValue(
        makeInspection({ changeLogs: logs }),
      );

      const result = await service.findChangesByInspectionId('insp-1');

      expect(result).toHaveLength(3);
    });

    it('should differentiate logs by subsubfieldname', async () => {
      const logs = [
        makeChangeLog({
          id: 'cl-1',
          fieldName: 'a',
          subFieldName: 'x',
          subsubfieldname: 'i',
        }),
        makeChangeLog({
          id: 'cl-2',
          fieldName: 'a',
          subFieldName: 'x',
          subsubfieldname: 'ii',
        }),
      ];
      prismaMock.inspection.findUnique.mockResolvedValue(
        makeInspection({ changeLogs: logs }),
      );

      const result = await service.findChangesByInspectionId('insp-1');

      expect(result).toHaveLength(2);
    });
  });
});
