/*
 * --------------------------------------------------------------------------
 * File: order-trend-response.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Data Transfer Object for the order trend response.
 * --------------------------------------------------------------------------
 */
import { ApiProperty } from '@nestjs/swagger';

export class OrderTrendItemDto {
  @ApiProperty({
    description: 'Time period (e.g., 2023-01)',
    example: '2023-01',
  })
  date: string;

  @ApiProperty({ description: 'Number of orders in the period', example: 100 })
  count: number;
}

export class OrderTrendResponseDto {
  @ApiProperty({
    type: [OrderTrendItemDto],
    description: 'Order trend data per time period',
    example: [
      {
        date: '2023-01',
        count: 100,
      },
      {
        date: '2023-02',
        count: 120,
      },
    ],
  })
  data: OrderTrendItemDto[];
}
