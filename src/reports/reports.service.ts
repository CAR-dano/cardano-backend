import { Injectable, Logger, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
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

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly credits: CreditsService,
    private readonly backblaze: BackblazeService,
  ) {}

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
        vehiclePlateNumber: true,
        vehicleData: true,
        urlPdfNoDocs: true,
        urlPdfNoDocsCloud: true,
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
        stream.pipe(res);
        return;
      }
    } catch (err: any) {
      this.logger.warn(`Backblaze getFile failed for ${key}: ${err?.message ?? err}`);
    }

    const localPath = path.resolve(process.cwd(), 'pdfarchived', path.basename(filename));
    if (fs.existsSync(localPath)) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Cache-Control', 'private, max-age=0');
      fs.createReadStream(localPath).pipe(res);
      return;
    }

    throw new NotFoundException('PDF file not found');
  }
}

