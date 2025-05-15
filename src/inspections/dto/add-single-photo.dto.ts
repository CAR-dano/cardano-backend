// src/inspections/dto/add-photos.dto.ts (File Baru)
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
  @IsJSON() // Validasi bahwa ini string JSON valid
  @IsNotEmpty() // Wajib ada
  metadata: string; // Terima sebagai string JSON

  // File 'photos' tidak didefinisikan di sini, ditangani oleh interceptor
}
