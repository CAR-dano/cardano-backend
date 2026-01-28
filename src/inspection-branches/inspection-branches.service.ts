/*
 * --------------------------------------------------------------------------
 * File: inspection-branches.service.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: NestJS service for managing inspection branch cities.
 * Interacts with the database via Prisma to perform CRUD operations
 * on InspectionBranchCity entities.
 * --------------------------------------------------------------------------
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInspectionBranchCityDto } from './dto/create-inspection-branch-city.dto';
import { UpdateInspectionBranchCityDto } from './dto/update-inspection-branch-city.dto';
import { InspectionBranchCity } from '@prisma/client';

import { RedisService } from '../redis/redis.service';

@Injectable()
export class InspectionBranchesService {
  private readonly BRANCH_CACHE_TTL = 86400; // 24 hours
  private readonly CACHE_KEY_ALL = 'branches:all';

  constructor(
    private prisma: PrismaService,
    private readonly redisService: RedisService,
  ) { }

  private async invalidateCache(id?: string) {
    await this.redisService.delete(this.CACHE_KEY_ALL);
    if (id) {
      await this.redisService.delete(`branch:${id}`);
    }
  }

  /**
   * Creates a new inspection branch city in the database.
   *
   * @param createInspectionBranchCityDto The data for creating the inspection branch city.
   * @returns A promise that resolves to the created InspectionBranchCity.
   */
  async create(
    createInspectionBranchCityDto: CreateInspectionBranchCityDto,
  ): Promise<InspectionBranchCity> {
    const code = createInspectionBranchCityDto.city
      .substring(0, 3)
      .toUpperCase();
    const newBranch = await this.prisma.inspectionBranchCity.create({
      data: {
        city: createInspectionBranchCityDto.city,
        code: code,
        isActive: createInspectionBranchCityDto.isActive,
      },
    });
    await this.invalidateCache();
    return newBranch;
  }

  /**
   * Retrieves all inspection branch cities from the database.
   *
   * @returns A promise that resolves to an array of InspectionBranchCity.
   */
  async findAll(): Promise<InspectionBranchCity[]> {
    try {
      const cached = await this.redisService.get(this.CACHE_KEY_ALL);
      if (cached) return JSON.parse(cached);
    } catch (e) { }

    const branches = await this.prisma.inspectionBranchCity.findMany();

    await this.redisService.set(this.CACHE_KEY_ALL, JSON.stringify(branches), this.BRANCH_CACHE_TTL);

    return branches;
  }

  /**
   * Retrieves an inspection branch city by its ID from the database.
   *
   * @param id The ID of the inspection branch city.
   * @returns A promise that resolves to the InspectionBranchCity.
   * @throws NotFoundException if the inspection branch city with the given ID is not found.
   */
  async findOne(id: string): Promise<InspectionBranchCity> {
    const cacheKey = `branch:${id}`;

    try {
      const cached = await this.redisService.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (e) { }

    const inspectionBranchCity =
      await this.prisma.inspectionBranchCity.findUnique({
        where: { id },
      });
    if (!inspectionBranchCity) {
      throw new NotFoundException(
        `Inspection Branch City with ID "${id}" not found`,
      );
    }

    await this.redisService.set(cacheKey, JSON.stringify(inspectionBranchCity), this.BRANCH_CACHE_TTL);

    return inspectionBranchCity;
  }

  /**
   * Updates an existing inspection branch city in the database.
   *
   * @param id The ID of the inspection branch city to update.
   * @param updateInspectionBranchCityDto The data for updating the inspection branch city.
   * @returns A promise that resolves to the updated InspectionBranchCity.
   * @throws NotFoundException if the inspection branch city with the given ID is not found.
   */
  async update(
    id: string,
    updateInspectionBranchCityDto: UpdateInspectionBranchCityDto,
  ): Promise<InspectionBranchCity> {
    await this.findOne(id); // Check if exists

    const updated = await this.prisma.inspectionBranchCity.update({
      where: { id },
      data: {
        city: updateInspectionBranchCityDto.city,
        isActive: updateInspectionBranchCityDto.isActive,
      },
    });
    await this.invalidateCache(id);
    return updated;
  }

  /**
   * Deletes an inspection branch city from the database.
   *
   * @param id The ID of the inspection branch city to delete.
   * @returns A promise that resolves to the deleted InspectionBranchCity.
   * @throws NotFoundException if the inspection branch city with the given ID is not found.
   */
  async remove(id: string): Promise<InspectionBranchCity> {
    await this.findOne(id); // Check if exists before deleting
    const deleted = await this.prisma.inspectionBranchCity.delete({
      where: { id },
    });
    await this.invalidateCache(id);
    return deleted;
  }

  /**
   * Toggles the active status of an inspection branch city.
   *
   * @param id The ID of the inspection branch city to toggle.
   * @returns A promise that resolves to the updated InspectionBranchCity.
   * @throws NotFoundException if the inspection branch city with the given ID is not found.
   */
  async toggleActive(id: string): Promise<InspectionBranchCity> {
    const branch = await this.findOne(id);
    const updated = await this.prisma.inspectionBranchCity.update({
      where: { id },
      data: { isActive: !branch.isActive },
    });
    await this.invalidateCache(id);
    return updated;
  }
}
