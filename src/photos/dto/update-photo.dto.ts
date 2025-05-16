/*
 * --------------------------------------------------------------------------
 * File: update-photo.dto.ts
 * Project: cardano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Data Transfer Object (DTO) for updating photo metadata.
 * Defines the optional fields that can be sent to update an existing photo record.
 * --------------------------------------------------------------------------
 */
/**
 * @fileoverview DTO for updating photo metadata. All fields are optional.
 * Used with the PUT /inspections/:id/photos/:photoId endpoint (multipart/form-data).
 */
import { ApiPropertyOptional } from '@nestjs/swagger'; // Use Optional version
import {
  IsString,
  IsOptional,
  IsBooleanString,
  IsNotEmpty,
} from 'class-validator';

export class UpdatePhotoDto {
  /**
   * The new custom label for the photo.
   * Applicable for DYNAMIC and DOCUMENT types. Ignored for FIXED type.
   * Optional field.
   */
  @ApiPropertyOptional({
    // Decorator for optional properties
    description: 'New custom label for the photo (ignored for FIXED type)',
    example: 'Baret Pintu Kanan (Close Up)',
  })
  @IsOptional() // Optional for validation pipe
  @IsString()
  @IsNotEmpty({ message: 'Label cannot be empty if provided' }) // Prevent empty string if sent
  label?: string;

  /**
   * The new attention flag for the photo.
   * Applicable ONLY for DYNAMIC type photos. Ignored for others.
   * Must be sent as a string "true" or "false".
   * Optional field.
   */
  @ApiPropertyOptional({
    description:
      'New attention flag (send "true" or "false" string, DYNAMIC type only)',
    example: 'false',
  })
  @IsOptional()
  @IsBooleanString() // Validates 'true' or 'false'
  needAttention?: string; // Receive as string

  // The 'photo' file itself is handled by the FileInterceptor, not defined here.
}
