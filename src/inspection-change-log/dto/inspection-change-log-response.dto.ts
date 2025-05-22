/*
 * --------------------------------------------------------------------------
 * File: inspection-change-log-response.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Data Transfer Object (DTO) for the inspection change log response.
 * Defines the structure of the response when retrieving inspection change logs.
 * --------------------------------------------------------------------------
 */

import { ApiProperty } from '@nestjs/swagger';

/**
 * Represents the response structure for an inspection change log entry.
 */
export class InspectionChangeLogResponseDto {
  /**
   * The unique identifier of the change log entry.
   */
  @ApiProperty({ description: 'The unique identifier of the change log entry' })
  id: string;

  /**
   * The ID of the inspection the change log belongs to.
   */
  @ApiProperty({
    description: 'The ID of the inspection the change log belongs to',
  })
  inspectionId: string;

  /**
   * The name of the field that was changed.
   */
  @ApiProperty({ description: 'The name of the field that was changed' })
  fieldName: string;

  /**
   * The old value of the field.
   */
  @ApiProperty({ description: 'The old value of the field' })
  oldValue: string;

  /**
   * The new value of the field.
   */
  @ApiProperty({ description: 'The new value of the field' })
  newValue: string;

  /**
   * The timestamp when the change occurred.
   */
  @ApiProperty({ description: 'The timestamp when the change occurred' })
  changedAt: Date;
}
