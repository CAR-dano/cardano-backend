/*
 * --------------------------------------------------------------------------
 * File: add-multiple-photos.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Data Transfer Object for adding a batch of dynamic photos.
 * Expects a JSON string array in the 'metadata' field corresponding to the 'photos' files.
 * --------------------------------------------------------------------------
 */
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsJSON } from 'class-validator';

export class AddMultiplePhotosDto {
  /**
   * REQUIRED: A JSON string representing an array of metadata objects.
   * Each object MUST correspond to a file uploaded in the 'photos' field,
   * maintaining the same order.
   * Structure per object: { label: string, needAttention?: boolean, category?: string, isMandatory?: boolean }
   * @example '[{"label":"Baret 1","needAttention":true, "category": "exterior", "isMandatory": false},{"label":"Interior Jok", "category": "interior", "isMandatory": true},{"label":"Mesin Atas","needAttention":false, "category": "engine"}]'
   */
  @ApiProperty({
    type: 'string',
    format: 'json',
    description:
      'REQUIRED: JSON string array of metadata ({label: string, needAttention?: boolean, category?: string, isMandatory?: boolean}) matching file upload order.',
    example:
      '[{"label":"Baret 1","needAttention":true, "category": "exterior", "isMandatory": false},{"label":"Interior Jok", "category": "interior", "isMandatory": true}]',
  })
  @IsString()
  @IsNotEmpty()
  @IsJSON()
  metadata: string;

  // 'photos' field (files) handled by FilesInterceptor
}
