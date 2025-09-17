/*
 * --------------------------------------------------------------------------
 * File: purchased-reports-list.dto.ts
 * Project: car-dano-backend
 * --------------------------------------------------------------------------
 * Description: Response DTOs for customer purchased reports listing and detail.
 * --------------------------------------------------------------------------
 */

import { ApiProperty } from '@nestjs/swagger';
import { ReportDownloadItemDto } from '../../reports/dto/report-downloads-response.dto';
import { ReportDetailResponseDto } from '../../reports/dto/report-detail-response.dto';

export class PurchasedReportsListMetaDto {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;

  @ApiProperty()
  totalPages!: number;
}

export class PurchasedReportsListResponseDto {
  @ApiProperty({ type: () => ReportDownloadItemDto, isArray: true })
  items!: ReportDownloadItemDto[];

  @ApiProperty({ type: () => PurchasedReportsListMetaDto })
  meta!: PurchasedReportsListMetaDto;

  constructor(init: { items: ReportDownloadItemDto[]; meta: PurchasedReportsListMetaDto }) {
    this.items = init.items;
    this.meta = init.meta;
  }
}

export class PurchasedReportDetailResponseDto extends ReportDetailResponseDto {}
