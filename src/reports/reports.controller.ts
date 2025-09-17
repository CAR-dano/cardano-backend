/*
 * --------------------------------------------------------------------------
 * File: reports.controller.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: NestJS controller for report-related endpoints.
 * Exposes endpoints to retrieve report details and to proxy-stream the
 * no-docs PDF to authorized users, handling credit charging for
 * CUSTOMER role when applicable.
 * --------------------------------------------------------------------------
 */

import { Controller, Get, Post, Param, Res, UseGuards, Query } from '@nestjs/common';
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
import { ApiCreatedResponse, ApiQuery } from '@nestjs/swagger';
import { ReportDownloadsResponseDto } from './dto/report-downloads-response.dto';

/**
 * @class ReportsController
 * @description Controller for report endpoints (detail lookup and PDF streaming).
 */
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

  /**
   * POST /reports/:id/download-url — returns a short-lived presigned URL
   * Prefer using this endpoint to let clients download directly from storage.
   */
  @Post(':id/download-url')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JwtAuthGuard')
  @ApiOperation({ summary: 'Get presigned URL to download no-docs PDF' })
  @ApiParam({ name: 'id', description: 'Inspection ID (UUID)' })
  @ApiOkResponse({ description: 'Presigned URL issued' })
  @ApiResponse({ status: 402, description: 'Payment Required (insufficient credits for customer)' })
  @ApiNotFoundResponse({ description: 'No no-docs PDF available or file missing', type: HttpErrorResponseDto })
  @ApiAuthErrors()
  async downloadUrl(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @GetUser('role') userRole: Role,
  ) {
    const result = await this.reportsService.getPresignedDownloadUrl(id, userId, userRole);
    return result;
  }

  /**
   * GET /reports/downloads — list user's downloaded reports (credit consumptions)
   */
  @Get('downloads')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JwtAuthGuard')
  @ApiOperation({ summary: 'List downloaded reports (history) for current user' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Filter start (ISO date/time)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Filter end (ISO date/time)' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (1-based). Defaults to 1.' })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, description: 'Items per page (1-100). Defaults to 10.' })
  @ApiOkResponse({
    description: 'Paginated downloads list with metadata',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/ReportDownloadItemDto' },
        },
        meta: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            page: { type: 'number' },
            pageSize: { type: 'number' },
            totalPages: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiAuthErrors()
  async listDownloads(
    @GetUser('id') userId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const parsedPage = Number(page || 1);
    const parsedPageSize = Number(pageSize || 10);
    return this.reportsService.listDownloadsWithMeta(userId, {
      startDate,
      endDate,
      page: parsedPage,
      pageSize: parsedPageSize,
    });
  }
}
