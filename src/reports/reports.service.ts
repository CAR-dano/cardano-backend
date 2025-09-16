/*
 * --------------------------------------------------------------------------
 * File: reports.service.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Service providing report-related operations such as
 * resolving report details and streaming no-docs PDF files, including
 * credit charging logic for CUSTOMER role.
 * --------------------------------------------------------------------------
 */

import { Injectable, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import { AppLogger } from '../logging/app-logger.service';
import { AuditLoggerService } from '../logging/audit-logger.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreditsService } from '../credits/credits.service';
import { BackblazeService } from '../common/services/backblaze.service';
import { Role, InspectionStatus } from '@prisma/client';
import { ReportDetailResponseDto } from './dto/report-detail-response.dto';
import { PhotoResponseDto } from '../photos/dto/photo-response.dto';
import * as path from 'path';
import * as fs from 'fs';
import { Response } from 'express';
import { Stream } from 'stream';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { ReportDownloadItemDto } from './dto/report-downloads-response.dto';

/**
 * @class ReportsService
 * @description Business logic for report retrieval and PDF streaming.
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credits: CreditsService,
    private readonly backblaze: BackblazeService,
    private readonly logger: AppLogger,
    private readonly audit: AuditLoggerService,
    private readonly config: ConfigService,
  ) {
    this.logger.setContext?.(ReportsService.name as any);
  }

  /**
   * Retrieves report details and whether the user can download the no-docs PDF.
   * For CUSTOMER role, `canDownload` is true only if they have already consumed a credit
   * for the given inspection report.
   *
   * @param id Inspection ID (UUID)
   * @param userId Current authenticated user ID
   * @param userRole Current authenticated user role
   * @returns Report detail payload including `canDownload` and optional credit balance
   * @throws NotFoundException When inspection is missing or not archived
   */
  async getDetail(id: string, userId: string, userRole: Role): Promise<ReportDetailResponseDto> {
    const desiredLabels = [
      'Tampak Depan',
      'Tampak Samping Kanan',
      'Tampak Samping Kiri',
      'Tampak Belakang',
    ];

    const inspection = await this.prisma.inspection.findUnique({
      where: { id },
      select: {
        id: true,
        pretty_id: true,
        status: true,
        vehiclePlateNumber: true,
        vehicleData: true,
        urlPdfNoDocs: true,
        urlPdfNoDocsCloud: true,
        inspectionSummary: true,
        photos: {
          where: { label: { in: desiredLabels } },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            path: true,
            label: true,
            originalLabel: true,
            needAttention: true,
            createdAt: true,
          },
        },
      },
    });

    if (!inspection) throw new NotFoundException('Inspection not found');
    if ((inspection as any).status !== InspectionStatus.ARCHIVED) {
      throw new NotFoundException('Inspection not found');
    }

    let canDownload = userRole !== Role.CUSTOMER;
    if (userRole === Role.CUSTOMER) {
      const consumed = await this.credits.hasConsumption(userId, id);
      canDownload = consumed;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { credits: true },
    });

    if (inspection && (inspection as any).photos) {
      const normalized = (inspection as any).photos
        .map((p: any) =>
          new PhotoResponseDto({
            id: p.id,
            path: p.path,
            label: p.label ?? 'Tambahan',
            originalLabel: p.originalLabel ?? null,
            needAttention: p.needAttention ?? false,
            createdAt: p.createdAt,
          } as any),
        )
        .sort((a: any, b: any) => {
          const ai = desiredLabels.indexOf(a.label ?? '');
          const bi = desiredLabels.indexOf(b.label ?? '');
          return ai - bi;
        });

      (inspection as any).photos = normalized as any;
    }

    if (!canDownload) {
      (inspection as any).urlPdfNoDocs = undefined;
      (inspection as any).urlPdfNoDocsCloud = undefined;
    }

    return {
      inspection: (inspection as unknown) as any,
      canDownload,
      userCreditBalance: userRole === Role.CUSTOMER ? user?.credits ?? 0 : undefined,
    };
  }

  /**
   * Streams the no-docs PDF to the client. If the user is a CUSTOMER and has not
   * yet downloaded this report, charges 1 credit before streaming. Subsequent downloads
   * are free (idempotent). Tries Backblaze first, then falls back to local storage.
   *
   * @param id Inspection ID (UUID)
   * @param userId Current authenticated user ID
   * @param userRole Current authenticated user role
   * @param res Express response for piping the PDF stream
   * @throws NotFoundException When inspection or PDF file is not found
   */
  async streamNoDocsPdf(
    id: string,
    userId: string,
    userRole: Role,
    res: Response,
  ): Promise<void> {
    const inspection = await this.prisma.inspection.findUnique({
      where: { id },
      select: { status: true, urlPdfNoDocs: true, urlPdfNoDocsCloud: true },
    });
    if (!inspection) throw new NotFoundException('Inspection not found');
    if ((inspection as any).status !== InspectionStatus.ARCHIVED) {
      throw new NotFoundException('Inspection not found');
    }

    const srcUrl = inspection.urlPdfNoDocsCloud || inspection.urlPdfNoDocs;
    if (!srcUrl) throw new NotFoundException('No no-docs PDF available');

    if (userRole === Role.CUSTOMER) {
      const has = await this.credits.hasConsumption(userId, id);
      if (!has) {
        try {
          await this.credits.chargeOnce(userId, id, 1);
        } catch (e: any) {
          if (e?.message === 'INSUFFICIENT_CREDITS' || e?.response?.message === 'INSUFFICIENT_CREDITS') {
            throw new HttpException(
              { reason: 'INSUFFICIENT_CREDITS', next: '/billing/packages' },
              HttpStatus.PAYMENT_REQUIRED,
            );
          }
          throw e;
        }
      }
    }

    const filename = path.basename(srcUrl);
    const key = filename.startsWith('pdfarchived/') ? filename : `pdfarchived/${filename}`;

    try {
      const stream: Stream | undefined = await this.backblaze.getFile(key);
      if (stream) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Cache-Control', 'private, max-age=0');
        this.audit.log({
          rid: (res as any)?.req?.id || 'n/a',
          actorId: userId,
          actorRole: userRole,
          action: 'REPORT_DOWNLOAD',
          resource: 'report_pdf_no_docs',
          subjectId: id,
          result: 'SUCCESS',
          ip: (res as any)?.req?.ip,
          meta: { source: 'cloud' },
        });
        stream.pipe(res);
        return;
      }
    } catch (err: any) {
      this.logger.warn({ key, err }, 'Backblaze getFile failed');
    }

    const localPath = path.resolve(process.cwd(), 'pdfarchived', path.basename(filename));
    if (fs.existsSync(localPath)) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Cache-Control', 'private, max-age=0');
      this.audit.log({
        rid: (res as any)?.req?.id || 'n/a',
        actorId: userId,
        actorRole: userRole,
        action: 'REPORT_DOWNLOAD',
        resource: 'report_pdf_no_docs',
        subjectId: id,
        result: 'SUCCESS',
        ip: (res as any)?.req?.ip,
        meta: { source: 'local' },
      });
      fs.createReadStream(localPath).pipe(res);
      return;
    }

    throw new NotFoundException('PDF file not found');
  }

  /**
   * Returns a presigned URL (cloud) or a short-lived signed local proxy URL to download PDF.
   * Performs the same credit charging/idempotency checks as streaming endpoint.
   */
  async getPresignedDownloadUrl(
    id: string,
    userId: string,
    userRole: Role,
  ): Promise<{ url: string; ttlSec: number; source: 'cloud' | 'local' }>
  {
    const inspection = await this.prisma.inspection.findUnique({
      where: { id },
      select: { status: true, urlPdfNoDocs: true, urlPdfNoDocsCloud: true },
    });
    if (!inspection) throw new NotFoundException('Inspection not found');
    if ((inspection as any).status !== InspectionStatus.ARCHIVED) {
      throw new NotFoundException('Inspection not found');
    }

    const srcUrl = inspection.urlPdfNoDocsCloud || inspection.urlPdfNoDocs;
    if (!srcUrl) throw new NotFoundException('No no-docs PDF available');

    if (userRole === Role.CUSTOMER) {
      const has = await this.credits.hasConsumption(userId, id);
      if (!has) {
        try {
          await this.credits.chargeOnce(userId, id, 1);
        } catch (e: any) {
          if (e?.message === 'INSUFFICIENT_CREDITS' || e?.response?.message === 'INSUFFICIENT_CREDITS') {
            throw new HttpException(
              { reason: 'INSUFFICIENT_CREDITS', next: '/billing/packages' },
              HttpStatus.PAYMENT_REQUIRED,
            );
          }
          throw e;
        }
      }
    }

    const ttlSec = Number(this.config.get<string>('REPORT_DL_TTL_SEC') || '60');
    const filename = path.basename(srcUrl);
    const key = filename.startsWith('pdfarchived/') ? filename : `pdfarchived/${filename}`;

    if (inspection.urlPdfNoDocsCloud) {
      try {
        // Generate S3/Backblaze presigned URL
        const url = await this.backblaze.getPresignedUrl(key, ttlSec);
        this.audit.log({
          rid: 'n/a',
          actorId: userId,
          actorRole: userRole,
          action: 'REPORT_DL_URL_ISSUED',
          resource: 'report_pdf_no_docs',
          subjectId: id,
          result: 'SUCCESS',
          meta: { source: 'cloud', ttlSec },
        });
        return { url, ttlSec, source: 'cloud' };
      } catch (err: any) {
        // Fallback to local signed proxy if presigner unavailable
        this.logger.warn(`Presigned S3 URL failed; falling back to local signed URL: ${String(err?.message ?? err)}`);
      }
    }

    // Local fallback: sign our private proxy URL
    const secret = this.config.get<string>('REPORT_DL_SECRET') || '';
    const base = this.config.get<string>('URL') || '';
    const exp = Date.now() + ttlSec * 1000;
    const sig = crypto.createHmac('sha256', secret).update(`${filename}.${exp}`).digest('hex');
    const url = `${base.replace(/\/$/, '')}/v1/private/pdfarchived/${encodeURIComponent(filename)}?exp=${exp}&sig=${sig}`;
    this.audit.log({
      rid: 'n/a',
      actorId: userId,
      actorRole: userRole,
      action: 'REPORT_DL_URL_ISSUED',
      resource: 'report_pdf_no_docs',
      subjectId: id,
      result: 'SUCCESS',
      meta: { source: 'local', ttlSec },
    });
    return { url, ttlSec, source: 'local' };
  }

  /**
   * Lists user's downloaded reports (credit consumptions) with inspection summary.
   */
  async listDownloads(userId: string, limit = 10): Promise<ReportDownloadItemDto[]> {
    const take = Math.max(1, Math.min(100, Number(limit) || 10));
    const rows = await this.prisma.creditConsumption.findMany({
      where: { userId },
      orderBy: { usedAt: 'desc' },
      take,
      select: {
        id: true,
        cost: true,
        usedAt: true,
        inspection: {
          select: {
            id: true,
            pretty_id: true,
            vehiclePlateNumber: true,
            status: true,
            urlPdfNoDocs: true,
            urlPdfNoDocsCloud: true,
            createdAt: true,
          },
        },
      },
    });
    return rows.map((r: any) => ({
      id: r.id,
      cost: r.cost,
      usedAt: r.usedAt,
      inspection: r.inspection,
    }));
  }
}
