/**
 * @fileoverview DTO for adding a BATCH of dynamic photos.
 * Expects a JSON string array in the 'metadata' field corresponding to the 'photos' files.
 */
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsJSON } from 'class-validator';

// Definisikan struktur objek metadata tunggal (sama seperti sebelumnya)
interface PhotoMetadataDynamic {
  label: string;
  needAttention?: boolean;
}

export class AddBatchDynamicPhotosDto {
  /**
   * REQUIRED: A JSON string representing an array of metadata objects.
   * Each object MUST correspond to a file uploaded in the 'photos' field,
   * maintaining the same order.
   * Structure per object: { label: string, needAttention?: boolean }
   * @example '[{"label":"Baret 1","needAttention":true},{"label":"Interior Jok"},{"label":"Mesin Atas","needAttention":false}]'
   */
  @ApiProperty({
    type: 'string',
    format: 'json',
    description:
      'REQUIRED: JSON string array of metadata ({label: string, needAttention?: boolean}) matching file upload order.',
    example:
      '[{"label":"Baret 1","needAttention":true},{"label":"Interior Jok"}]',
  })
  @IsString()
  @IsNotEmpty()
  @IsJSON() // Validasi bahwa ini string JSON valid
  metadata: string;

  // 'photos' field (files) handled by FilesInterceptor
}
