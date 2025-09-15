/*
 * --------------------------------------------------------------------------
 * File: bulk-approve-inspection.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Data Transfer Object for bulk approval of inspections.
 * Used for processing multiple inspections at once with improved error handling.
 * --------------------------------------------------------------------------
 */

import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsString,
  IsNotEmpty,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';

/**
 * DTO for bulk approval of multiple inspections
 */
export class BulkApproveInspectionDto {
  /**
   * Array of inspection IDs to approve
   */
  @ApiProperty({
    description: 'Array of inspection IDs to approve',
    example: [
      '123e4567-e89b-12d3-a456-426614174000',
      '123e4567-e89b-12d3-a456-426614174001',
      '123e4567-e89b-12d3-a456-426614174002',
    ],
    type: [String],
    minItems: 1,
    maxItems: 20, // Limit bulk operations to prevent server overload
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @ArrayMinSize(1, { message: 'At least one inspection ID must be provided' })
  @ArrayMaxSize(20, {
    message: 'Maximum 20 inspections can be approved at once',
  })
  inspectionIds: string[];
}

/**
 * Response DTO for bulk approval results
 */
export class BulkApproveInspectionResponseDto {
  @ApiProperty({
    description: 'Successfully approved inspections',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        message: { type: 'string' },
      },
    },
  })
  successful: Array<{ id: string; message: string }>;

  @ApiProperty({
    description: 'Failed approval attempts',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        error: { type: 'string' },
      },
    },
  })
  failed: Array<{ id: string; error: string }>;

  @ApiProperty({
    description: 'Summary of bulk approval operation',
    type: 'object',
    properties: {
      total: { type: 'number' },
      successful: { type: 'number' },
      failed: { type: 'number' },
      estimatedTime: { type: 'string' },
    },
  })
  summary: {
    total: number;
    successful: number;
    failed: number;
    estimatedTime: string;
  };
}
