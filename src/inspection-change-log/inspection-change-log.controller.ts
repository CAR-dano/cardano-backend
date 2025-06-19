/*
 * --------------------------------------------------------------------------
 * File: inspection-change-log.controller.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: NestJS controller for managing inspection change logs.
 * Handles API requests related to retrieving and deleting change log entries
 * for specific inspections.
 * --------------------------------------------------------------------------
 */

import { Controller, Get, Param, UseGuards, HttpStatus } from '@nestjs/common';
import { InspectionChangeLogService } from './inspection-change-log.service';
import { InspectionChangeLog, Role } from '@prisma/client';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { InspectionChangeLogResponseDto } from './dto/inspection-change-log-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Inspection Change Log')
@Controller('inspections/:inspectionId/changelog')
export class InspectionChangeLogController {
  constructor(
    private readonly inspectionChangeLogService: InspectionChangeLogService,
  ) {}

  /**
   * Retrieves change logs for a specific inspection.
   * Restricted to ADMIN and REVIEWER roles only.
   *
   * @param inspectionId The ID of the inspection.
   * @returns A promise that resolves to an array of InspectionChangeLog objects.
   * @throws UnauthorizedException if the user is not authenticated.
   * @throws ForbiddenException if the user does not have the required role.
   * @throws NotFoundException if the inspection is not found.
   */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.REVIEWER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get inspection change log',
    description: 'Retrieves the change log entries for a specific inspection.',
  })
  @ApiParam({
    name: 'inspectionId',
    type: String,
    description: 'The ID of the inspection',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Successfully retrieved inspection change log.',
    type: [InspectionChangeLogResponseDto],
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User is not authenticated.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have the required permissions.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Inspection not found.',
  })
  async findByInspectionId(
    @Param('inspectionId') inspectionId: string,
  ): Promise<InspectionChangeLog[]> {
    return this.inspectionChangeLogService.findByInspectionId(inspectionId);
  }
}
