/*
 * --------------------------------------------------------------------------
 * File: dto/credit-package-item-response.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: DTO wrapping a single credit package under `package` key.
 * --------------------------------------------------------------------------
 */

import { ApiProperty } from '@nestjs/swagger';
import { CreditPackageResponseDto } from './credit-package-response.dto';

/**
 * @class CreditPackageItemResponseDto
 * @description Wrapper used by endpoints returning a single package.
 */
export class CreditPackageItemResponseDto {
  @ApiProperty({ type: CreditPackageResponseDto })
  package!: CreditPackageResponseDto;

  constructor(item: CreditPackageResponseDto) {
    this.package = item;
  }
}
