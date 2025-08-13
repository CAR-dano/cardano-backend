/*
 * --------------------------------------------------------------------------
 * File: update-identity-details.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: DTO for partially updating identity details.
 * --------------------------------------------------------------------------
 */
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for partially updating identity details within an inspection.
 */
export class UpdateIdentityDetailsDto {
  /**
   * The UUID of the inspector.
   * @example "ac5ae369-a422-426f-b01e-fad5476edda5"
   */
  @ApiPropertyOptional({
    example: 'ac5ae369-a422-426f-b01e-fad5476edda5',
    description: 'The UUID of the inspector.',
  })
  @IsOptional()
  @IsUUID()
  namaInspektor?: string;

  /**
   * The name of the customer.
   * @example "Maul"
   */
  @ApiPropertyOptional({
    example: 'Maul',
    description: 'The name of the customer.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  namaCustomer?: string;

  /**
   * The UUID of the inspection branch city.
   * @example "ac5ae369-a422-426f-b01e-fad5476edda5"
   */
  @ApiPropertyOptional({
    example: 'ac5ae369-a422-426f-b01e-fad5476edda5',
    description: 'The UUID of the inspection branch city.',
  })
  @IsOptional()
  @IsUUID()
  cabangInspeksi?: string;
}
