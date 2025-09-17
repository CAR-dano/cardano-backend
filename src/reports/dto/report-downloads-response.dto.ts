/*
 * --------------------------------------------------------------------------
 * File: dto/report-downloads-response.dto.ts
 * Project: car-dano-backend
 * --------------------------------------------------------------------------
 * Description: DTOs for listing user's consumed reports (downloads history)
 * based on CreditConsumption joined with Inspection summary fields.
 * --------------------------------------------------------------------------
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InspectionStatus } from '@prisma/client';

export class DownloadedInspectionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  pretty_id!: string;

  @ApiPropertyOptional({ nullable: true })
  vehiclePlateNumber?: string | null;

  @ApiProperty({ enum: Object.values(InspectionStatus) })
  status!: InspectionStatus;

  @ApiPropertyOptional({ nullable: true })
  urlPdfNoDocs?: string | null;

  @ApiPropertyOptional({ nullable: true })
  urlPdfNoDocsCloud?: string | null;

  @ApiProperty()
  createdAt!: Date;
}

export class ReportDownloadItemDto {
  @ApiProperty()
  id!: string; // credit consumption id

  @ApiProperty()
  cost!: number;

  @ApiProperty()
  usedAt!: Date;

  @ApiProperty({ type: () => DownloadedInspectionDto })
  inspection!: DownloadedInspectionDto;
}

export class ReportDownloadsResponseDto {
  @ApiProperty({ type: () => ReportDownloadItemDto, isArray: true })
  downloads!: ReportDownloadItemDto[];

  constructor(items: ReportDownloadItemDto[]) {
    this.downloads = items;
  }
}
