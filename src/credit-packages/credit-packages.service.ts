import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
    return this.prisma.creditPackage.update({ where: { id }, data: dto });
  }

  async toggleActive(id: string) {
    if (!id) throw new BadRequestException('id is required');
    const current = await this.prisma.creditPackage.findUnique({ where: { id } });
    if (!current) throw new BadRequestException('credit package not found');
    return this.prisma.creditPackage.update({
      where: { id },
      data: { isActive: !current.isActive },
    });
  }

  async remove(id: string) {
    if (!id) throw new BadRequestException('id is required');
    return this.prisma.creditPackage.delete({ where: { id } });
  }
}
