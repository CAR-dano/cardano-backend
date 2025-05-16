/*
 * --------------------------------------------------------------------------
 * File: inspection-branches.service.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Service responsible for managing inspection branch cities.
 * Provides methods for creating, retrieving, updating, and deleting
 * inspection branch city data using Prisma.
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
   * Creates a new inspection branch city.
   *
   * @param createInspectionBranchCityDto The data for creating the inspection branch city.
   * @returns A promise that resolves to the created InspectionBranchCity object.
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
      },
    });
  }

  /**
   * Retrieves all inspection branch cities.
   *
   * @returns A promise that resolves to an array of InspectionBranchCity objects.
   */
  async findAll(): Promise<InspectionBranchCity[]> {
    return await this.prisma.inspectionBranchCity.findMany();
  }

  /**
   * Retrieves a single inspection branch city by its ID.
   *
   * @param id The ID of the inspection branch city.
   * @returns A promise that resolves to the InspectionBranchCity object.
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
   * Updates an existing inspection branch city.
   *
   * @param id The ID of the inspection branch city to update.
   * @param updateInspectionBranchCityDto The data for updating the inspection branch city.
   * @returns A promise that resolves to the updated InspectionBranchCity object.
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
      },
    });
  }

  /**
   * Removes an inspection branch city by its ID.
   *
   * @param id The ID of the inspection branch city to remove.
   * @returns A promise that resolves to the removed InspectionBranchCity object.
   * @throws NotFoundException if the inspection branch city with the given ID is not found.
   */
  async remove(id: string): Promise<InspectionBranchCity> {
    await this.findOne(id); // Check if exists before deleting
    return await this.prisma.inspectionBranchCity.delete({
      where: { id },
    });
  }
}
