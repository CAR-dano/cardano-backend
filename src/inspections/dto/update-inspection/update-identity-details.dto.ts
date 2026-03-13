/*
 * --------------------------------------------------------------------------
 * File: update-identity-details.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: DTO for partially updating identity details.
 * --------------------------------------------------------------------------
 */
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { sanitizeString } from '../../../common/sanitize.helper';

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
  @IsUUID('4', { message: 'namaInspektor must be a valid UUID v4' })
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
  @Transform(({ value }: { value: unknown }) => sanitizeString(value))
  @IsString()
  @IsNotEmpty({ message: 'namaCustomer must not be empty' })
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
  @IsUUID('4', { message: 'cabangInspeksi must be a valid UUID v4' })
  cabangInspeksi?: string;
}
