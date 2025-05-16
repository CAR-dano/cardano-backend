/*
 * --------------------------------------------------------------------------
 * File: update-inspection.dto.ts
 * Project: cardano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Data Transfer Object (DTO) for partially updating an existing inspection record.
 * Inherits properties from CreateInspectionDto using PartialType, making all fields optional.
 * Does not include file handling properties.
 * --------------------------------------------------------------------------
 */
import { PartialType } from '@nestjs/mapped-types';
import { CreateInspectionDto } from './create-inspection.dto';
// Import additional validators if needed for specific update logic
// import { IsEnum, IsOptional } from 'class-validator';
// import { InspectionStatus } from '@prisma/client';
// import { ApiPropertyOptional } from '@nestjs/swagger'; // Alternative for optional properties

/**
 * DTO for partially updating an existing inspection record.
 * Inherits all properties from CreateInspectionDto, making them optional.
 */
export class UpdateInspectionDto extends PartialType(CreateInspectionDto) {
  // You can add specific fields here that are ONLY updatable but not creatable,
  // or override properties from CreateInspectionDto if needed (e.g., different validation).
  // Example: If you wanted to allow updating status directly (though we have specific methods)
  /*
  @ApiPropertyOptional({ enum: InspectionStatus, description: 'Update inspection status (use dedicated endpoints for approval/rejection normally). Possible values: NEED_REVIEW, APPROVED, ARCHIVING, ARCHIVED, FAIL_ARCHIVE, DEACTIVATED' })
  @IsOptional()
  @IsEnum(InspectionStatus)
  status?: InspectionStatus;
  */
  // For now, inheriting all optional fields from CreateInspectionDto is sufficient
  // for updating vehiclePlateNumber, inspectionDate, overallRating, and the JSON fields.
}
