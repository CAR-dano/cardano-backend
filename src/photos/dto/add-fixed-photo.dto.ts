/**
 * @fileoverview DTO for adding a photo with a fixed, predefined label.
 * Used with multipart/form-data for the 'photo' file.
 */
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class AddFixedPhotoDto {
  /**
   * The predefined label corresponding to this photo type (e.g., "Front View", "OBD Scanner").
   * This must be sent as a text field along with the 'photo' file field.
   */
  @ApiProperty({
    description:
      'Predefined label for the fixed photo type (e.g., "Front View")',
    example: 'Front View',
  })
  @IsString()
  @IsNotEmpty()
  originalLabel: string;
}
