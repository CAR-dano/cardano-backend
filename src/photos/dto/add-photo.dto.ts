/*
 * --------------------------------------------------------------------------
 * File: add-photo.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Data Transfer Object for adding a general vehicle photo with a custom label and attention flag.
 * Used with multipart/form-data for the 'photo' file.
 * --------------------------------------------------------------------------
 */
import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBooleanString,
} from 'class-validator';

export class AddPhotoDto {
  /**
   * Custom label provided by the inspector for this photo.
   * Sent as a text field.
   */
  @ApiProperty({
    description: 'Custom label for the photo',
    example: 'Rear Right Door Scratch',
  })
  @IsString()
  @IsNotEmpty()
  label: string;

  /**
   * Flag indicating if this photo needs special attention.
   * Sent as a string ("true" or "false") in form-data, or omitted for false.
   * Optional field.
   */
  @ApiProperty({
    description:
      'Flag if photo needs attention (send "true" or "false" string, or omit for false)',
    required: false,
    example: 'true',
  })
  @IsOptional()
  @IsBooleanString()
  needAttention?: string;
}
