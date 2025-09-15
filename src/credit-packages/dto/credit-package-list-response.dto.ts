/*
 * --------------------------------------------------------------------------
 * File: dto/credit-package-list-response.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: DTO wrapping a list of credit packages for responses.
 * --------------------------------------------------------------------------
 */

import { ApiProperty } from '@nestjs/swagger';
import { CreditPackageResponseDto } from './credit-package-response.dto';

/**
 * @class CreditPackageListResponseDto
 * @description Container for returning arrays of credit packages.
 */
export class CreditPackageListResponseDto {
  @ApiProperty({ type: CreditPackageResponseDto, isArray: true })
  packages!: CreditPackageResponseDto[];

  constructor(items: CreditPackageResponseDto[]) {
    this.packages = items;
  }
}
