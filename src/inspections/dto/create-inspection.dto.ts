/*
 * --------------------------------------------------------------------------
 * File: create-inspection.dto.ts
 * Project: cardano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Data Transfer Object (DTO) used for creating a new inspection record.
 * Defines the expected structure of the data sent in the request body for the
 * POST /inspections endpoint. Includes basic data fields and properties for
 * structured data from the inspection form. File uploads are handled separately.
 * --------------------------------------------------------------------------
 */
import { IsString, IsDateString, IsObject, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateInspectionDto {
  /**
   * The ID of the inspector performing the inspection.
   * @example "a1b2c3d4-e5f6-7890-1234-567890abcdef"
   */
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    description: 'The ID of the inspector performing the inspection.',
  })
  @IsUUID()
  inspectorId: string;

  /**
   * The license plate number of the inspected vehicle.
   * @example "AB 1231 RI"
   */
  @ApiProperty({
    example: 'AB 1231 RI',
    description: 'The license plate number of the inspected vehicle.',
  })
  @IsString()
  vehiclePlateNumber?: string;

  /**
   * The date and time when the inspection was performed.
   * Expected as an ISO 8601 format string in the request body.
   * @example "2025-05-01T14:30:00Z"
   */
  @ApiProperty({
    example: '2025-05-01T14:30:00Z',
    description:
      'The date and time when the inspection was performed. Expected as an ISO 8601 format string.',
  })
  @IsDateString()
  inspectionDate: string;

  /**
   * The overall rating assigned to the vehicle based on the inspection.
   * @example "B+"
   */
  @ApiProperty({
    example: 'B+',
    description:
      'The overall rating assigned to the vehicle based on the inspection.',
  })
  @IsString()
  overallRating?: string;

  /**
   * Object containing details from the "Identitas" section of the inspection form.
   * Expected to be a valid JavaScript object after potential parsing from a JSON string by NestJS pipes.
   * @example { "namaInspektor": "John Wick", "namaCustomer": "Kevin" }
   */
  @ApiProperty({
    example: { namaInspektor: 'John Wick', namaCustomer: 'Kevin' },
    description:
      'Object containing details from the "Identitas" section of the inspection form.',
  })
  @IsObject()
  identityDetails: Record<string, any>;

  /**
   * Object containing details from the "Data Kendaraan" section of the inspection form.
   */
  @ApiProperty({
    description:
      'Object containing details from the "Data Kendaraan" section of the inspection form.',
  })
  @IsObject()
  vehicleData?: Record<string, any>;

  /**
   * Object containing details from the "Kelengkapan" section(s) of the inspection form.
   */
  @ApiProperty({
    description:
      'Object containing details from the "Kelengkapan" section(s) of the inspection form.',
  })
  @IsObject()
  equipmentChecklist?: Record<string, any>;

  /**
   * Object containing details from the "Hasil Inspeksi" summary section of the form.
   */
  @ApiProperty({
    description:
      'Object containing details from the "Hasil Inspeksi" summary section of the form.',
  })
  @IsObject()
  inspectionSummary?: Record<string, any>;

  /**
   * Object containing details from the "Penilaian" section(s) of the inspection form.
   */
  @ApiProperty({
    description:
      'Object containing details from the "Penilaian" section(s) of the inspection form.',
  })
  @IsObject()
  detailedAssessment?: Record<string, any>;

  /**
   * Object containing details from the "Body Paint Thickness" test section of the form.
   */
  @ApiProperty({
    description:
      'Object containing details from the "Body Paint Thickness" test section of the form.',
  })
  @IsObject()
  bodyPaintThickness?: Record<string, any>;

  // Note: Files (like 'photos') are not included in this DTO as they are handled
  // by file upload interceptors (e.g., FilesInterceptor) in the controller method.
}
