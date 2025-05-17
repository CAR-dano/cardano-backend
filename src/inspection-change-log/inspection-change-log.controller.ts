import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
} from '@nestjs/common';
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
  async findByInspectionId(
    @Param('inspectionId') inspectionId: string,
  ): Promise<InspectionChangeLog[]> {
    return this.inspectionChangeLogService.findByInspectionId(inspectionId);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a change log entry',
    description: 'Deletes a specific change log entry by its ID.',
  })
  @ApiParam({
    name: 'inspectionId',
    type: String,
    description: 'The ID of the inspection (part of the route)',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'The ID of the change log entry to delete',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Successfully deleted the change log entry.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Change log not found.',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('inspectionId') inspectionId: string, // Meskipun tidak digunakan dalam logika penghapusan berdasarkan ID, tetap perlu ada karena bagian dari route
    @Param('id') id: string,
  ): Promise<void> {
    await this.inspectionChangeLogService.delete(id);
  }
}
