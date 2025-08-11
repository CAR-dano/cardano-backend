/*
 * --------------------------------------------------------------------------
 * File: inspection-branch-city-response.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Data Transfer Object (DTO) for the response when retrieving
 * inspection branch city information. Defines the structure of the data
 * returned to the client.
 * --------------------------------------------------------------------------
 */

import { ApiProperty } from '@nestjs/swagger';

/**
 * Data Transfer Object for the response when retrieving inspection branch city information.
 */
export class InspectionBranchCityResponseDto {
  /**
   * Unique identifier of the inspection branch city.
   * @example 'cuid'
   */
  @ApiProperty({
    example: 'cuid',
    description: 'Unique identifier of the inspection branch city',
  })
  id: string;

  /**
   * The name of the city for the inspection branch.
   * @example 'Jakarta'
   */
  @ApiProperty({ example: 'Jakarta', description: 'Name of the city' })
  city: string;

  /**
   * The status of the inspection branch city.
   * @example true
   */
  @ApiProperty({ example: true, description: 'Status of the city' })
  isActive: boolean;

  /**
   * The code or name of the inspection branch.
   * @example 'Main Branch'
   */
  @ApiProperty({
    example: 'Main Branch',
    description: 'Name of the inspection branch',
  })
  code: string;

  /**
   * The timestamp when the inspection branch city entry was created.
   * @example '2023-10-27T10:00:00.000Z'
   */
  @ApiProperty({
    example: '2023-10-27T10:00:00.000Z',
    description: 'Creation timestamp',
  })
  createdAt: Date;

  /**
   * The timestamp when the inspection branch city entry was last updated.
   * @example '2023-10-27T10:00:00.000Z'
   */
  @ApiProperty({
    example: '2023-10-27T10:00:00.000Z',
    description: 'Last update timestamp',
  })
  updatedAt: Date;
}
