/*
 * --------------------------------------------------------------------------
 * File: production-year-distribution-response.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Data Transfer Object for the production year distribution response.
 * --------------------------------------------------------------------------
 */
import { ApiProperty } from '@nestjs/swagger';

export class ProductionYearDistributionItemDto {
  @ApiProperty({ description: 'Car production year', example: 2020 })
  year: number;

  @ApiProperty({
    description: 'Number of orders for the production year',
    example: 180,
  })
  count: number;
}

export class ProductionYearDistributionResponseDto {
  @ApiProperty({
    type: [ProductionYearDistributionItemDto],
    description: 'Distribution of orders by car production year',
    example: [
      {
        year: 2020,
        count: 180,
      },
      {
        year: 2021,
        count: 200,
      },
    ],
  })
  data: ProductionYearDistributionItemDto[];
}
