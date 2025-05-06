import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInspectionBranchCityDto } from './dto/create-inspection-branch-city.dto';
import { UpdateInspectionBranchCityDto } from './dto/update-inspection-branch-city.dto';
import { InspectionBranchCity } from '@prisma/client';

@Injectable()
export class InspectionBranchesService {
  constructor(private prisma: PrismaService) {}

  async create(
    CreateInspectionBranchCityDto: CreateInspectionBranchCityDto,
  ): Promise<InspectionBranchCity> {
    const kodeKota = CreateInspectionBranchCityDto.namaKota
      .substring(0, 3)
      .toUpperCase();
    return await this.prisma.inspectionBranchCity.create({
      data: {
        namaKota: CreateInspectionBranchCityDto.namaKota,
        kodeKota: kodeKota,
      },
    });
  }

  async findAll(): Promise<InspectionBranchCity[]> {
    return await this.prisma.inspectionBranchCity.findMany();
  }

  async findOne(id: string): Promise<InspectionBranchCity> {
    const InspectionBranchCity =
      await this.prisma.inspectionBranchCity.findUnique({
        where: { id },
      });
    if (!InspectionBranchCity) {
      throw new NotFoundException(
        `Inspection Branch City with ID "${id}" not found`,
      );
    }
    return InspectionBranchCity;
  }

  async update(
    id: string,
    UpdateInspectionBranchCityDto: UpdateInspectionBranchCityDto,
  ): Promise<InspectionBranchCity> {
    const existingInspectionBranchCity = await this.findOne(id); // Check if exists

    let kodeKota = existingInspectionBranchCity.kodeKota;
    if (UpdateInspectionBranchCityDto.namaKota) {
      kodeKota = UpdateInspectionBranchCityDto.namaKota
        .substring(0, 3)
        .toUpperCase();
    }

    return this.prisma.inspectionBranchCity.update({
      where: { id },
      data: {
        namaKota: UpdateInspectionBranchCityDto.namaKota,
        kodeKota: kodeKota,
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
