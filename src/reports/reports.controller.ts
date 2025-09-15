import { Controller, Get, Post, Param, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Role } from '@prisma/client';
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
import { ApiBadRequestResponse, ApiUnauthorizedResponse, ApiForbiddenResponse, ApiInternalServerErrorResponse, ApiNotFoundResponse } from '@nestjs/swagger';
import { HttpErrorResponseDto } from '../common/dto/http-error-response.dto';
import { ApiAuthErrors, ApiStandardErrors } from '../common/decorators/api-standard-errors.decorator';
import { ReportsService } from './reports.service';

@ApiTags('Reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /**
   * GET /reports/:id — detail + canDownload
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JwtAuthGuard')
  @ApiOperation({ summary: 'Get report detail with download status' })
  @ApiParam({ name: 'id', description: 'Inspection ID (UUID)' })
  @ApiOkResponse({ description: 'Report detail and canDownload flag', type: ReportDetailResponseDto })
  @ApiNotFoundResponse({ description: 'Inspection not found', type: HttpErrorResponseDto })
  @ApiAuthErrors()
  async getDetail(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @GetUser('role') userRole: Role,
  ): Promise<ReportDetailResponseDto> {
    return this.reportsService.getDetail(id, userId, userRole);
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
  @ApiOkResponse({ description: 'PDF stream (application/pdf)' })
  @ApiResponse({ status: 402, description: 'Payment Required (insufficient credits for customer)' })
  @ApiNotFoundResponse({ description: 'No no-docs PDF available or file missing', type: HttpErrorResponseDto })
  @ApiAuthErrors()
  async download(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @GetUser('role') userRole: Role,
    @Res() res: Response,
  ) {
    return this.reportsService.streamNoDocsPdf(id, userId, userRole, res);
  }
}
