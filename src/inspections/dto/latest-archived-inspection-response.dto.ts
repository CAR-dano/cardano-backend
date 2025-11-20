import { ApiProperty } from '@nestjs/swagger';
import { Inspection, Photo } from '@prisma/client';

interface VehicleData {
  merekKendaraan?: string;
  tipeKendaraan?: string;
  // Add other properties of vehicleData if needed
}

class PhotoDetail {
  @ApiProperty({
    description: 'Public URL of the photo',
    example: 'https://cdn.example.com/inspection-photos/2025/01/example.jpg',
  })
  path: string;

  @ApiProperty({
    description: 'Public URL of the photo',
    nullable: true,
    required: false,
  })
  publicUrl: string | null;

  @ApiProperty({ description: 'Label of the photo', example: 'Tampak Depan' })
  label: string;

  constructor(photo: Photo) {
    this.publicUrl = photo.publicUrl ?? null;
    this.path = this.publicUrl ?? photo.path; // Provide backward compatibility
    this.label = photo.label || ''; // Handle null label
  }
}

export class LatestArchivedInspectionResponseDto {
  @ApiProperty({
    type: PhotoDetail,
    description: 'The "Tampak Depan" photo of the vehicle',
  })
  photo: PhotoDetail;

  @ApiProperty({ description: 'Vehicle plate number', example: 'B 1234 CD' })
  vehiclePlateNumber: string;

  @ApiProperty({
    description: 'Vehicle brand',
    example: 'Toyota',
    nullable: true,
  })
  merekKendaraan: string | null;

  @ApiProperty({
    description: 'Vehicle type',
    example: 'Avanza',
    nullable: true,
  })
  tipeKendaraan: string | null;

  constructor(inspection: Inspection & { photos: Photo[] }) {
    const tampakDepanPhoto = inspection.photos.find(
      (p) => p.label === 'Tampak Depan',
    );

    if (!tampakDepanPhoto) {
      // This case should ideally be handled by filtering in the service layer
      // to ensure only inspections with 'Tampak Depan' photo are returned.
      // For now, throwing an error to indicate data inconsistency.
      throw new Error('Tampak Depan photo not found for this inspection.');
    }

    this.photo = new PhotoDetail(tampakDepanPhoto);
    this.vehiclePlateNumber = inspection.vehiclePlateNumber || ''; // Handle null vehiclePlateNumber
    const vehicleData = inspection.vehicleData as VehicleData; // Cast to the defined interface
    this.merekKendaraan = vehicleData?.merekKendaraan || null;
    this.tipeKendaraan = vehicleData?.tipeKendaraan || null;
  }
}
