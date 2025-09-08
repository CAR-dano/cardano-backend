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
   * Structure per object: { label?: string, needAttention?: boolean, category?: string, isMandatory?: boolean }
   * Contoh kategori (Indonesia): "Eksterior Tambahan", "Interior Tambahan", "General Wajib", "Mesin Tambahan", "Kaki-kaki Tambahan", "Alat-alat Tambahan", "Foto Dokumen".
   * @example '[{"label":"Baret 1","needAttention":true, "category": "Eksterior Tambahan", "isMandatory": false},{"needAttention":false, "category": "Mesin Tambahan"}]'
   */
  @ApiProperty({
    type: 'string',
    format: 'json',
    description:
      'REQUIRED: JSON string array of metadata ({label?: string, needAttention?: boolean, category?: string, isMandatory?: boolean}) matching file upload order. Label defaults to "Tambahan" if not provided. Kategori gunakan bahasa Indonesia.',
    example:
      '[{"label":"Baret 1","needAttention":true, "category": "Eksterior Tambahan", "isMandatory": false},{"category": "Interior Tambahan", "isMandatory": true}]',
  })
  @IsString()
  @IsNotEmpty()
  @IsJSON()
  metadata: string;

  // 'photos' field (files) handled by FilesInterceptor
}
