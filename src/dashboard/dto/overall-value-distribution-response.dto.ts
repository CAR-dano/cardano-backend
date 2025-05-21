/*
 * --------------------------------------------------------------------------
 * File: overall-value-distribution-response.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Data Transfer Object for the overall value distribution response.
 * --------------------------------------------------------------------------
 */
import { ApiProperty } from '@nestjs/swagger';

export class OverallValueDistributionItemDto {
  @ApiProperty({ description: 'Overall value range', example: '0-50M' })
  range: string;

  @ApiProperty({ description: 'Number of orders in the range', example: 200 })
  count: number;
}

export class OverallValueDistributionResponseDto {
  @ApiProperty({
    type: [OverallValueDistributionItemDto],
    description: 'Distribution of orders by overall value range',
    example: [
      {
        range: '0-50M',
        count: 200,
      },
      {
        range: '50M-100M',
        count: 150,
      },
    ],
  })
  data: OverallValueDistributionItemDto[];
}
