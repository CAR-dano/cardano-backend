/**
 * @fileoverview DTO representing the structure of a Photo record returned by the API.
 */
import { ApiProperty } from '@nestjs/swagger';
import { Photo, PhotoType } from '@prisma/client';

export class PhotoResponseDto {
  @ApiProperty({ description: 'Photo unique identifier (UUID)' })
  id: string;

  // inspectionId is usually implied by the endpoint, maybe omit?
  // @ApiProperty({ description: 'ID of the inspection this photo belongs to' })
  // inspectionId: string;

  @ApiProperty({ enum: PhotoType, description: 'Type category of the photo' })
  type: PhotoType;

  @ApiProperty({ description: 'Relative path or filename in storage' })
  path: string;

  @ApiProperty({ description: 'Label associated with the photo' })
  label: string;

  @ApiProperty({
    description: 'Original predefined label (for FIXED type)',
    nullable: true,
    required: false,
  })
  originalLabel: string | null;

  @ApiProperty({ description: 'Flag indicating if the photo needs attention' })
  needAttention: boolean;

  @ApiProperty({ description: 'Timestamp when the photo record was created' })
  createdAt: Date;

  constructor(photo: Photo) {
    this.id = photo.id;
    // this.inspectionId = photo.inspectionId;
    this.type = photo.type;
    this.path = photo.path;
    this.label = photo.label;
    this.originalLabel = photo.originalLabel;
    this.needAttention = photo.needAttention || false;
    this.createdAt = photo.createdAt;
  }
}
