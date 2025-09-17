/*
 * --------------------------------------------------------------------------
 * File: customer-reports.service.ts
 * Project: car-dano-backend
 * --------------------------------------------------------------------------
 * Description: Service layer for customer self-service report access. Handles
 * purchased report listing, detail retrieval, and delegation to ReportsService
 * for streaming assets while enforcing ownership constraints.
 * --------------------------------------------------------------------------
 */

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ReportsService } from '../reports/reports.service';
import { CreditsService } from '../credits/credits.service';
import { PrismaService } from '../prisma/prisma.service';
import { AppLogger } from '../logging/app-logger.service';
import { AuditLoggerService } from '../logging/audit-logger.service';
import { Role, InspectionStatus } from '@prisma/client';
import { ReportDetailResponseDto } from '../reports/dto/report-detail-response.dto';
import { ReportDownloadItemDto } from '../reports/dto/report-downloads-response.dto';
import { Response } from 'express';

export interface PurchasedReportsQuery {
  page?: number;
  pageSize?: number;
  startDate?: string | Date;
  endDate?: string | Date;
}

export interface PurchasedReportsListResult {
  items: ReportDownloadItemDto[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

@Injectable()
export class CustomerReportsService {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly creditsService: CreditsService,
    private readonly prisma: PrismaService,
    private readonly logger: AppLogger,
    private readonly audit: AuditLoggerService,
  ) {
    this.logger.setContext(CustomerReportsService.name);
  }

  async listPurchasedReports(
    userId: string,
    query: PurchasedReportsQuery,
  ): Promise<PurchasedReportsListResult> {
    const { data, meta } = await this.reportsService.listDownloadsWithMeta(
      userId,
      query,
    );

    this.audit.log({
      rid: 'n/a',
      actorId: userId,
      action: 'REPORT_HISTORY_VIEW',
      resource: 'customer_reports',
      subjectId: undefined,
      result: 'SUCCESS',
      meta: { page: meta.page, pageSize: meta.pageSize },
    });

    return { items: data, meta };
  }

  private async ensureOwnership(userId: string, inspectionId: string): Promise<void> {
    const hasConsumption = await this.creditsService.hasConsumption(
      userId,
      inspectionId,
    );
    if (!hasConsumption) {
      throw new NotFoundException('Report not found for this user.');
    }

    const inspection = await this.prisma.inspection.findUnique({
      where: { id: inspectionId },
      select: { status: true },
    });

    if (!inspection) {
      throw new NotFoundException('Inspection not found.');
    }

    if (inspection.status !== InspectionStatus.ARCHIVED) {
      throw new ForbiddenException('Inspection is not available.');
    }
  }

  async getReportDetail(
    userId: string,
    inspectionId: string,
  ): Promise<ReportDetailResponseDto> {
    await this.ensureOwnership(userId, inspectionId);
    const detail = await this.reportsService.getDetail(
      inspectionId,
      userId,
      Role.CUSTOMER,
    );

    this.audit.log({
      rid: 'n/a',
      actorId: userId,
      action: 'REPORT_VIEW',
      resource: 'customer_reports',
      subjectId: inspectionId,
      result: 'SUCCESS',
    });

    return detail;
  }

  async streamNoDocs(
    userId: string,
    inspectionId: string,
    res: Response,
  ): Promise<void> {
    await this.ensureOwnership(userId, inspectionId);

    this.audit.log({
      rid: 'n/a',
      actorId: userId,
      action: 'REPORT_DOWNLOAD',
      resource: 'customer_reports',
      subjectId: inspectionId,
      result: 'SUCCESS',
    });

    await this.reportsService.streamNoDocsPdf(
      inspectionId,
      userId,
      Role.CUSTOMER,
      res,
    );
  }
}
