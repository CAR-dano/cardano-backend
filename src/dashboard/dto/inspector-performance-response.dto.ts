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
    description: 'Total number of inspections performed by the inspector',
    example: 150,
  })
  totalInspections: number;

  @ApiProperty({
    description: 'Number of inspections performed by the inspector this month',
    example: 50,
  })
  monthlyInspections: number;

  @ApiProperty({
    description: 'Number of inspections performed by the inspector this week',
    example: 15,
  })
  weeklyInspections: number;

  @ApiProperty({
    description: 'Number of inspections performed by the inspector today',
    example: 5,
  })
  dailyInspections: number;
}

export class InspectorPerformanceResponseDto {
  @ApiProperty({
    type: [InspectorPerformanceItemDto],
    description: 'Inspector performance statistics',
    example: [
      {
        inspector: 'John Doe',
        totalInspections: 150,
        monthlyInspections: 50,
        weeklyInspections: 15,
        dailyInspections: 5,
      },
      {
        inspector: 'Jane Smith',
        totalInspections: 120,
        monthlyInspections: 40,
        weeklyInspections: 10,
        dailyInspections: 3,
      },
    ],
  })
  data: InspectorPerformanceItemDto[];
}
