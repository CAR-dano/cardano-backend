import {
  Controller,
  Get,
  Post,
  Param,
  Res,
  NotFoundException,
  UseGuards,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Role } from '@prisma/client';
import { CreditsService } from '../credits/credits.service';
import { BackblazeService } from '../common/services/backblaze.service';
import * as fs from 'fs';
import * as path from 'path';
import { Stream } from 'stream';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiProduces,
  ApiOkResponse,
} from '@nestjs/swagger';
import { ReportDetailResponseDto } from './dto/report-detail-response.dto';

@ApiTags('Reports')
@Controller('reports')
export class ReportsController {
  private readonly logger = new Logger(ReportsController.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly credits: CreditsService,
    private readonly backblaze: BackblazeService,
  ) {}

  /**
   * GET /reports/:id — detail + canDownload
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JwtAuthGuard')
  @ApiOperation({ summary: 'Get report detail with download status' })
  @ApiParam({ name: 'id', description: 'Inspection ID (UUID)' })
  @ApiOkResponse({ description: 'Report detail and canDownload flag', type: ReportDetailResponseDto })
  @ApiResponse({ status: 404, description: 'Inspection not found' })
  async getDetail(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @GetUser('role') userRole: Role,
  ): Promise<ReportDetailResponseDto> {
    const inspection = await this.prisma.inspection.findUnique({
      where: { id },
      select: {
        id: true,
        pretty_id: true,
        vehiclePlateNumber: true,
        vehicleData: true,
        status: true,
        urlPdfNoDocs: true,
        urlPdfNoDocsCloud: true,
      },
    });

    if (!inspection) throw new NotFoundException('Inspection not found');

    let canDownload = userRole !== Role.CUSTOMER;
    if (userRole === Role.CUSTOMER) {
      // Only no-docs is ever downloadable by customer; still need to check prior consumption for free re-download
      const consumed = await this.credits.hasConsumption(userId, id);
      canDownload = consumed; // true if already consumed before
    }

    // Customer balance for UI
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { credits: true },
    });

    return {
      inspection,
      canDownload,
      userCreditBalance: userRole === Role.CUSTOMER ? user?.credits ?? 0 : undefined,
    };
  }

  /**
   * POST /reports/:id/download — proxy stream no-docs PDF
   * Customer: charges 1 credit if first time; re-download is free (idempotent).
   * Non-customer: bypass credits.
   */
  @Post(':id/download')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JwtAuthGuard')
  @ApiOperation({ summary: 'Download no-docs PDF (charges 1 credit for customer on first download)' })
  @ApiParam({ name: 'id', description: 'Inspection ID (UUID)' })
  @ApiProduces('application/pdf')
  @ApiResponse({ status: 200, description: 'PDF stream (application/pdf)' })
  @ApiResponse({ status: 402, description: 'Payment Required (insufficient credits for customer)' })
  @ApiResponse({ status: 404, description: 'No no-docs PDF available or file missing' })
  async download(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @GetUser('role') userRole: Role,
    @Res() res: Response,
  ) {
    const inspection = await this.prisma.inspection.findUnique({
      where: { id },
      select: { urlPdfNoDocs: true, urlPdfNoDocsCloud: true },
    });
    if (!inspection) throw new NotFoundException('Inspection not found');

    // Only no-docs variant is accessible for this endpoint
    const srcUrl = inspection.urlPdfNoDocsCloud || inspection.urlPdfNoDocs;
    if (!srcUrl) throw new NotFoundException('No no-docs PDF available');

    // Customer flow: ensure consumption
    if (userRole === Role.CUSTOMER) {
      const has = await this.credits.hasConsumption(userId, id);
      if (!has) {
        // Try to charge once
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

    // Proxy-style streaming: Backblaze first → local fallback
    const filename = path.basename(srcUrl); // supports '/pdfarchived/..' or full URL
    const key = filename.startsWith('pdfarchived/') ? filename : `pdfarchived/${filename}`;

    // Try Backblaze
    try {
      const stream: Stream | undefined = await this.backblaze.getFile(key);
      if (stream) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Cache-Control', 'private, max-age=0');
        return stream.pipe(res);
      }
    } catch (err: any) {
      this.logger.warn(`Backblaze getFile failed for ${key}: ${err?.message ?? err}`);
    }

    // Local fallback
    const localPath = path.resolve(process.cwd(), 'pdfarchived', path.basename(filename));
    if (fs.existsSync(localPath)) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Cache-Control', 'private, max-age=0');
      const fileStream = fs.createReadStream(localPath);
      return fileStream.pipe(res);
    }

    throw new NotFoundException('PDF file not found');
  }
}
