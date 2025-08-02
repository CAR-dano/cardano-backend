/*
 * --------------------------------------------------------------------------
 * File: update-inspection.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: DTO for partially updating an existing inspection record.
 * --------------------------------------------------------------------------
 */
import {
  IsString,
  IsDateString,
  IsObject,
  IsOptional,
  ValidateNested,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { UpdateIdentityDetailsDto } from './update-identity-details.dto';
import { UpdateVehicleDataDto } from './update-vehicle-data.dto';
import { UpdateBodyPaintThicknessDto } from './update-body-paint-thickness.dto';
import { UpdateDetailedAssessmentDto } from './update-detailed-assessment.dto';
import { UpdateInspectionSummaryDto } from './update-inspection-summary.dto';
import { UpdateEquipmentChecklistDto } from './update-equipment-checklist.dto';

/**
 * DTO for partially updating an existing inspection record. All fields are optional.
 */
export class UpdateInspectionDto {
  @ApiPropertyOptional({ example: 'AB 1 DQ' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  vehiclePlateNumber?: string;

  @ApiPropertyOptional({ example: '2025-07-05T14:30:00Z' })
  @IsOptional()
  @IsDateString()
  inspectionDate?: string;

  @ApiPropertyOptional({ example: '8' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  overallRating?: string;

  @ApiPropertyOptional({ type: UpdateIdentityDetailsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateIdentityDetailsDto)
  identityDetails?: UpdateIdentityDetailsDto;

  @ApiPropertyOptional({ type: UpdateVehicleDataDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateVehicleDataDto)
  vehicleData?: UpdateVehicleDataDto;

  @ApiPropertyOptional({ type: UpdateEquipmentChecklistDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateEquipmentChecklistDto)
  equipmentChecklist?: UpdateEquipmentChecklistDto;

  @ApiPropertyOptional({ type: UpdateInspectionSummaryDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateInspectionSummaryDto)
  inspectionSummary?: UpdateInspectionSummaryDto;

  @ApiPropertyOptional({ type: UpdateDetailedAssessmentDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateDetailedAssessmentDto)
  detailedAssessment?: UpdateDetailedAssessmentDto;

  @ApiPropertyOptional({ type: UpdateBodyPaintThicknessDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateBodyPaintThicknessDto)
  bodyPaintThickness?: UpdateBodyPaintThicknessDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  notesFontSizes?: object;

  @ApiPropertyOptional({ description: 'The UUID of the inspector.' })
  @IsOptional()
  @IsUUID()
  inspectorId?: string;

  @ApiPropertyOptional({
    description: 'The UUID of the inspection branch city.',
  })
  @IsOptional()
  @IsUUID()
  branchCityId?: string;
}
