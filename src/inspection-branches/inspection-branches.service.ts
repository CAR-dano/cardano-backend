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

@Injectable()
export class InspectionBranchesService {
  constructor(private prisma: PrismaService) {}

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
    return await this.prisma.inspectionBranchCity.create({
      data: {
        city: createInspectionBranchCityDto.city,
        code: code,
        isActive: createInspectionBranchCityDto.isActive,
      },
    });
  }

  /**
   * Retrieves all inspection branch cities from the database.
   *
   * @returns A promise that resolves to an array of InspectionBranchCity.
   */
  async findAll(): Promise<InspectionBranchCity[]> {
    return await this.prisma.executeWithReconnect(
      'findAllInspectionBranches',
      () => this.prisma.inspectionBranchCity.findMany(),
    );
  }

  /**
   * Retrieves an inspection branch city by its ID from the database.
   *
   * @param id The ID of the inspection branch city.
   * @returns A promise that resolves to the InspectionBranchCity.
   * @throws NotFoundException if the inspection branch city with the given ID is not found.
   */
  async findOne(id: string): Promise<InspectionBranchCity> {
    const inspectionBranchCity =
      await this.prisma.inspectionBranchCity.findUnique({
        where: { id },
      });
    if (!inspectionBranchCity) {
      throw new NotFoundException(
        `Inspection Branch City with ID "${id}" not found`,
      );
    }
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

    return this.prisma.inspectionBranchCity.update({
      where: { id },
      data: {
        city: updateInspectionBranchCityDto.city,
        isActive: updateInspectionBranchCityDto.isActive,
      },
    });
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
    return await this.prisma.inspectionBranchCity.delete({
      where: { id },
    });
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
    return this.prisma.inspectionBranchCity.update({
      where: { id },
      data: { isActive: !branch.isActive },
    });
  }
}
