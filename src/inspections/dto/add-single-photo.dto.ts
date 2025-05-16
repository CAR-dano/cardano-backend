/*
 * --------------------------------------------------------------------------
 * File: add-single-photo.dto.ts
 * Project: cardano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Data Transfer Object (DTO) for adding a single photo with metadata
 * to an inspection record. Defines the expected structure of the data sent in the
 * request body when uploading a single photo.
 * --------------------------------------------------------------------------
 */
import { ApiProperty } from '@nestjs/swagger';
import { IsJSON, IsNotEmpty } from 'class-validator';

export class AddSinglePhotoDto {
  /**
   * An array of metadata objects (as a JSON string) corresponding to the uploaded files.
   * The order of objects in this array MUST match the order of files uploaded in the 'photos' field.
   * Example: '[{"label":"Rear Left Fender","needAttention":true}, {"label":"Front Right Fender"}]'
   */
  @ApiProperty({
    type: 'string',
    format: 'json', // Hint is string
    description:
      'REQUIRED: JSON string representing an array of metadata objects ({label: string, needAttention?: boolean}) for each uploaded photo, in the same order as the files.',
    example:
      '[{"label":"Rear Left Fender","needAttention":true}, {"label":"Front Right Fender"}]',
  })
  @IsJSON() // Validates that this is a valid JSON string
  @IsNotEmpty() // Required field
  metadata: string; // Receive as JSON string

  // The 'photos' file is not defined here; it is handled by the interceptor.
}
