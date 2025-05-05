/**
 * @fileoverview DTO for adding a document photo with a custom label.
 * Used with multipart/form-data for the 'photo' file.
 */
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class AddDocumentPhotoDto {
  /**
   * Custom label provided by the inspector for this document photo.
   * Sent as a text field.
   */
  @ApiProperty({
    description: 'Custom label for the document photo',
    example: 'STNK Front View',
  })
  @IsString()
  @IsNotEmpty()
  label: string;
}
