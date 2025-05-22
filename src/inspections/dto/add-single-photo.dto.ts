/*
 * --------------------------------------------------------------------------
 * File: add-single-photo.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Data Transfer Object (DTO) for adding a single photo with metadata to an inspection.
 * Defines the expected structure of the request body for photo uploads.
 * --------------------------------------------------------------------------
 */
import { ApiProperty } from '@nestjs/swagger';
import { IsJSON, IsNotEmpty } from 'class-validator';

/**
 * Data Transfer Object (DTO) for adding a single photo with associated metadata to an inspection.
 */
export class AddSinglePhotoDto {
  /**
   * Metadata for the single uploaded photo, provided as a JSON string.
   * Expected format: `{ "label": "string", "needAttention"?: boolean }`.
   * The 'photo' file itself is handled by an interceptor and not part of this DTO definition.
   * @example '{"label":"Rear Left Fender","needAttention":true}'
   */
  @ApiProperty({
    type: 'string',
    format: 'json', // Hint is string
    description:
      'REQUIRED: JSON string representing the metadata object ({label: string, needAttention?: boolean}) for the uploaded photo.',
    example: '{"label":"Rear Left Fender","needAttention":true}',
  })
  @IsJSON() // Validates that this is a valid JSON string
  @IsNotEmpty() // Required field
  metadata: string; // Received as a JSON string

  // The 'photo' file is not defined here; it is handled by an interceptor.
}
