/**
 * @fileoverview Data Transfer Object (DTO) for creating a new inspection record.
 * Designed for use with multipart/form-data requests where detailed form data
 * from different pages is sent as stringified JSON alongside potential file uploads.
 * Basic validation decorators (@IsOptional, @IsString, @IsDateString, @IsJSON) are included,
 * but more specific content validation within the JSON strings is handled by the service or later stages.
 * Photo files associated with the inspection are expected to be handled separately by
 * NestJS interceptors (e.g., FileFieldsInterceptor) in the controller, not defined as properties here.
 */
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsDateString, IsJSON } from 'class-validator'; // Import necessary validators

export class CreateInspectionDto {
  /**
   * The license plate number of the inspected vehicle.
   * Optional during creation as validation is currently minimal.
   * @example "BK 9876 ZZ"
   */
  @ApiProperty({
    description: 'Vehicle license plate number',
    required: false, // Marked as optional for Swagger/Scalar documentation
    example: 'BK 9876 ZZ',
    type: String, // Explicitly define type for documentation
  })
  @IsOptional() // Allows the property to be missing or undefined
  @IsString() // Validates that if provided, it's a string
  vehiclePlateNumber?: string;

  /**
   * The date and time when the inspection was performed.
   * Expected in ISO 8601 format string. Will be converted to Date object in the service.
   * Optional during creation.
   * @example "2025-06-15T09:00:00Z"
   */
  @ApiProperty({
    description: 'Date of inspection (ISO 8601 format)',
    required: false,
    example: '2025-06-15T09:00:00Z',
    type: String,
    format: 'date-time', // Hint for date-time format in documentation
  })
  @IsOptional()
  @IsDateString() // Validates that if provided, it's a valid ISO 8601 date string
  inspectionDate?: string;

  /**
   * The overall rating assigned to the vehicle based on the inspection.
   * Optional during creation.
   * @example "Fair"
   */
  @ApiProperty({
    description: 'Overall inspection rating',
    required: false,
    example: 'Fair',
    type: String,
  })
  @IsOptional()
  @IsString()
  overallRating?: string;

  // --- JSON Fields (Received as Strings, Parsed in Service) ---
  // These fields are expected to contain valid JSON strings when sent via multipart/form-data.
  // The service layer will be responsible for parsing these strings into actual JSON objects.

  /**
   * Stringified JSON data containing details from Page 1 (Identitas) of the inspection form.
   * Optional. Must be a valid JSON string if provided.
   * @example '{"namaInspektor": "Maulana", "namaCustomer": "Budi S."}'
   */
  @ApiProperty({
    type: 'string',
    format: 'json', // Hint for documentation tools that this string holds JSON
    description: 'Stringified JSON data from Page 1 (Identitas)',
    required: false,
    example:
      '{"namaInspektor": "Maulana", "namaCustomer": "Budi S.", "cabangInspeksi": "Jogja Utara"}',
  })
  @IsOptional()
  @IsJSON() // Validates that the provided value *is* a string containing valid JSON syntax
  identityDetails?: string; // Property type is string

  /**
   * Stringified JSON data containing details from Page 2 (Data Kendaraan) of the inspection form.
   * Optional. Must be a valid JSON string if provided.
   */
  @ApiProperty({
    type: 'string',
    format: 'json',
    description: 'Stringified JSON data from Page 2 (Data Kendaraan)',
    required: false,
    example:
      '{"merekKendaraan": "Honda", "tipeKendaraan": "Jazz RS", "tahun": 2022}',
  })
  @IsOptional()
  @IsJSON()
  vehicleData?: string;

  /**
   * Stringified JSON data containing details from Page 3 & 6 (Kelengkapan) of the inspection form.
   * Optional. Must be a valid JSON string if provided.
   */
  @ApiProperty({
    type: 'string',
    format: 'json',
    description: 'Stringified JSON data from Page 3 & 6 (Kelengkapan)',
    required: false,
    example: '{"bukuService": true, "kunciSerep": false}',
  })
  @IsOptional()
  @IsJSON()
  equipmentChecklist?: string;

  /**
   * Stringified JSON data containing details from Page 4 (Hasil Inspeksi) of the inspection form.
   * Optional. Must be a valid JSON string if provided.
   */
  @ApiProperty({
    type: 'string',
    format: 'json',
    description: 'Stringified JSON data from Page 4 (Hasil Inspeksi)',
    required: false,
    example: '{"interiorScore": 9, "estimasiPerbaikan": []}',
  })
  @IsOptional()
  @IsJSON()
  inspectionSummary?: string;

  /**
   * Stringified JSON data containing details from Page 5 (Penilaian) of the inspection form.
   * Optional. Must be a valid JSON string if provided.
   */
  @ApiProperty({
    type: 'string',
    format: 'json',
    description: 'Stringified JSON data from Page 5 (Penilaian)',
    required: false,
    example: '{"testDrive": {"bunyiGetaran": 10}}',
  })
  @IsOptional()
  @IsJSON()
  detailedAssessment?: string;

  // Note: File upload fields (like 'photos') are handled by interceptors in the controller
  // and are therefore not defined as properties within this DTO.
  // The @ApiBody decorator in the controller should describe the expected file fields.
}
