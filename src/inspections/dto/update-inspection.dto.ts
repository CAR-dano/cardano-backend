/**
 * @fileoverview DTO for partially updating an existing inspection record.
 * All fields are optional. Inherits properties from CreateInspectionDto using PartialType.
 * Does not include file handling properties.
 */
import { PartialType } from '@nestjs/mapped-types'; // Utility for optional fields
import { CreateInspectionDto } from './create-inspection.dto';
// Import additional validators if needed for specific update logic
// import { IsEnum, IsOptional } from 'class-validator';
// import { InspectionStatus } from '@prisma/client';
// import { ApiPropertyOptional } from '@nestjs/swagger'; // Alternative for optional properties

// CreateUpdateInspectionDto inherits all properties from CreateInspectionDto,
// but makes them all optional automatically thanks to PartialType.
export class UpdateInspectionDto extends PartialType(CreateInspectionDto) {
  // You can add specific fields here that are ONLY updatable but not creatable,
  // or override properties from CreateInspectionDto if needed (e.g., different validation).
  // Example: If you wanted to allow updating status directly (though we have specific methods)
  /*
  @ApiPropertyOptional({ enum: InspectionStatus, description: 'Update inspection status (use dedicated endpoints for approval/rejection normally)' })
  @IsOptional()
  @IsEnum(InspectionStatus)
  status?: InspectionStatus;
  */
  // For now, inheriting all optional fields from CreateInspectionDto is sufficient
  // for updating vehiclePlateNumber, inspectionDate, overallRating, and the JSON fields.
}
