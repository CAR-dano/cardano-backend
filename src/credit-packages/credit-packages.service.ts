/*
 * --------------------------------------------------------------------------
 * File: credit-packages.service.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Service for admin management of credit packages, including
 * listing, fetching, creating, updating, toggling active state, and deletion.
 * --------------------------------------------------------------------------
 */

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

/**
 * @class CreditPackagesService
 * @description Encapsulates data access and mutations for credit packages.
 */
@Injectable()
export class CreditPackagesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lists all credit packages ordered by creation time (newest first).
   */
  async findAll() {
    return this.prisma.creditPackage.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Retrieves a single credit package by ID.
   *
   * @param id Package ID
   */
  async findOne(id: string) {
    return this.prisma.creditPackage.findUnique({ where: { id } });
  }

  /**
   * Creates a new credit package with the given fields.
   */
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
        benefits:
          dto.benefits !== undefined ? (dto.benefits as any) : undefined,
        isActive: dto.isActive ?? true,
      },
    });
  }

  /**
   * Partially updates a credit package by ID.
   *
   * @throws BadRequestException if id missing or dto empty
   */
  async update(
    id: string,
    dto: Partial<{
      credits: number;
      price: number;
      discountPct: number;
      benefits: any;
      isActive: boolean;
    }>,
  ) {
    if (!id) throw new BadRequestException('id is required');
    if (!dto || Object.keys(dto).length === 0) {
      throw new BadRequestException('No fields provided for update');
    }
    try {
      return await this.prisma.creditPackage.update({
        where: { id },
        data: dto,
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

  /**
   * Toggles the active flag of a credit package.
   *
   * @throws BadRequestException if id missing
   * @throws NotFoundException if package not found
   */
  async toggleActive(id: string) {
    if (!id) throw new BadRequestException('id is required');
    const current = await this.prisma.creditPackage.findUnique({
      where: { id },
    });
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

  /**
   * Deletes a credit package by ID.
   *
   * @throws BadRequestException if id missing
   * @throws NotFoundException if package not found
   */
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
