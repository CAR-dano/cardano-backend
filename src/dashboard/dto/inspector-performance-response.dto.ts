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

  @ApiProperty({
    description:
      'Total number of inspections performed by the inspector within the specified date range',
    example: 75, // Updated example
  })
  totalInspections: number;
}

export class InspectorPerformanceResponseDto {
  @ApiProperty({
    type: [InspectorPerformanceItemDto],
    description: 'Inspector performance statistics',
    example: [
      {
        inspector: 'John Doe',
        totalInspections: 75, // Updated example
      },
      {
        inspector: 'Jane Smith',
        totalInspections: 60, // Updated example
      },
    ],
  })
  data: InspectorPerformanceItemDto[];
}
