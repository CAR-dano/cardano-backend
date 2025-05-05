/**
 * @fileoverview DTO for adding a BATCH of FIXED type photos.
 * Expects a JSON string array in the 'metadata' field corresponding to the 'photos' files.
 * Each metadata object only needs the 'originalLabel'.
 */
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsJSON } from 'class-validator';

// Interface for single metadata entry
interface PhotoMetadataFixed {
  originalLabel: string; // Only need the predefined label
}

export class AddBatchFixedPhotosDto {
  /**
   * REQUIRED: A JSON string representing an array of metadata objects.
   * Each object MUST correspond to a file uploaded in the 'photos' field, maintaining the same order.
   * Structure per object: { originalLabel: string }
   * @example '[{"originalLabel":"Tampak Depan"},{"originalLabel":"OBD Scanner"}]'
   */
  @ApiProperty({
    type: 'string',
    format: 'json',
    description:
      'REQUIRED: JSON string array of metadata ({originalLabel: string}) matching file upload order.',
    example:
      '[{"originalLabel":"Tampak Depan"},{"originalLabel":"OBD Scanner"}]',
  })
  @IsString()
  @IsNotEmpty()
  @IsJSON()
  metadata: string; // Receive JSON string array
}
