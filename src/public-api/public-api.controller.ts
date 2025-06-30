/*
 * --------------------------------------------------------------------------
 * File: public-users.controller.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Controller for public user-related API endpoints.
 * Handles requests for publicly accessible user data, such as listing inspectors.
 * Utilizes the UsersService to interact with user data.
 * Provides Swagger documentation annotations for API clarity.
 * --------------------------------------------------------------------------
 */
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  InternalServerErrorException,
  Param,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { LatestArchivedInspectionResponseDto } from 'src/inspections/dto/latest-archived-inspection-response.dto';
import { InspectionsService } from 'src/inspections/inspections.service';
import { PublicApiService } from './public-api.service';
import { InspectionResponseDto } from 'src/inspections/dto/inspection-response.dto';
import { InspectionChangeLog } from '@prisma/client';
import { InspectionChangeLogResponseDto } from 'src/inspection-change-log/dto/inspection-change-log-response.dto';

@ApiTags('Public Users') // Tag for Swagger documentation
@Controller('public') // Base path for this controller
export class PublicApiController {
  private readonly logger = new Logger(PublicApiController.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly inspectionsService: InspectionsService,
    private readonly publicApiService: PublicApiService,
  ) {
    this.logger.log('PublicApiController initialized');
  }

  /**
   * Retrieves a list of all inspector users.
   *
   * @returns A promise that resolves to an array of UserResponseDto objects representing inspector users.
   */
  @Get('users/inspectors') // Specific endpoint for finding all inspectors
  @ApiOperation({
    summary: 'Retrieve all inspector users (Public)',
    description:
      'Fetches a list of all user accounts specifically designated as inspectors. This endpoint is publicly accessible.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of inspector users.',
    type: [UserResponseDto],
  })
  async findAllInspectors(): Promise<UserResponseDto[]> {
    this.logger.log(`Public request: findAllInspectors users`);
    const users = await this.usersService.findAllInspectors();
    return users.map((user) => new UserResponseDto(user)); // Map to safe DTO
  }

  /**
   * [GET /public/latest-archived]
   * Retrieves the 5 most recent inspections with status ARCHIVED,
   * including one photo with the label "Tampak Depan", vehiclePlateNumber,
   * vehicleData.merekKendaraan, and vehicleData.tipeKendaraan.
   * This endpoint is publicly accessible.
   *
   * @returns {Promise<LatestArchivedInspectionResponseDto[]>} An array of the latest archived inspection summaries.
   */
  @Get('latest-archived')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Retrieve 5 latest ARCHIVED inspections with specific details',
    description:
      'Retrieves the 5 most recent inspections with status ARCHIVED, including one photo with the label "Tampak Depan", vehicle plate number, vehicle brand, and vehicle type.',
  })
  @ApiResponse({
    status: 200,
    description: 'Array of the latest archived inspection summaries.',
    type: [LatestArchivedInspectionResponseDto],
  })
  @ApiResponse({
    status: 500,
    description: 'Internal Server Error (e.g., database error).',
  })
  async getLatestArchivedInspections(): Promise<
    LatestArchivedInspectionResponseDto[]
  > {
    this.logger.log('[GET /public/latest-archived] Request received');
    const inspections =
      await this.inspectionsService.findLatestArchivedInspections();

    // Map the results to the DTO, handling the potential error if 'Tampak Depan' photo is missing
    return inspections.map((inspection) => {
      try {
        return new LatestArchivedInspectionResponseDto(inspection);
      } catch (error) {
        this.logger.error(
          `Failed to map inspection ${inspection.id} to DTO: ${error.message}`,
        );
        // Depending on desired behavior, you might skip this inspection or return a partial/error response
        // For now, re-throwing to indicate a critical data inconsistency for this specific inspection.
        throw new InternalServerErrorException(
          `Data inconsistency for inspection ${inspection.id}: ${error.message}`,
        );
      }
    });
  }
  @Get('inspections/:id')
  @ApiOperation({
    summary: 'Retrieve a specific inspection by ID',
    description:
      'Retrieves a specific inspection by ID, applying role-based visibility rules.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'The UUID of the inspection to retrieve.',
  })
  @ApiResponse({
    status: 200,
    description: 'The inspection record summary.',
    type: InspectionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Inspection not found.' })
  async findOne(@Param('id') id: string): Promise<InspectionResponseDto> {
    const inspection = await this.publicApiService.findOne(id);
    return new InspectionResponseDto(inspection);
  }

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
  @Get('inspections/:id/changelog')
  @ApiOperation({
    summary: 'Get inspection change log',
    description: 'Retrieves the change log entries for a specific inspection.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'The ID of the inspection',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Successfully retrieved inspection change log.',
    type: [InspectionChangeLogResponseDto],
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Inspection not found.',
  })
  async findChangesByInspectionId(
    @Param('id') inspectionId: string,
  ): Promise<InspectionChangeLog[]> {
    return this.publicApiService.findChangesByInspectionId(inspectionId);
  }
}
