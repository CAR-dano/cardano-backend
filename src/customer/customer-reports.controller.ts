/*
 * --------------------------------------------------------------------------
 * File: customer-reports.controller.ts
 * Project: car-dano-backend
 * --------------------------------------------------------------------------
 * Description: Controller exposing customer-facing endpoints to access
 * purchased inspection reports, view detailed data, and download the
 * no-docs PDF variant.
 * --------------------------------------------------------------------------
 */

import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { CustomerReportsService } from './customer-reports.service';
import { PurchasedReportsQueryDto } from './dto/purchased-reports-query.dto';
import {
  PurchasedReportsListResponseDto,
  PurchasedReportDetailResponseDto,
} from './dto/purchased-reports-list.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserResponseDto } from '../users/dto/user-response.dto';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiNotFoundResponse,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiParam,
  ApiProduces,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard, SkipThrottle } from '@nestjs/throttler';
import { Response } from 'express';

@ApiTags('Customer Reports')
@ApiBearerAuth('JwtAuthGuard')
@Controller('me/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CUSTOMER)
export class CustomerReportsController {
  constructor(private readonly customerReports: CustomerReportsService) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @UseGuards(ThrottlerGuard)
  @ApiOperation({ summary: 'List purchased inspection reports' })
  @ApiOkResponse({
    description: 'List of purchased inspection reports with pagination metadata.',
    type: PurchasedReportsListResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid query parameters.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  async listPurchasedReports(
    @GetUser() user: UserResponseDto,
    @Query() query: PurchasedReportsQueryDto,
  ): Promise<PurchasedReportsListResponseDto> {
    const result = await this.customerReports.listPurchasedReports(
      user.id,
      query,
    );
    return new PurchasedReportsListResponseDto(result);
  }

  @Get(':inspectionId')
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @UseGuards(ThrottlerGuard)
  @ApiOperation({ summary: 'Get detail of a purchased inspection report' })
  @ApiParam({ name: 'inspectionId', format: 'uuid' })
  @ApiOkResponse({
    description: 'Detailed inspection report metadata.',
    type: PurchasedReportDetailResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Report not found for current user.' })
  async getReportDetail(
    @GetUser() user: UserResponseDto,
    @Param('inspectionId', new ParseUUIDPipe()) inspectionId: string,
  ): Promise<PurchasedReportDetailResponseDto> {
    const detail = await this.customerReports.getReportDetail(
      user.id,
      inspectionId,
    );
    return detail as PurchasedReportDetailResponseDto;
  }

  @Get(':inspectionId/no-docs')
  @SkipThrottle()
  @ApiOperation({ summary: 'Download no-docs PDF for purchased report' })
  @ApiParam({ name: 'inspectionId', format: 'uuid' })
  @ApiOkResponse({
    description: 'Streams the no-docs PDF for the purchased report.',
  })
  @ApiNotFoundResponse({ description: 'Report not found for current user.' })
  @ApiForbiddenResponse({ description: 'Report is not yet available.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiProduces('application/pdf')
  async downloadNoDocs(
    @GetUser() user: UserResponseDto,
    @Param('inspectionId', new ParseUUIDPipe()) inspectionId: string,
    @Res({ passthrough: false }) res: Response,
  ): Promise<void> {
    res.status(HttpStatus.OK);
    await this.customerReports.streamNoDocs(user.id, inspectionId, res);
  }
}
