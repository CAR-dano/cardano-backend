/*
 * --------------------------------------------------------------------------
 * File: inspection-change-log.controller.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: NestJS controller for managing inspection change logs.
 * Imports necessary modules and classes like Controller, Get, Param from @nestjs/common,
 * InspectionChangeLogService, InspectionChangeLog, ApiTags, ApiOperation, ApiResponse, ApiParam,
 * and InspectionChangeLogResponseDto.
 * Declares the InspectionChangeLogController class.
 * Provides the InspectionChangeLogService dependency.
 * --------------------------------------------------------------------------
 */

import { Controller, Get, Param } from '@nestjs/common';
import { InspectionChangeLogService } from './inspection-change-log.service';
import { InspectionChangeLog } from '@prisma/client';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { InspectionChangeLogResponseDto } from './dto/inspection-change-log-response.dto';

@ApiTags('Inspection Change Log')
@Controller('inspections/:inspectionId/changelog')
export class InspectionChangeLogController {
  constructor(
    private readonly inspectionChangeLogService: InspectionChangeLogService,
  ) {}

  @Get()
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
    status: 200,
    description: 'Successfully retrieved inspection change log.',
    type: [InspectionChangeLogResponseDto],
  })
  @ApiResponse({ status: 404, description: 'Inspection not found.' })
  /**
   * Retrieves change logs for a specific inspection.
   *
   * @param inspectionId The ID of the inspection.
   * @returns A promise that resolves to an array of InspectionChangeLog objects.
   */
  async findByInspectionId(
    @Param('inspectionId') inspectionId: string,
  ): Promise<InspectionChangeLog[]> {
    return this.inspectionChangeLogService.findByInspectionId(inspectionId);
  }
}
