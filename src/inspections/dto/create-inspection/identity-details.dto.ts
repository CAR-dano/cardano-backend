/*
 * --------------------------------------------------------------------------
 * File: identity-details.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Data Transfer Object (DTO) for capturing identity details
 * within an inspection. Defines the structure for inspector, customer, and
 * branch city information.
 * --------------------------------------------------------------------------
 */
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { sanitizeString } from '../../../common/sanitize.helper';

/**
 * Data Transfer Object (DTO) for identity details within an inspection.
 */
export class IdentityDetailsDto {
  /**
   * The UUID of the inspector (required for a new inspection).
   * @example "ac5ae369-a422-426f-b01e-fad5476edda5"
   */
  @ApiProperty({
    example: 'ac5ae369-a422-426f-b01e-fad5476edda5',
    description: 'The UUID of the inspector.',
  })
  @IsNotEmpty({ message: 'namaInspektor (inspector UUID) is required' })
  @IsString()
  @IsUUID('4', { message: 'namaInspektor must be a valid UUID v4' })
  namaInspektor: string;

  /**
   * The name of the customer.
   * @example "Maul"
   */
  @ApiProperty({
    example: 'Maul',
    description: 'The name of the customer.',
  })
  @IsNotEmpty({ message: 'namaCustomer is required' })
  @Transform(({ value }: { value: unknown }) => sanitizeString(value))
  @IsString()
  @MaxLength(255)
  namaCustomer: string;

  /**
   * The UUID of the inspection branch city (required for a new inspection).
   * @example "ac5ae369-a422-426f-b01e-fad5476edda5"
   */
  @ApiProperty({
    example: 'ac5ae369-a422-426f-b01e-fad5476edda5',
    description: 'The UUID of the inspection branch city.',
  })
  @IsNotEmpty({ message: 'cabangInspeksi (branch city UUID) is required' })
  @IsString()
  @IsUUID('4', { message: 'cabangInspeksi must be a valid UUID v4' })
  cabangInspeksi: string;
}
