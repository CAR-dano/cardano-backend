/*
 * --------------------------------------------------------------------------
 * File: inspection-branches.controller.spec.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Unit tests for InspectionBranchesController
 * --------------------------------------------------------------------------
 */

import { Test, TestingModule } from '@nestjs/testing';
import { InspectionBranchesController } from './inspection-branches.controller';
import { InspectionBranchesService } from './inspection-branches.service';
import { NotFoundException } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

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

const mockInspectionBranchesService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  toggleActive: jest.fn(),
};

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('InspectionBranchesController', () => {
  let controller: InspectionBranchesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InspectionBranchesController],
      providers: [
        {
          provide: InspectionBranchesService,
          useValue: mockInspectionBranchesService,
        },
      ],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<InspectionBranchesController>(InspectionBranchesController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // -------------------------------------------------------------------------
  describe('create', () => {
    it('should create a new branch and return it', async () => {
      const dto = { city: 'Yogyakarta', isActive: true };
      const branch = makeBranch();
      mockInspectionBranchesService.create.mockResolvedValue(branch);

      const result = await controller.create(dto as any);

      expect(mockInspectionBranchesService.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(branch);
    });

    it('should propagate errors from service', async () => {
      mockInspectionBranchesService.create.mockRejectedValue(new Error('DB error'));

      await expect(
        controller.create({ city: 'X', isActive: true } as any),
      ).rejects.toThrow('DB error');
    });
  });

  // -------------------------------------------------------------------------
  describe('findAll', () => {
    it('should return all branches', async () => {
      const branches = [makeBranch(), makeBranch({ id: 'branch-2', city: 'Solo' })];
      mockInspectionBranchesService.findAll.mockResolvedValue(branches);

      const result = await controller.findAll();

      expect(mockInspectionBranchesService.findAll).toHaveBeenCalled();
      expect(result).toEqual(branches);
    });

    it('should return empty array when no branches exist', async () => {
      mockInspectionBranchesService.findAll.mockResolvedValue([]);

      const result = await controller.findAll();

      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  describe('findOne', () => {
    it('should return a branch by id', async () => {
      const branch = makeBranch();
      mockInspectionBranchesService.findOne.mockResolvedValue(branch);

      const result = await controller.findOne('branch-1');

      expect(mockInspectionBranchesService.findOne).toHaveBeenCalledWith('branch-1');
      expect(result).toEqual(branch);
    });

    it('should throw NotFoundException when branch not found', async () => {
      mockInspectionBranchesService.findOne.mockRejectedValue(
        new NotFoundException('Branch not found'),
      );

      await expect(controller.findOne('missing-id')).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  describe('update', () => {
    it('should update a branch and return the updated data', async () => {
      const dto = { city: 'Sleman', isActive: false };
      const updated = makeBranch({ city: 'Sleman', isActive: false });
      mockInspectionBranchesService.update.mockResolvedValue(updated);

      const result = await controller.update('branch-1', dto as any);

      expect(mockInspectionBranchesService.update).toHaveBeenCalledWith('branch-1', dto);
      expect(result).toEqual(updated);
    });

    it('should throw NotFoundException when branch not found', async () => {
      mockInspectionBranchesService.update.mockRejectedValue(
        new NotFoundException('Branch not found'),
      );

      await expect(
        controller.update('missing-id', { city: 'X', isActive: true } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  describe('remove', () => {
    it('should delete a branch and return the deleted data', async () => {
      const branch = makeBranch();
      mockInspectionBranchesService.remove.mockResolvedValue(branch);

      const result = await controller.remove('branch-1');

      expect(mockInspectionBranchesService.remove).toHaveBeenCalledWith('branch-1');
      expect(result).toEqual(branch);
    });

    it('should throw NotFoundException when branch not found', async () => {
      mockInspectionBranchesService.remove.mockRejectedValue(
        new NotFoundException('Branch not found'),
      );

      await expect(controller.remove('missing-id')).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  describe('toggleActive', () => {
    it('should toggle the active status of a branch', async () => {
      const toggled = makeBranch({ isActive: false });
      mockInspectionBranchesService.toggleActive.mockResolvedValue(toggled);

      const result = await controller.toggleActive('branch-1');

      expect(mockInspectionBranchesService.toggleActive).toHaveBeenCalledWith('branch-1');
      expect(result).toEqual(toggled);
    });

    it('should throw NotFoundException when branch not found', async () => {
      mockInspectionBranchesService.toggleActive.mockRejectedValue(
        new NotFoundException('Branch not found'),
      );

      await expect(controller.toggleActive('missing-id')).rejects.toThrow(NotFoundException);
    });

    it('should return branch with toggled isActive from false to true', async () => {
      const toggled = makeBranch({ isActive: true });
      mockInspectionBranchesService.toggleActive.mockResolvedValue(toggled);

      const result = await controller.toggleActive('branch-1');

      expect(result.isActive).toBe(true);
    });
  });
});
