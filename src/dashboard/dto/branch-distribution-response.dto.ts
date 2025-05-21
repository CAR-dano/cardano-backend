/*
 * --------------------------------------------------------------------------
 * File: branch-distribution-response.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Data Transfer Object for the branch distribution response.
 * --------------------------------------------------------------------------
 */
import { ApiProperty } from '@nestjs/swagger';

export class BranchDistributionItemDto {
  @ApiProperty({ description: 'Branch name', example: 'Main Branch' })
  branch: string;

  @ApiProperty({ description: 'Number of orders in the branch', example: 250 })
  count: number;

  @ApiProperty({ description: 'Percentage of total orders', example: '50%' })
  percentage: string;

  @ApiProperty({ description: 'Percentage change (e.g., +5%)', example: '+5%' })
  change: string;
}

export class BranchDistributionResponseDto {
  @ApiProperty({
    type: [BranchDistributionItemDto],
    description: 'Distribution of orders by branch',
    example: [
      {
        branch: 'Main Branch',
        count: 250,
        percentage: '50%',
        change: '+5%',
      },
      {
        branch: 'Branch B',
        count: 150,
        percentage: '30%',
        change: '-2%',
      },
    ],
  })
  data: BranchDistributionItemDto[];
}
