/**
 * @fileoverview Data Transfer Object (DTO) used for creating a new inspection record.
 * This DTO defines the expected structure of the data sent in the request body
 * when using the `POST /inspections` endpoint (expecting `application/json`).
 * It includes basic data fields and properties intended to hold structured data
 * (parsed from JSON) related to different sections of the inspection form.
 * Minimal validation is applied at this stage. File uploads are handled separately.
 */
import { IsString, IsDateString, IsObject } from 'class-validator'; // Keep minimal validators

export class CreateInspectionDto {
  /**
   * The license plate number of the inspected vehicle.
   * @example "AB 1231 RI"
   */
  @IsString() // Decorator validating the field is a string if provided
  vehiclePlateNumber?: string;

  /**
   * The date and time when the inspection was performed.
   * Expected as an ISO 8601 format string in the request body.
   * @example "2025-05-01T14:30:00Z"
   */
  @IsDateString() // Validates that the string conforms to the ISO 8601 date format if provided
  inspectionDate: string;

  /**
   * The overall rating assigned to the vehicle based on the inspection.
   * @example "B+"
   */
  @IsString()
  overallRating?: string;

  /**
   * Object containing details from the "Identitas" section of the inspection form.
   * Expected to be a valid JavaScript object after potential parsing from a JSON string by NestJS pipes.
   * @example { "namaInspektor": "Maulana", "namaCustomer": "Budi S." }
   */
  @IsObject() // Validates that the value is an object if provided
  identityDetails: Record<string, any>; // Property type is an object/record

  /**
   * Object containing details from the "Data Kendaraan" section of the inspection form.
   */
  @IsObject()
  vehicleData?: Record<string, any>;

  /**
   * Object containing details from the "Kelengkapan" section(s) of the inspection form.
   */
  @IsObject()
  equipmentChecklist?: Record<string, any>;

  /**
   * Object containing details from the "Hasil Inspeksi" summary section of the form.
   */
  @IsObject()
  inspectionSummary?: Record<string, any>;

  /**
   * Object containing details from the "Penilaian" section(s) of the inspection form.
   */
  @IsObject()
  detailedAssessment?: Record<string, any>;

  /**
   * Object containing details from the "Body Paint Thickness" test section of the form.
   */
  @IsObject()
  bodyPaintThickness?: Record<string, any>;

  // Note: Files (like 'photos') are not included in this DTO as they are handled
  // by file upload interceptors (e.g., FilesInterceptor) in the controller method.
}
