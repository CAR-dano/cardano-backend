/*
 * --------------------------------------------------------------------------
 * File: dto/credit-package-response.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: DTO representing a credit package entity returned to clients.
 * --------------------------------------------------------------------------
 */

import { ApiProperty } from '@nestjs/swagger';
import { CreditPackage } from '@prisma/client';

/**
 * @class CreditPackageResponseDto
 * @description Standard shape for returning credit package data.
 */
export class CreditPackageResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() credits: number;
  @ApiProperty() price: number;
  @ApiProperty() discountPct: number;
  @ApiProperty({ required: false, nullable: true }) benefits?: Record<string, any> | null;
  @ApiProperty() isActive: boolean;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  constructor(entity: CreditPackage) {
    this.id = entity.id;
    this.credits = entity.credits;
    this.price = entity.price;
    this.discountPct = entity.discountPct;
    // Cast JSON payload from Prisma to Record<string, any> | null
    this.benefits = (entity as any).benefits ?? null;
    this.isActive = entity.isActive;
    this.createdAt = entity.createdAt as any;
    this.updatedAt = entity.updatedAt as any;
  }
}
