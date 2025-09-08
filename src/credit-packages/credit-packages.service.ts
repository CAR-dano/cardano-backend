import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class CreditPackagesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.creditPackage.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string) {
    return this.prisma.creditPackage.findUnique({ where: { id } });
  }

  async create(dto: {
    credits: number;
    price: number;
    discountPct: number;
    benefits?: Record<string, any> | null;
    isActive?: boolean;
  }) {
    return this.prisma.creditPackage.create({
      data: {
        credits: dto.credits,
        price: dto.price,
        discountPct: dto.discountPct,
        benefits: dto.benefits !== undefined ? (dto.benefits as any) : undefined,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: Partial<{ credits: number; price: number; discountPct: number; benefits: any; isActive: boolean }>) {
    if (!id) throw new BadRequestException('id is required');
    if (!dto || Object.keys(dto).length === 0) {
      throw new BadRequestException('No fields provided for update');
    }
    try {
      return await this.prisma.creditPackage.update({ where: { id }, data: dto });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Credit package not found');
      }
      throw error;
    }
  }

  async toggleActive(id: string) {
    if (!id) throw new BadRequestException('id is required');
    const current = await this.prisma.creditPackage.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Credit package not found');
    try {
      return await this.prisma.creditPackage.update({
        where: { id },
        data: { isActive: !current.isActive },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Credit package not found');
      }
      throw error;
    }
  }

  async remove(id: string) {
    if (!id) throw new BadRequestException('id is required');
    try {
      return await this.prisma.creditPackage.delete({ where: { id } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Credit package not found');
      }
      throw error;
    }
  }
}
