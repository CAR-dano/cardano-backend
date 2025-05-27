/*
 * --------------------------------------------------------------------------
 * File: get-dashboard-stats.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Data Transfer Object for requesting dashboard statistics with optional filters.
 * --------------------------------------------------------------------------
 */
import { IsOptional, IsEnum, IsString, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum TimePeriod {
  YEAR = 'year',
  MONTH = 'month',
  WEEK = 'week',
  DAY = 'day',
  ALL_TIME = 'all_time',
}

export class GetDashboardStatsDto {
  @ApiProperty({
    description: 'Time period for the statistics',
    enum: TimePeriod,
    example: TimePeriod.MONTH,
    required: false,
  })
  @IsOptional()
  @IsEnum(TimePeriod)
  period?: TimePeriod;

  @ApiProperty({
    description: 'Start date for the statistics (YYYY-MM-DD)',
    example: '2023-01-01',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  startDate?: string; // Format YYYY-MM-DD

  @ApiProperty({
    description: 'End date for the statistics (YYYY-MM-DD)',
    example: '2023-01-31',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  endDate?: string; // Format YYYY-MM-DD

  @ApiProperty({
    description: 'For filtering by specific branch',
    example: 'Main Branch',
    required: false,
  })
  @IsOptional()
  @IsString()
  branch?: string; // For filtering by specific branch
}
