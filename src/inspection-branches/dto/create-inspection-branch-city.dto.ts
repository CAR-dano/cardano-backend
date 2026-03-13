/*
 * --------------------------------------------------------------------------
 * File: create-inspection-branch-city.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Data Transfer Object (DTO) for creating a new inspection branch city.
 * --------------------------------------------------------------------------
 */

import { Transform } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsBoolean,
  IsOptional,
  Matches,
  Length,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { sanitizeString } from '../../common/sanitize.helper';

export class CreateInspectionBranchCityDto {
  /**
   * The name of the city for the inspection branch.
   * @example 'Jakarta'
   */
  @ApiProperty({ example: 'Jakarta', description: 'Name of the city' })
  @Transform(({ value }: { value: unknown }) => sanitizeString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  city: string;

  /**
   * Short branch code (1–3 uppercase letters/digits).
   * Must be unique. Stored as uppercase.
   * @example 'JKT'
   */
  @ApiProperty({
    example: 'JKT',
    description: 'Short branch code (1–3 uppercase letters/digits, unique)',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @IsNotEmpty()
  @Length(1, 3, { message: 'code must be between 1 and 3 characters' })
  @Matches(/^[A-Z0-9]+$/, {
    message: 'code must contain only uppercase letters or digits',
  })
  code: string;

  /**
   * The status of the inspection branch city.
   * @example true
   */
  @ApiProperty({
    example: true,
    description: 'Status of the city',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
