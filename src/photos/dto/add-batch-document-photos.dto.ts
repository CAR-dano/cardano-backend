/**
 * @fileoverview DTO for adding a BATCH of DOCUMENT type photos.
 * Expects a JSON string array in the 'metadata' field corresponding to the 'photos' files.
 * Each metadata object only needs the custom 'label'.
 */
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsJSON } from 'class-validator';

// Interface for single metadata entry
interface PhotoMetadataDocument {
  label: string; // Only need the custom label
}

export class AddBatchDocumentPhotosDto {
  /**
   * REQUIRED: A JSON string representing an array of metadata objects.
   * Each object MUST correspond to a file uploaded in the 'photos' field, maintaining the same order.
   * Structure per object: { label: string }
   * @example '[{"label":"STNK Hal 1"},{"label":"BPKB Hal 2"}]'
   */
  @ApiProperty({
    type: 'string',
    format: 'json',
    description:
      'REQUIRED: JSON string array of metadata ({label: string}) matching file upload order.',
    example: '[{"label":"STNK Hal 1"},{"label":"BPKB Hal 2"}]',
  })
  @IsString()
  @IsNotEmpty()
  @IsJSON()
  metadata: string; // Receive JSON string array
}
