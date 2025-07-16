/*
 * --------------------------------------------------------------------------
 * File: inspection-branch-city-response.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: DTO for representing public-facing inspection branch city data.
 * --------------------------------------------------------------------------
 */

import { ApiProperty } from '@nestjs/swagger';
import { InspectionBranchCity } from '@prisma/client';

/**
 * DTO for public-facing inspection branch city data.
 */
export class InspectionBranchCityResponseDto {
  @ApiProperty({ description: 'Branch city unique identifier (UUID)' })
  id: string;

  @ApiProperty({ description: 'Name of the city', example: 'Yogyakarta' })
  city: string;

  @ApiProperty({ description: 'Unique code for the city', example: 'YOG' })
  code: string;

  constructor(branchCity: InspectionBranchCity) {
    this.id = branchCity.id;
    this.city = branchCity.city;
    this.code = branchCity.code;
  }
}
