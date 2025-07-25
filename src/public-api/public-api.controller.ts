/*
 * --------------------------------------------------------------------------
 * File: public-api.controller.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: NestJS controller for publicly accessible API endpoints.
 * This controller handles requests related to public user data and inspection summaries.
 * It provides endpoints for listing inspectors, retrieving the latest archived inspections,
 * fetching a specific inspection by ID, and accessing inspection change logs.
 * Utilizes various services (UsersService, InspectionsService, PublicApiService)
 * and integrates with Swagger for API documentation.
 * --------------------------------------------------------------------------
 */

// NestJS core modules
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  InternalServerErrorException,
  Param,
} from '@nestjs/common';

// Swagger documentation modules
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

// Services
import { UsersService } from '../users/users.service';
import { InspectionsService } from 'src/inspections/inspections.service';
import { PublicApiService } from './public-api.service';

// DTOs (Data Transfer Objects)
import { UserResponseDto } from '../users/dto/user-response.dto';
import { LatestArchivedInspectionResponseDto } from 'src/inspections/dto/latest-archived-inspection-response.dto';
import { InspectionResponseDto } from 'src/inspections/dto/inspection-response.dto';
import { InspectionChangeLogResponseDto } from 'src/inspection-change-log/dto/inspection-change-log-response.dto';

// Prisma types
import { InspectionChangeLog } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';

/**
 * @class PublicApiController
 * @description Controller for public-facing API endpoints.
 * Handles requests for publicly accessible data such as inspector lists and inspection summaries.
 */
@ApiTags('Public API') // Tag for Swagger documentation, categorizing endpoints under 'Public API'
@Controller('public') // Base path for all routes defined in this controller
export class PublicApiController {
  // Logger instance for logging messages within this controller
  private readonly logger = new Logger(PublicApiController.name);

  /**
   * @constructor
   * @param usersService Service for user-related operations.
   * @param inspectionsService Service for inspection-related operations.
   * @param publicApiService Service for public API specific operations.
   */
  constructor(
    private readonly usersService: UsersService,
    private readonly inspectionsService: InspectionsService,
    private readonly publicApiService: PublicApiService,
  ) {
    // Log controller initialization
    this.logger.log('PublicApiController initialized');
  }

  /**
   * Retrieves a list of all inspector users.
   * This endpoint is publicly accessible.
   *
   * @returns {Promise<UserResponseDto[]>} A promise that resolves to an array of UserResponseDto objects representing inspector users.
   */
  @Get('users/inspectors') // Defines the GET endpoint for retrieving all inspectors
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({
    summary: 'Retrieve all inspector users (Public)',
    description:
      'Fetches a list of all user accounts specifically designated as inspectors. This endpoint is publicly accessible.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of inspector users.',
    type: [UserResponseDto],
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Bad Request.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Not Found.',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Internal Server Error.',
  })
  async findAllInspectors(): Promise<UserResponseDto[]> {
    // Log the incoming public request
    this.logger.log(`Public request: findAllInspectors users`);
    // Fetch all inspector users from the UsersService
    const users = await this.usersService.findAllInspectors();
    // Map the retrieved user entities to UserResponseDto for safe public exposure
    return users.map((user) => new UserResponseDto(user));
  }

