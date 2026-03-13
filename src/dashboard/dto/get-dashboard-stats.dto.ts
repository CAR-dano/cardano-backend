/*
 * --------------------------------------------------------------------------
 * File: get-dashboard-stats.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 */
import { Transform } from 'class-transformer';
import { IsString, IsOptional, IsDateString, Matches, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// IANA timezone format: Region/City or abbreviations like UTC, EST, etc.
// This regex covers the vast majority of valid IANA tz names.
const IANA_TZ_REGEX = /^[A-Za-z]+([/+\-][A-Za-z0-9_]+)*$/;

export class GetDashboardStatsDto {
  @ApiProperty({
    description:
      'Start date for custom range (YYYY-MM-DD). Required if range_type is custom.',
    example: '2024-01-01',
    required: false,
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'start_date must be a valid date string in YYYY-MM-DD format' },
  )
  start_date?: string;

  @ApiProperty({
    description:
      'End date for custom range (YYYY-MM-DD). Required if range_type is custom.',
    example: '2024-01-31',
    required: false,
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'end_date must be a valid date string in YYYY-MM-DD format' },
  )
  end_date?: string;

  @ApiProperty({
    description:
      'IANA timezone for date calculations (e.g., "Asia/Jakarta"). Defaults to "Asia/Jakarta".',
    example: 'Asia/Jakarta',
    required: false,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'timezone must be a string' })
  @MaxLength(50, { message: 'timezone must not exceed 50 characters' })
  @Matches(IANA_TZ_REGEX, {
    message:
      'timezone must be a valid IANA timezone identifier (e.g. Asia/Jakarta, UTC, America/New_York)',
  })
  timezone?: string = 'Asia/Jakarta';
}
