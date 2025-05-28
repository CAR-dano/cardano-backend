/*
 * --------------------------------------------------------------------------
 * File: inspection-target-stats.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Data Transfer Object for retrieving inspection target statistics.
 * --------------------------------------------------------------------------
 */
import { ApiProperty } from '@nestjs/swagger';

export class InspectionTargetStatsItemDto {
  @ApiProperty({
    description: 'Total inspections for the period',
    example: 85,
  })
  totalInspections: number;

  @ApiProperty({
    description: 'Target inspections for the period',
    example: 100,
  })
  targetInspections: number;

  @ApiProperty({
    description: 'Percentage of target met',
    example: '85.00%',
  })
  percentageMet: string;
}

export class InspectionTargetStatsResponseDto {
  @ApiProperty({
    description: 'Inspection target statistics for all time',
    type: InspectionTargetStatsItemDto,
    required: false,
  })
  allTime?: InspectionTargetStatsItemDto;

  @ApiProperty({
    description: 'Inspection target statistics for this month',
    type: InspectionTargetStatsItemDto,
    required: false,
  })
  thisMonth?: InspectionTargetStatsItemDto;

  @ApiProperty({
    description: 'Inspection target statistics for this week',
    type: InspectionTargetStatsItemDto,
    required: false,
  })
  thisWeek?: InspectionTargetStatsItemDto;

  @ApiProperty({
    description: 'Inspection target statistics for today',
    type: InspectionTargetStatsItemDto,
    required: false,
  })
  today?: InspectionTargetStatsItemDto;

  @ApiProperty({
    description: 'Inspection target statistics for this year',
    type: InspectionTargetStatsItemDto,
    required: false,
  })
  thisYear?: InspectionTargetStatsItemDto;
}
