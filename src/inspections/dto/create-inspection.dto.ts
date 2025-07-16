/*
 * --------------------------------------------------------------------------
 * File: create-inspection.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Data Transfer Object (DTO) used for creating a new inspection record.
 * This DTO defines the expected structure of the data sent in the request body
 * when using the `POST /inspections` endpoint (expecting `application/json`).
 * It includes basic data fields and properties intended to hold structured data
 * (parsed from JSON) related to different sections of the inspection form.
 * Minimal validation is applied at this stage. File uploads are handled separately.
 * --------------------------------------------------------------------------
 */
import {
  IsString,
  IsDateString,
  IsObject,
  IsOptional,
  ValidateNested,
} from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IdentityDetailsDto } from './create-inspection/identity-details.dto';
import { VehicleDataDto } from './create-inspection/vehicle-data.dto';
import { BodyPaintThicknessDto } from './create-inspection/body-paint-thickness.dto';
import { DetailedAssessmentDto } from './create-inspection/detailed-assessment.dto';
import { InspectionSummaryDto } from './create-inspection/inspection-summary.dto';
import { EquipmentChecklistDto } from './create-inspection/equipment-checklist.dto';

/**
 * Data Transfer Object (DTO) for creating a new inspection record.
 */
export class CreateInspectionDto {
  /**
   * The license plate number of the inspected vehicle.
   * @example "AB 1 DQ"
   */
  @ApiProperty({
    example: 'AB 1 DQ',
    description: 'The license plate number of the inspected vehicle.',
  })
  @IsString()
  vehiclePlateNumber: string;

  /**
   * The date and time when the inspection was performed.
   * Expected as an ISO 8601 format string in the request body.
   * @example "2025-07-05T14:30:00Z"
   */
  @ApiProperty({
    example: '2025-07-05T14:30:00Z',
    description:
      'The date and time when the inspection was performed. Expected as an ISO 8601 format string.',
  })
  @IsDateString()
  inspectionDate: string;

  /**
   * The overall rating assigned to the vehicle based on the inspection.
   * @example "8"
   */
  @ApiProperty({
    example: '8',
    description:
      'The overall rating assigned to the vehicle based on the inspection.',
  })
  @IsString()
  overallRating?: string;

  /**
   * Object containing details from the "Identitas" section of the inspection form.
   * Expected to be a valid JavaScript object after potential parsing from a JSON string by NestJS pipes.
   * Contains UUIDs for the inspector (`namaInspektor`) and the inspection branch city (`cabangInspeksi`).
   * @example { "namaInspektor": "ac5ae369-a422-426f-b01e-fad5476edda5", "namaCustomer": "Maul", "cabangInspeksi": "ac5ae369-a422-426f-b01e-fad5476edda5" }
   */
  @ApiProperty({
    example: {
      namaInspektor: 'ac5ae369-a422-426f-b01e-fad5476edda5',
      namaCustomer: 'Maul',
      cabangInspeksi: 'ac5ae369-a422-426f-b01e-fad5476edda5',
    },
    description:
      'Object containing details from the "Identitas" section of the inspection form, with UUIDs for inspector and branch city.',
  })
  @Type(() => IdentityDetailsDto)
  @ValidateNested()
  identityDetails: IdentityDetailsDto;

  /**
   * Object containing details from the "Data Kendaraan" section of the inspection form.
   */
  @ApiProperty({
    description:
      'Object containing details from the "Data Kendaraan" section of the inspection form.',
  })
  @Type(() => VehicleDataDto)
  @ValidateNested()
  vehicleData: VehicleDataDto;

  /**
   * Object containing details from the "Kelengkapan" section(s) of the inspection form.
   */
  @ApiProperty({
    description:
      'Object containing details from the "Kelengkapan" section(s) of the inspection form.',
  })
  @Type(() => EquipmentChecklistDto)
  @ValidateNested()
  equipmentChecklist: EquipmentChecklistDto;

  /**
   * Object containing details from the "Hasil Inspeksi" summary section of the form.
   */
  @ApiProperty({
    description:
      'Object containing details from the "Hasil Inspeksi" summary section of the form.',
  })
  @Type(() => InspectionSummaryDto)
  @ValidateNested()
  inspectionSummary: InspectionSummaryDto;

  /**
   * Object containing details from the "Penilaian" section(s) of the inspection form.
   */
  @ApiProperty({
    description:
      'Object containing details from the "Penilaian" section(s) of the inspection form.',
  })
  @Type(() => DetailedAssessmentDto)
  @ValidateNested()
  detailedAssessment: DetailedAssessmentDto;

  /**
   * Object containing details from the "Body Paint Thickness" test section of the form.
   */
  @ApiProperty({
    description:
      'Object containing details from the "Body Paint Thickness" test section of the form.',
  })
  @Type(() => BodyPaintThicknessDto)
  @ValidateNested()
  bodyPaintThickness: BodyPaintThicknessDto;

  /**
   * Map of note field paths to their desired font sizes in the report.
   */
  @ApiProperty({
    example: {
      'inspectionSummary.interiorNotes': 12,
      'inspectionSummary.eksteriorNotes': 12,
      'inspectionSummary.kakiKakiNotes': 12,
      'inspectionSummary.mesinNotes': 12,
      'inspectionSummary.deskripsiKeseluruhan': 12,
      'detailedAssessment.testDrive.catatan': 12,
      'detailedAssessment.banDanKakiKaki.catatan': 12,
      'detailedAssessment.hasilInspeksiEksterior.catatan': 12,
      'detailedAssessment.toolsTest.catatan': 12,
      'detailedAssessment.fitur.catatan': 12,
      'detailedAssessment.hasilInspeksiMesin.catatan': 12,
      'detailedAssessment.hasilInspeksiInterior.catatan': 12,
    },
    description:
      'Map of note field paths to their desired font sizes in the report.',
  })
  @IsOptional()
  @IsObject()
  notesFontSizes?: object;

  // Note: Files (like 'photos') are not included in this DTO as they are handled
  // by file upload interceptors (e.g., FilesInterceptor) in the controller method.
}
