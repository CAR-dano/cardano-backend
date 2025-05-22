/*
 * --------------------------------------------------------------------------
 * File: create-inspection-branch-city.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Data Transfer Object (DTO) for creating a new inspection branch city.
 * Defines the structure and validation rules for the data required to create
 * an inspection branch city.
 * --------------------------------------------------------------------------
 */

import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateInspectionBranchCityDto {
  @ApiProperty({ example: 'Jakarta', description: 'Name of the city' })
  @IsString()
  @IsNotEmpty()
  city: string;
}
