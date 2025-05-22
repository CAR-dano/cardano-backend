/*
 * --------------------------------------------------------------------------
 * File: main-stats-response.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Data Transfer Object for the main dashboard statistics response.
 * --------------------------------------------------------------------------
 */
import { ApiProperty } from '@nestjs/swagger';

export class MainStatsResponseDto {
  @ApiProperty({ description: 'Total number of orders/records', example: 1000 })
  totalOrders: number;

  @ApiProperty({
    description: 'Number of orders with status Need Review',
    example: 50,
  })
  needReview: number;

  @ApiProperty({
    description: 'Number of orders with status Approved',
    example: 800,
  })
  approved: number;

  @ApiProperty({
    description: 'Number of orders with status Minted',
    example: 100,
  })
  archived: number;

  @ApiProperty({
    description: 'Number of orders with status Failed to Mint',
    example: 10,
  })
  failArchive: number;

  @ApiProperty({
    description: 'Number of orders with status Deactivated',
    example: 40,
  })
  deactivated: number;
}