  /**
   * Retrieves the 5 most recent inspections with status ARCHIVED.
   * Includes specific details like one photo with the label "Front View",
   * vehicle plate number, vehicle brand, and vehicle type.
   * This endpoint is publicly accessible.
   *
   * @returns {Promise<LatestArchivedInspectionResponseDto[]>} An array of the latest archived inspection summaries.
   * @throws {InternalServerErrorException} If there is a data inconsistency or an internal server error during mapping.
   */
  @Get('latest-archived') // Defines the GET endpoint for retrieving latest archived inspections
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @HttpCode(HttpStatus.OK) // Sets the HTTP status code for successful responses to 200 OK
  @ApiOperation({
    summary: 'Retrieve 5 latest ARCHIVED inspections with specific details',
    description:
      'Retrieves the 5 most recent inspections with status ARCHIVED, including one photo with the label "Front View", vehicle plate number, vehicle brand, and vehicle type.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Array of the latest archived inspection summaries.',
    type: [LatestArchivedInspectionResponseDto],
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Bad Request.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Not Found.',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Internal Server Error (e.g., database error).',
  })
  async getLatestArchivedInspections(): Promise<
    LatestArchivedInspectionResponseDto[]
  > {
    // Log the incoming request for latest archived inspections
    this.logger.log('[GET /public/latest-archived] Request received');
    // Fetch the latest archived inspections from the InspectionsService
    const inspections =
      await this.inspectionsService.findLatestArchivedInspections();

    // Map the results to the DTO, handling potential errors if the "Front View" photo is missing
    return inspections.map((inspection) => {
      try {
        return new LatestArchivedInspectionResponseDto(inspection);
      } catch (error: any) {
        // Explicitly type error as any to allow access to .message
        // Log the error if mapping fails for a specific inspection
        this.logger.error(
          `Failed to map inspection ${inspection.id} to DTO: ${(error as Error).message}`,
        );
        // Re-throw to indicate a critical data inconsistency for this specific inspection
        throw new InternalServerErrorException(
          `Data inconsistency for inspection ${inspection.id}: ${(error as Error).message}`,
        );
      }
    });
  }

  /**
   * Retrieves a specific inspection by its ID.
   * This endpoint applies role-based visibility rules.
   *
   * @param {string} id The UUID of the inspection to retrieve.
   * @returns {Promise<InspectionResponseDto>} A promise that resolves to the inspection record summary.
   * @throws {NotFoundException} If the inspection with the given ID is not found.
   */
  @Get('inspections/:id') // Defines the GET endpoint for retrieving a single inspection by ID
  @Throttle({ default: { limit: 120, ttl: 60000 } })
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
    status: HttpStatus.OK,
    description: 'The inspection record summary.',
    type: InspectionResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Bad Request.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Inspection not found.',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Internal Server Error.',
  })
  async findOne(@Param('id') id: string): Promise<InspectionResponseDto> {
    // Retrieve the inspection using the PublicApiService
    const inspection = await this.publicApiService.findOne(id);
    // Map the retrieved inspection entity to InspectionResponseDto
    return new InspectionResponseDto(inspection);
  }

  /**
   * Retrieves a specific inspection by its ID, excluding photos with sensitive document labels.
   * This endpoint is for public consumption where STNK/BPKB photos should not be visible.
   *
   * @param {string} id The UUID of the inspection to retrieve.
   * @returns {Promise<InspectionResponseDto>} A promise that resolves to the inspection record summary without sensitive documents.
   */
  @Get('inspections/:id/no-docs')
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @ApiOperation({
    summary: 'Retrieve an inspection by ID without sensitive documents',
    description:
      'Retrieves a specific inspection by ID, but excludes photos labeled as "STNK" or "BPKB" for public viewing.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'The UUID of the inspection to retrieve.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The inspection record summary without sensitive documents.',
    type: InspectionResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Inspection not found.',
  })
  async findOneWithoutDocuments(
    @Param('id') id: string,
  ): Promise<InspectionResponseDto> {
    const inspection = await this.publicApiService.findOneWithoutDocuments(id);
    return new InspectionResponseDto(inspection);
  }

  /**
   * Retrieves change logs for a specific inspection.
   * This endpoint is restricted to ADMIN and REVIEWER roles only.
   *
   * @param {string} inspectionId The ID of the inspection.
   * @returns {Promise<InspectionChangeLog[]>} A promise that resolves to an array of InspectionChangeLog objects.
   * @throws {UnauthorizedException} If the user is not authenticated.
   * @throws {ForbiddenException} If the user does not have the required role.
   * @throws {NotFoundException} If the inspection is not found.
   */
  @Get('inspections/:id/changelog') // Defines the GET endpoint for retrieving inspection change logs
  @Throttle({ default: { limit: 120, ttl: 60000 } })
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
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Bad Request.',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Internal Server Error.',
  })
  async findChangesByInspectionId(
    @Param('id') inspectionId: string,
  ): Promise<InspectionChangeLog[]> {
    // Retrieve the change logs for the specified inspection ID using PublicApiService
    return this.publicApiService.findChangesByInspectionId(inspectionId);
  }
}
