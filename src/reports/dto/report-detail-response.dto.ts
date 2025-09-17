/*
 * --------------------------------------------------------------------------
 * File: dto/report-detail-response.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: DTOs representing report detail payloads, including the
 * inspection summary, key photos, download eligibility, and optional
 * customer credit balance.
 * --------------------------------------------------------------------------
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InspectionStatus } from '@prisma/client';
import { PhotoResponseDto } from '../../photos/dto/photo-response.dto';

/**
 * @class ReportDetailInspectionDto
 * @description Subset of inspection fields exposed in report detail.
 */
export class ReportDetailInspectionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  pretty_id!: string;

  @ApiPropertyOptional({ nullable: true })
  vehiclePlateNumber?: string | null;

  @ApiPropertyOptional({
    type: 'object',
    description: 'Vehicle data JSON',
    additionalProperties: true,
  })
  vehicleData?: any | null;

  @ApiProperty({ enum: Object.values(InspectionStatus) })
  status!: InspectionStatus;

  @ApiPropertyOptional({ nullable: true, description: 'Legacy/public path to no-docs PDF' })
  urlPdfNoDocs?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Cloud URL to no-docs PDF (Backblaze)' })
  urlPdfNoDocsCloud?: string | null;

  @ApiPropertyOptional({
    description:
      'Subset of photos for key exterior views (Front, Right Side, Left Side, Rear).',
    type: PhotoResponseDto,
    isArray: true,
  })
  photos?: PhotoResponseDto[];
}

/**
 * @class ReportDetailResponseDto
 * @description Response payload for report detail endpoint.
 */
export class ReportDetailResponseDto {
  @ApiProperty({ type: ReportDetailInspectionDto })
  inspection!: ReportDetailInspectionDto;

  @ApiProperty({ description: 'Whether current user can download now' })
  canDownload!: boolean;

  @ApiPropertyOptional({ description: 'Customer credit balance (only for CUSTOMER)', nullable: true })
  userCreditBalance?: number;
}
