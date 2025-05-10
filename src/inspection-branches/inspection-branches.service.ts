import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInspectionBranchCityDto } from './dto/create-inspection-branch-city.dto';
import { UpdateInspectionBranchCityDto } from './dto/update-inspection-branch-city.dto';
import { InspectionBranchCity } from '@prisma/client';

@Injectable()
export class InspectionBranchesService {
  constructor(private prisma: PrismaService) {}

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

  async findAll(): Promise<InspectionBranchCity[]> {
    return await this.prisma.inspectionBranchCity.findMany();
  }

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

  async remove(id: string): Promise<InspectionBranchCity> {
    await this.findOne(id); // Check if exists before deleting
    return await this.prisma.inspectionBranchCity.delete({
      where: { id },
    });
  }
}
