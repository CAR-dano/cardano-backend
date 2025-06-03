/*
 * --------------------------------------------------------------------------
 * File: get-dashboard-stats.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Data Transfer Object for requesting dashboard statistics with optional filters.
 * --------------------------------------------------------------------------
 */
import {
  IsOptional,
  IsEnum,
  IsString,
  IsDateString,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

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

  @ApiProperty({
    description: 'Year for the statistics (e.g., 2023)',
    example: 2023,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  year?: number;

  @ApiProperty({
    description: 'Month for the statistics (1-12, e.g., 1 for January)',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  month?: number;
}
