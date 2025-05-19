/*
 * --------------------------------------------------------------------------
 * File: update-photo.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Data Transfer Object for updating photo metadata. All fields are optional.
 * Used with the PUT /inspections/:id/photos/:photoId endpoint (multipart/form-data).
 * --------------------------------------------------------------------------
 */
import { ApiPropertyOptional } from '@nestjs/swagger';
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
    description: 'New custom label for the photo (ignored for FIXED type)',
    example: 'Baret Pintu Kanan (Close Up)',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Label cannot be empty if provided' })
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
  @IsBooleanString()
  needAttention?: string;

  // The 'photo' file itself is handled by the FileInterceptor, not defined here.
}
