/*
 * --------------------------------------------------------------------------
 * File: identity-details.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Data Transfer Object (DTO) for capturing identity details within an inspection.
 * Defines the structure for inspector, customer, and branch city information.
 * --------------------------------------------------------------------------
 */
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Data Transfer Object (DTO) for identity details within an inspection.
 */
export class IdentityDetailsDto {
  /**
   * The UUID of the inspector.
   * @example "ac5ae369-a422-426f-b01e-fad5476edda5"
   */
  @ApiProperty({
    example: 'ac5ae369-a422-426f-b01e-fad5476edda5',
    description: 'The UUID of the inspector.',
  })
  @IsOptional()
  @IsUUID()
  namaInspektor: string; // This will hold the inspectorId UUID

  /**
   * The name of the customer.
   * @example "Maul"
   */
  @ApiProperty({
    example: 'Maul',
    description: 'The name of the customer.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  namaCustomer: string;

  /**
   * The UUID of the inspection branch city.
   * @example "ac5ae369-a422-426f-b01e-fad5476edda5"
   */
  @ApiProperty({
    example: 'ac5ae369-a422-426f-b01e-fad5476edda5',
    description: 'The UUID of the inspection branch city.',
  })
  @IsOptional()
  @IsUUID()
  cabangInspeksi: string; // This will hold the branchCityId UUID
}
