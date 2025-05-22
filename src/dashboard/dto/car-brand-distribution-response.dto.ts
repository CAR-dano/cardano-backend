/*
 * --------------------------------------------------------------------------
 * File: car-brand-distribution-response.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Data Transfer Object for the car brand distribution response.
 * --------------------------------------------------------------------------
 */
import { ApiProperty } from '@nestjs/swagger';

export class CarBrandDistributionItemDto {
  @ApiProperty({ description: 'Car brand', example: 'Toyota' })
  brand: string;

  @ApiProperty({ description: 'Number of orders for the brand', example: 300 })
  count: number;
}

export class CarBrandDistributionResponseDto {
  @ApiProperty({
    type: [CarBrandDistributionItemDto],
    description: 'Distribution of orders by car brand',
    example: [
      {
        brand: 'Toyota',
        count: 300,
      },
      {
        brand: 'Honda',
        count: 200,
      },
    ],
  })
  data: CarBrandDistributionItemDto[];
}
