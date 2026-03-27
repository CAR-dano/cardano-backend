/*
 * --------------------------------------------------------------------------
 * File: inspection-branches.service.spec.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Unit tests for InspectionBranchesService
 * --------------------------------------------------------------------------
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { InspectionBranchesService } from './inspection-branches.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeBranch = (overrides: Record<string, unknown> = {}) => ({
  id: 'branch-1',
  city: 'Yogyakarta',
  code: 'YOG',
  isActive: true,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const buildPrismaMock = () => ({
  inspectionBranchCity: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  // executeWithReconnect: delegates to the provided callback
  executeWithReconnect: jest
    .fn()
    .mockImplementation((_label: string, fn: () => unknown) => fn()),
});

const buildRedisMock = () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(true),
  delete: jest.fn().mockResolvedValue(true),
});

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('InspectionBranchesService', () => {
  let service: InspectionBranchesService;
  let prismaMock: ReturnType<typeof buildPrismaMock>;
  let redisMock: ReturnType<typeof buildRedisMock>;

  beforeEach(async () => {
    prismaMock = buildPrismaMock();
    redisMock = buildRedisMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InspectionBranchesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RedisService, useValue: redisMock },
      ],
    }).compile();

    service = module.get<InspectionBranchesService>(InspectionBranchesService);
  });

  afterEach(() => jest.clearAllMocks());

  // -------------------------------------------------------------------------
  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // -------------------------------------------------------------------------
  describe('create', () => {
    it('should create a branch with code derived from first 3 chars of city', async () => {
      const dto = { city: 'Yogyakarta', code: 'YOG', isActive: true };
      const created = makeBranch();
      prismaMock.inspectionBranchCity.create.mockResolvedValue(created);

      const result = await service.create(dto);

      expect(prismaMock.inspectionBranchCity.create).toHaveBeenCalledWith({
        data: { city: 'Yogyakarta', code: 'YOG', isActive: true },
      });
      expect(result).toEqual(created);
    });

    it('should invalidate the cache after creation', async () => {
      const dto = { city: 'Solo', code: 'SOL', isActive: false };
      prismaMock.inspectionBranchCity.create.mockResolvedValue(
        makeBranch({ city: 'Solo', code: 'SOL' }),
      );

      await service.create(dto);

      expect(redisMock.delete).toHaveBeenCalledWith('branches:all');
    });

    it('should uppercase the 3-char code', async () => {
      const dto = { city: 'bandung', code: 'BAN', isActive: true };
      prismaMock.inspectionBranchCity.create.mockResolvedValue(
        makeBranch({ city: 'bandung', code: 'BAN' }),
      );

      await service.create(dto);

      expect(prismaMock.inspectionBranchCity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ code: 'BAN' }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  describe('findAll', () => {
    it('should return cached branches when cache hits', async () => {
      const branches = [makeBranch()];
      redisMock.get.mockResolvedValue(JSON.stringify(branches));

      const result = await service.findAll();

      // JSON roundtrip converts Date objects to strings — compare accordingly
      expect(result).toEqual(JSON.parse(JSON.stringify(branches)));
      expect(prismaMock.executeWithReconnect).not.toHaveBeenCalled();
    });

    it('should query DB and cache result on cache miss', async () => {
      const branches = [makeBranch()];
      redisMock.get.mockResolvedValue(null);
      prismaMock.inspectionBranchCity.findMany.mockResolvedValue(branches);

      const result = await service.findAll();

      expect(prismaMock.executeWithReconnect).toHaveBeenCalled();
      expect(redisMock.set).toHaveBeenCalledWith(
        'branches:all',
        JSON.stringify(branches),
        86400,
      );
      expect(result).toEqual(branches);
    });

    it('should fall through to DB when cache throws', async () => {
      const branches = [makeBranch()];
      redisMock.get.mockRejectedValue(new Error('Redis down'));
      prismaMock.inspectionBranchCity.findMany.mockResolvedValue(branches);

      const result = await service.findAll();

      expect(result).toEqual(branches);
    });

    it('should still return branches even when cache write fails', async () => {
      const branches = [makeBranch()];
      redisMock.get.mockResolvedValue(null);
      prismaMock.inspectionBranchCity.findMany.mockResolvedValue(branches);
      redisMock.set.mockRejectedValue(new Error('Redis write error'));

      const result = await service.findAll();

      expect(result).toEqual(branches);
    });
  });

  // -------------------------------------------------------------------------
  describe('findOne', () => {
    it('should return cached branch on cache hit', async () => {
      const branch = makeBranch();
      redisMock.get.mockResolvedValue(JSON.stringify(branch));

      const result = await service.findOne('branch-1');

      // JSON roundtrip converts Date objects to strings — compare accordingly
      expect(result).toEqual(JSON.parse(JSON.stringify(branch)));
      expect(prismaMock.inspectionBranchCity.findUnique).not.toHaveBeenCalled();
    });

    it('should query DB and cache result on cache miss', async () => {
      const branch = makeBranch();
      redisMock.get.mockResolvedValue(null);
      prismaMock.inspectionBranchCity.findUnique.mockResolvedValue(branch);

      const result = await service.findOne('branch-1');

      expect(prismaMock.inspectionBranchCity.findUnique).toHaveBeenCalledWith({
        where: { id: 'branch-1' },
      });
      expect(redisMock.set).toHaveBeenCalledWith(
        'branch:branch-1',
        JSON.stringify(branch),
        86400,
      );
      expect(result).toEqual(branch);
    });

    it('should throw NotFoundException when branch not found in DB', async () => {
      redisMock.get.mockResolvedValue(null);
      prismaMock.inspectionBranchCity.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should fall through to DB when cache throws', async () => {
      const branch = makeBranch();
      redisMock.get.mockRejectedValue(new Error('Redis err'));
      prismaMock.inspectionBranchCity.findUnique.mockResolvedValue(branch);

      const result = await service.findOne('branch-1');

      expect(result).toEqual(branch);
    });
  });

  // -------------------------------------------------------------------------
  describe('update', () => {
    it('should update the branch and invalidate cache', async () => {
      const existing = makeBranch();
      const updated = makeBranch({ city: 'Sleman', isActive: false });

      // findOne internals: cache miss → DB
      redisMock.get.mockResolvedValue(JSON.stringify(existing));
      prismaMock.inspectionBranchCity.update.mockResolvedValue(updated);

      const result = await service.update('branch-1', {
        city: 'Sleman',
        isActive: false,
      });

      expect(prismaMock.inspectionBranchCity.update).toHaveBeenCalledWith({
        where: { id: 'branch-1' },
        data: { city: 'Sleman', isActive: false },
      });
      expect(redisMock.delete).toHaveBeenCalledWith('branches:all');
      expect(redisMock.delete).toHaveBeenCalledWith('branch:branch-1');
      expect(result).toEqual(updated);
    });

    it('should throw NotFoundException when branch not found', async () => {
      redisMock.get.mockResolvedValue(null);
      prismaMock.inspectionBranchCity.findUnique.mockResolvedValue(null);

      await expect(
        service.update('missing-id', { city: 'X', isActive: true }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  describe('remove', () => {
    it('should delete the branch and invalidate cache', async () => {
      const branch = makeBranch();
      redisMock.get.mockResolvedValue(JSON.stringify(branch));
      prismaMock.inspectionBranchCity.delete.mockResolvedValue(branch);

      const result = await service.remove('branch-1');

      expect(prismaMock.inspectionBranchCity.delete).toHaveBeenCalledWith({
        where: { id: 'branch-1' },
      });
      expect(redisMock.delete).toHaveBeenCalledWith('branches:all');
      expect(redisMock.delete).toHaveBeenCalledWith('branch:branch-1');
      expect(result).toEqual(branch);
    });

    it('should throw NotFoundException when branch not found', async () => {
      redisMock.get.mockResolvedValue(null);
      prismaMock.inspectionBranchCity.findUnique.mockResolvedValue(null);

      await expect(service.remove('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // -------------------------------------------------------------------------
  describe('toggleActive', () => {
    it('should flip isActive from true to false', async () => {
      const branch = makeBranch({ isActive: true });
      const toggled = makeBranch({ isActive: false });
      redisMock.get.mockResolvedValue(JSON.stringify(branch));
      prismaMock.inspectionBranchCity.update.mockResolvedValue(toggled);

      const result = await service.toggleActive('branch-1');

      expect(prismaMock.inspectionBranchCity.update).toHaveBeenCalledWith({
        where: { id: 'branch-1' },
        data: { isActive: false },
      });
      expect(result).toEqual(toggled);
    });

    it('should flip isActive from false to true', async () => {
      const branch = makeBranch({ isActive: false });
      const toggled = makeBranch({ isActive: true });
      redisMock.get.mockResolvedValue(JSON.stringify(branch));
      prismaMock.inspectionBranchCity.update.mockResolvedValue(toggled);

      const result = await service.toggleActive('branch-1');

      expect(prismaMock.inspectionBranchCity.update).toHaveBeenCalledWith({
        where: { id: 'branch-1' },
        data: { isActive: true },
      });
      expect(result).toEqual(toggled);
    });

    it('should throw NotFoundException when branch not found', async () => {
      redisMock.get.mockResolvedValue(null);
      prismaMock.inspectionBranchCity.findUnique.mockResolvedValue(null);

      await expect(service.toggleActive('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should invalidate cache after toggling', async () => {
      const branch = makeBranch({ isActive: true });
      redisMock.get.mockResolvedValue(JSON.stringify(branch));
      prismaMock.inspectionBranchCity.update.mockResolvedValue(
        makeBranch({ isActive: false }),
      );

      await service.toggleActive('branch-1');

      expect(redisMock.delete).toHaveBeenCalledWith('branches:all');
      expect(redisMock.delete).toHaveBeenCalledWith('branch:branch-1');
    });
  });
});
