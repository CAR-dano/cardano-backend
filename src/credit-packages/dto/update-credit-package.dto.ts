/*
 * --------------------------------------------------------------------------
 * File: dto/update-credit-package.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: DTO for partially updating an existing credit package.
 * --------------------------------------------------------------------------
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsObject, IsOptional, Max, Min } from 'class-validator';

/**
 * @class UpdateCreditPackageDto
 * @description Fields that may be updated on a credit package.
 */
export class UpdateCreditPackageDto {
  @ApiPropertyOptional({ description: 'Number of credits', example: 120 })
  @IsOptional()
  @IsInt()
  @Min(1)
  credits?: number;

  @ApiPropertyOptional({ description: 'Net price (rupiah)', example: 140000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ description: 'Discount percentage (0..100)', example: 5 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  discountPct?: number;

  @ApiPropertyOptional({ description: 'Arbitrary benefits JSON', example: { note: 'updated' } })
  @IsOptional()
  @IsObject()
  benefits?: Record<string, any> | null;

  @ApiPropertyOptional({ description: 'Whether the package is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
