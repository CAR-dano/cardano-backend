/*
 * --------------------------------------------------------------------------
 * File: create-inspection.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Data Transfer Object (DTO) used for creating a new inspection record.
 * --------------------------------------------------------------------------
 */
import {
  IsString,
  IsDateString,
  IsObject,
  ValidateNested,
  MaxLength,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
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
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  vehiclePlateNumber: string;

  /**
   * The date and time when the inspection was performed (ISO 8601).
   * @example "2025-07-05T14:30:00Z"
   */
  @ApiProperty({
    example: '2025-07-05T14:30:00Z',
    description:
      'The date and time when the inspection was performed. Expected as an ISO 8601 format string.',
  })
  @IsDateString()
  @IsNotEmpty()
  inspectionDate: string;

  /**
   * The overall rating assigned to the vehicle (0–100).
   * Sent as a number or a numeric string; coerced to number by enableImplicitConversion.
   * @example 75
   */
  @ApiProperty({
    example: 75,
    description:
      'The overall rating assigned to the vehicle based on the inspection (0–100).',
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'overallRating must be a number' })
  @IsNotEmpty()
  @Min(0, { message: 'overallRating must be at least 0' })
  @Max(100, { message: 'overallRating must be at most 100' })
  overallRating: number;

  /**
   * Object containing details from the "Identitas" section.
   */
  @ApiProperty({
    example: {
      namaInspektor: 'ac5ae369-a422-426f-b01e-fad5476edda5',
      namaCustomer: 'Maul',
      cabangInspeksi: 'ac5ae369-a422-426f-b01e-fad5476edda5',
    },
    description:
      'Object containing details from the "Identitas" section of the inspection form.',
  })
  @Type(() => IdentityDetailsDto)
  @ValidateNested()
  identityDetails: IdentityDetailsDto;

  /**
   * Object containing details from the "Data Kendaraan" section.
   */
  @ApiProperty({
    description:
      'Object containing details from the "Data Kendaraan" section of the inspection form.',
  })
  @Type(() => VehicleDataDto)
  @ValidateNested()
  vehicleData: VehicleDataDto;

  /**
   * Object containing details from the "Kelengkapan" section.
   */
  @ApiProperty({
    description:
      'Object containing details from the "Kelengkapan" section of the inspection form.',
  })
  @Type(() => EquipmentChecklistDto)
  @ValidateNested()
  equipmentChecklist: EquipmentChecklistDto;

  /**
   * Object containing details from the "Hasil Inspeksi" summary section.
   */
  @ApiProperty({
    description:
      'Object containing details from the "Hasil Inspeksi" summary section of the form.',
  })
  @Type(() => InspectionSummaryDto)
  @ValidateNested()
  inspectionSummary: InspectionSummaryDto;

  /**
   * Object containing details from the "Penilaian" section.
   */
  @ApiProperty({
    description:
      'Object containing details from the "Penilaian" section of the inspection form.',
  })
  @Type(() => DetailedAssessmentDto)
  @ValidateNested()
  detailedAssessment: DetailedAssessmentDto;

  /**
   * Object containing details from the "Body Paint Thickness" section.
   */
  @ApiProperty({
    description:
      'Object containing details from the "Body Paint Thickness" test section of the form.',
  })
  @Type(() => BodyPaintThicknessDto)
  @ValidateNested()
  bodyPaintThickness: BodyPaintThicknessDto;

  /**
   * Map of note field paths to their desired font sizes in the PDF report.
   */
  @ApiProperty({
    example: {
      'inspectionSummary.interiorNotes': 12,
      'inspectionSummary.deskripsiKeseluruhan': 12,
    },
    description:
      'Map of note field paths to their desired font sizes in the report.',
  })
  @IsOptional()
  @IsObject()
  notesFontSizes?: object;
}
