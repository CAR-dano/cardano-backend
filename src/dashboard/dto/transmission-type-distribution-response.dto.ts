/*
 * --------------------------------------------------------------------------
 * File: transmission-type-distribution-response.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Data Transfer Object for the transmission type distribution response.
 * --------------------------------------------------------------------------
 */
import { ApiProperty } from '@nestjs/swagger';

export class TransmissionTypeDistributionItemDto {
  @ApiProperty({ description: 'Car transmission type', example: 'Automatic' })
  type: string;

  @ApiProperty({
    description: 'Number of orders for the transmission type',
    example: 400,
  })
  count: number;
}

export class TransmissionTypeDistributionResponseDto {
  @ApiProperty({
    type: [TransmissionTypeDistributionItemDto],
    description: 'Distribution of orders by car transmission type',
    example: [
      {
        type: 'Automatic',
        count: 400,
      },
      {
        type: 'Manual',
        count: 200,
      },
    ],
  })
  data: TransmissionTypeDistributionItemDto[];
}
