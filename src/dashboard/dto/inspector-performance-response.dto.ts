/*
 * --------------------------------------------------------------------------
 * File: inspector-performance-response.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Data Transfer Object for the inspector performance response.
 * --------------------------------------------------------------------------
 */
import { ApiProperty } from '@nestjs/swagger';

export class InspectorPerformanceItemDto {
  @ApiProperty({ description: 'Inspector name', example: 'John Doe' })
  inspector: string;

  @ApiProperty({ description: 'Number of inspections performed', example: 50 })
  inspections: number;
}

export class InspectorPerformanceResponseDto {
  @ApiProperty({
    type: [InspectorPerformanceItemDto],
    description: 'Inspector performance',
    example: [
      {
        inspector: 'John Doe',
        inspections: 50,
      },
      {
        inspector: 'Jane Smith',
        inspections: 45,
      },
    ],
  })
  data: InspectorPerformanceItemDto[];
}
