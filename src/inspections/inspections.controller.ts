/*
 * --------------------------------------------------------------------------
 * File: inspections.controller.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Controller responsible for handling HTTP requests related to inspections.
 * Provides endpoints for creating inspection data, adding photos (single or batch per type),
 * retrieving all/single inspections, updating photos, deleting photos,
 * and managing inspection status lifecycle (approve, reject, archive, deactivate, activate).
 * Authentication/Authorization guards are commented out for initial development/testing.
 * --------------------------------------------------------------------------
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFiles,
  UploadedFile,
  Logger,
  BadRequestException,
  HttpCode,
  HttpStatus,
  Query,
  NotFoundException,
  Res,
  UseGuards, // Import InternalServerErrorException
  InternalServerErrorException,
} from '@nestjs/common';
import { InspectionsService } from './inspections.service';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { CreateInspectionDto } from './dto/create-inspection.dto';
import { UpdateInspectionDto } from './dto/update-inspection/update-inspection.dto';
import {
  BulkApproveInspectionDto,
  BulkApproveInspectionResponseDto,
} from './dto/bulk-approve-inspection.dto';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express'; // NestJS interceptor for handling multiple file fields
import { diskStorage, memoryStorage } from 'multer'; // Storage engines for Multer
import { extname } from 'path'; // Node.js utility for handling file extensions
import { Role, InspectionStatus } from '@prisma/client';
import { InspectionResponseDto } from './dto/inspection-response.dto';
import { PhotoResponseDto } from '../photos/dto/photo-response.dto';
import { UpdatePhotoDto } from '../photos/dto/update-photo.dto';
import { PhotosService } from '../photos/photos.service';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import {
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiNoContentResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { HttpErrorResponseDto } from '../common/dto/http-error-response.dto';
import { ApiAuthErrors } from '../common/decorators/api-standard-errors.decorator';
import { AddMultiplePhotosDto } from 'src/photos/dto/add-multiple-photos.dto';
import { AddSinglePhotoDto } from 'src/inspections/dto/add-single-photo.dto';
import { BuildMintTxResponseDto } from '../blockchain/dto/build-mint-tx-response.dto';
import { BuildMintRequestDto } from './dto/build-mint-request.dto';
import { ConfirmMintDto } from './dto/confirm-mint.dto';
import { Request, Response } from 'express';
// Import Guards for authentication and authorization
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Req } from '@nestjs/common'; // Import Req decorator
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { FileValidationPipe } from './pipes/file-validation.pipe';
import { OptionalFileValidationPipe } from './pipes/optional-file-validation.pipe';
import { SkipThrottle, Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { skip } from 'rxjs';

// Define an interface for the expected photo metadata structure
interface PhotoMetadata {
  label: string;
  needAttention?: string;
}

// --- Multer Configuration ---
const MAX_PHOTOS_PER_REQUEST = 10; // Max files per batch upload request
const UPLOAD_PATH = './uploads/inspection-photos';

/**
 * Multer disk storage configuration for uploaded inspection photos.
 * Saves files to the UPLOAD_PATH with unique filenames.
 */
// Use memory storage so we can push directly to Backblaze via service
const photoStorageConfig = memoryStorage();

/**
 * Controller managing all HTTP requests related to vehicle inspections.
 * Base route: /api/v1/inspections
 */
@ApiTags('Inspection Data') // For Swagger/Scalar documentation grouping
@Controller('inspections')
export class InspectionsController {
  // Logger instance specific to this controller
  private readonly logger = new Logger(InspectionsController.name);

  /**
   * Constructs the InspectionsController.
   * Injects required services via NestJS Dependency Injection.
   * @param inspectionsService Service for core inspection logic.
   * @param photosService Service specifically for handling photo operations.
   */
  constructor(
    private readonly inspectionsService: InspectionsService,
    private readonly photosService: PhotosService,
  ) {}

  /**
   * Handles the creation of a new inspection record.
   * [POST /inspections]
   * Creates the initial inspection record containing text and JSON data.
   * This is the first step before uploading photos or archiving.
   * Expects 'application/json' content type.
   * @param {CreateInspectionDto} createInspectionDto - DTO containing the initial inspection data.
   * @returns {Promise<{ id: string }>} An object containing the ID of the newly created inspection.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.INSPECTOR)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(ThrottlerGuard)
  // @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a new inspection record (Inspector only)',
    description:
      'Creates the initial inspection record containing text and JSON data. This is the first step before uploading photos or archiving. Only accessible by users with the INSPECTOR role.',
  })
  @ApiBody({ type: CreateInspectionDto })
  @ApiCreatedResponse({ description: 'The newly created inspection record summary.', type: InspectionResponseDto })
  @ApiBadRequestResponse({ description: 'Bad Request (e.g., invalid input data).', type: HttpErrorResponseDto })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.', type: HttpErrorResponseDto })
  @ApiAuthErrors()
  async create(
    @Body() createInspectionDto: CreateInspectionDto,
    @GetUser('id') inspectorId: string,
    @Req() req: Request,
  ): Promise<{ id: string }> {
    // Structured request logging (safe subset only)
    this.logger.log(
      `[POST /inspections] Create requested by ${inspectorId ?? 'anonymous'}`,
    );
    this.logger.debug(
      `Payload snapshot: plate=${createInspectionDto?.vehiclePlateNumber ?? 'N/A'}, date=${createInspectionDto?.inspectionDate ?? 'N/A'}, rating=${createInspectionDto?.overallRating ?? 'N/A'}, reqInspector=${createInspectionDto?.identityDetails?.namaInspektor ?? 'N/A'}, reqBranch=${createInspectionDto?.identityDetails?.cabangInspeksi ?? 'N/A'}`,
    );

    try {
      const newInspection = await this.inspectionsService.create(
        createInspectionDto,
        inspectorId,
      );
      this.logger.log(
        `[POST /inspections] Created successfully: id=${newInspection.id}`,
      );
      return newInspection;
    } catch (err: any) {
      // Normalize and enrich error response for better client debugging
      const path = req?.url ?? '/inspections';
      const timestamp = new Date().toISOString();

      // Known HttpExceptions: preserve status and convert message to array when needed
      if (err?.getStatus && err?.getResponse) {
        const status = err.getStatus();
        const resp = err.getResponse() as any;
        const messageRaw =
          typeof resp === 'string' ? resp : resp?.message ?? err.message;
        const message = Array.isArray(messageRaw)
          ? messageRaw
          : [String(messageRaw ?? 'Request failed')];

        const errorName =
          (typeof resp === 'object' && resp?.error) || err.name || 'Error';

        const body = {
          statusCode: status,
          message,
          error: errorName,
          path,
          timestamp,
        } as HttpErrorResponseDto;

        this.logger.warn(
          `[POST /inspections] ${errorName} ${status}: ${message.join(' | ')}`,
        );
        // Re-throw with normalized body
        throw new (err.constructor as any)(body);
      }

      // Unknown errors — return 500 with normalized body
      const body = {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: [err?.message ?? 'Internal server error'],
        error: 'Internal Server Error',
        path,
        timestamp,
      } as HttpErrorResponseDto;

      const msgArr = Array.isArray(body.message)
        ? body.message
        : [String(body.message ?? 'Internal server error')];
      this.logger.error(
        `[POST /inspections] Unhandled error: ${msgArr.join(' | ')}`,
        err?.stack ?? undefined,
      );
      throw new InternalServerErrorException(body);
    }
  }

  /**
   * Handles the update of an existing inspection record.
   * [PUT /inspections/:id]
   * Partially updates the text/JSON data fields of an existing inspection.
   * Does not handle photo updates. Expects 'application/json'.
   * @param id The UUID of the inspection to update.
   * @param updateInspectionDto DTO containing the fields to update.
   * @returns A promise that resolves to the updated inspection record summary.
   */
  @Put(':id')
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.REVIEWER, Role.SUPERADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update an existing inspection record',
    description:
      'Partially updates the text/JSON data fields of an existing inspection. Does not handle photo updates.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'The UUID of the inspection to update.',
  })
  @ApiBody({ type: UpdateInspectionDto })
  @ApiOkResponse({
    description: 'Message indicating changes have been logged.',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Bad Request (e.g., invalid input data).', type: HttpErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Inspection not found.', type: HttpErrorResponseDto })
  @ApiAuthErrors()
  // @ApiBearerAuth('NamaSkemaKeamanan') // Add if JWT guard is enabled
  async update(
    @Param('id') id: string,
    @Body() updateInspectionDto: UpdateInspectionDto,
    @GetUser('id') userId: string,
    @GetUser('role') userRole: Role,
  ): Promise<{ message: string }> {
    const result = await this.inspectionsService.update(
      id,
      updateInspectionDto,
      userId,
      userRole,
    );
    return result;
  }

  // --- Photo Batch Upload Endpoints ---

  /**
   * [POST /inspections/:id/photos/multiple]
   * Uploads a batch of photos for an inspection.
   * Expects 'multipart/form-data' with 'metadata' (JSON string array) and 'photos' (files).
   * @param {string} id - Inspection UUID.
   * @param {AddMultiplePhotosDto} addBatchDto - DTO containing the 'metadata' JSON string.
   * @param {Express.Multer.File[]} files - Array of uploaded image files from the 'photos' field.
   * @returns {Promise<PhotoResponseDto[]>} Array of created photo record summaries.
   */
  @Post(':id/photos/multiple') // Renamed endpoint
  @SkipThrottle()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FilesInterceptor('photos', MAX_PHOTOS_PER_REQUEST, {
      storage: photoStorageConfig,
    }),
  )
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.REVIEWER, Role.INSPECTOR)
  @ApiOperation({
    summary: 'Upload a batch of photos for an inspection', // Updated summary
    description:
      'Uploads a batch of photos for an inspection. Expects multipart/form-data with "metadata" (JSON string array) and "photos" (files).', // Updated description
  })
  @ApiConsumes('multipart/form-data')
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'Inspection ID',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        metadata: {
          type: 'string',
          description:
            'JSON string array of metadata for each photo (e.g., [{"label": "damage", "needAttention": true}]). Must match the order of uploaded files.',
        },
        photos: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description:
            'Array of image files (jpg, jpeg, png, gif). Max 10 files per request.',
        },
      },
      required: ['metadata', 'photos'],
    },
    description: 'Metadata and photo files for the batch upload.',
  })
  @ApiCreatedResponse({ description: 'Array of created photo record summaries.', type: [PhotoResponseDto] })
  @ApiBadRequestResponse({ description: 'Bad Request (e.g., invalid input, no files provided, invalid file type).', type: HttpErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Inspection not found.', type: HttpErrorResponseDto })
  // @ApiBearerAuth('NamaSkemaKeamanan') // Add if JWT guard is enabled
  async addMultiplePhotos(
    @Param('id') id: string,
    @Body() addBatchDto: AddMultiplePhotosDto,
    @UploadedFiles(new FileValidationPipe())
    files: Array<Express.Multer.File>,
    // @GetUser('id') userId: string,
  ): Promise<PhotoResponseDto[]> {
    this.logger.log(
      `[POST /inspections/${id}/photos/multiple] Received ${files?.length} files.`,
    );
    if (!files || files.length === 0)
      throw new BadRequestException('No photo files provided.');
    const newPhotos = await this.photosService.addMultiplePhotos(
      id,
      files,
      addBatchDto.metadata,
    );
    return newPhotos.map((p) => new PhotoResponseDto(p));
  }

  /**
   * Handles the upload of a single photo for an inspection.
   * [POST /inspections/:id/photos/single]
   * Expects 'multipart/form-data' with 'label' (string) and optionally 'needAttention' (string "true" or "false") and 'photo' (file).
   * @param id Inspection UUID.
   * @param addSingleDto DTO containing the label and optional needAttention flag.
   * @param file The uploaded image file from the 'photo' field.
   * @returns A promise that resolves to the created photo record summary.
   */
  @Post(':id/photos/single')
  @SkipThrottle()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.REVIEWER, Role.INSPECTOR)
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: photoStorageConfig,
    }),
  )
  @ApiOperation({
    summary: 'Upload a single photo for an inspection',
    description:
      'Uploads a single photo for an inspection. Expects multipart/form-data with "label" (string) and optionally "needAttention" (string "true" or "false") and "photo" (file).',
  })
  @ApiConsumes('multipart/form-data')
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'Inspection ID',
  })
  @ApiBody({
    type: AddSinglePhotoDto,
    description:
      'Metadata (label, needAttention) and photo file for the upload.',
  })
  @ApiCreatedResponse({ description: 'The created photo record summary.', type: PhotoResponseDto })
  @ApiBadRequestResponse({ description: 'Bad Request (e.g., invalid input, no file provided, invalid file type).', type: HttpErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Inspection not found.', type: HttpErrorResponseDto })
  // @ApiBearerAuth('NamaSkemaKeamanan') // Add if JWT guard is enabled
  async addSinglePhoto(
    @Param('id') id: string,
    @Body() addSingleDto: AddSinglePhotoDto,
    @UploadedFile(new FileValidationPipe()) file: Express.Multer.File,
  ): Promise<PhotoResponseDto> {
    this.logger.log(
      `[POST /inspections/${id}/photos/single] Received file: ${file?.filename}`,
    );
    if (!file) throw new BadRequestException('No photo file provided.');

    let parsedMetadata: PhotoMetadata;
    try {
      const metadata = JSON.parse(addSingleDto.metadata) as PhotoMetadata; // Type assertion
      if (
        !metadata ||
        typeof metadata.label !== 'string' ||
        (metadata.needAttention !== undefined &&
          typeof metadata.needAttention !== 'string') // Check for string type
      ) {
        throw new BadRequestException('Invalid metadata format.');
      }
      parsedMetadata = {
        label: metadata.label,
        needAttention: metadata.needAttention,
      };
    } catch (error: unknown) {
      // Type error as unknown
      let errorMessage = 'Invalid metadata format.';
      if (error instanceof Error) {
        // Use type guard
        errorMessage += ` ${error.message}`;
      }
      throw new BadRequestException(errorMessage);
    }

    const newPhoto = await this.photosService.addPhoto(
      id,
      file,
      parsedMetadata,
    );
    return new PhotoResponseDto(newPhoto);
  }

  // --- Photo Management Endpoints ---

  /**
   * Handles the retrieval of all photo records for a specific inspection.
   * [GET /inspections/:id/photos]
   * Retrieves all photo records associated with a specific inspection.
   * @param id Inspection ID.
   * @returns A promise that resolves to an array of photo record summaries.
   */
  @Get(':id/photos')
  @SkipThrottle()
  @UseGuards(ThrottlerGuard)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.REVIEWER, Role.SUPERADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Retrieve all photos for an inspection',
    description:
      'Retrieves all photo records associated with a specific inspection.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'Inspection ID',
  })
  @ApiOkResponse({ description: 'Array of photo record summaries.', type: [PhotoResponseDto] })
  @ApiNotFoundResponse({ description: 'Inspection not found.', type: HttpErrorResponseDto })
  @ApiAuthErrors()
  // @ApiBearerAuth('NamaSkemaKeamanan') // Add if JWT guard is enabled
  async getPhotosForInspection(
    @Param('id') id: string,
  ): Promise<PhotoResponseDto[]> {
    this.logger.log(`[GET /inspections/${id}/photos] Request received`);
    const photos = await this.photosService.findForInspection(id);
    return photos.map((p) => new PhotoResponseDto(p));
  }

  /**
   * Handles the update of a specific photo's metadata and/or file.
   * [PUT /inspections/:id/photos/:photoId]
   * Updates a specific photo's metadata and/or replaces its file.
   * Expects 'multipart/form-data'. File and metadata fields are optional.
   * @param inspectionId Inspection ID.
   * @param photoId Photo ID.
   * @param updatePhotoDto Optional metadata updates (label, needAttention).
   * @param newFile Optional new photo file.
   * @returns A promise that resolves to the updated photo record summary.
   */
  @Put(':id/photos/:photoId')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: photoStorageConfig,
    }),
  ) // Handle single optional file
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.REVIEWER, Role.SUPERADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update a specific photo',
    description:
      "Updates a specific photo's metadata (label, needAttention) and/or replaces its file. Expects multipart/form-data. File and metadata fields are optional.",
  })
  @ApiConsumes('multipart/form-data')
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'Inspection ID',
  })
  @ApiParam({
    name: 'photoId',
    type: String,
    format: 'uuid',
    description: 'Photo ID',
  })
  @ApiBody({
    type: UpdatePhotoDto,
    description:
      'Optional metadata updates (label, needAttention) and/or a new photo file.',
  })
  @ApiOkResponse({ description: 'The updated photo record summary.', type: PhotoResponseDto })
  @ApiBadRequestResponse({ description: 'Bad Request (e.g., invalid input, invalid file type).', type: HttpErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Inspection or Photo not found.', type: HttpErrorResponseDto })
  @ApiAuthErrors()
  // @ApiBearerAuth('NamaSkemaKeamanan') // Add if JWT guard is enabled
  async updatePhoto(
    @Param('id') inspectionId: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
    @Body() updatePhotoDto: UpdatePhotoDto, // Contains optional label/needAttention
    @GetUser('id') userId: string,
    @UploadedFile(new OptionalFileValidationPipe())
    newFile?: Express.Multer.File, // Optional new file, validate only if present
  ): Promise<PhotoResponseDto> {
    this.logger.debug('Update DTO:', updatePhotoDto);
    this.logger.debug('New file:', newFile?.filename);

    // Add a check to ensure newFile is a valid file object before passing to service
    // This helps mitigate potential ESLint "unsafe assignment" warnings related to Multer errors
    const fileToPass = newFile && 'filename' in newFile ? newFile : undefined;

    const updatedPhoto = await this.photosService.updatePhoto(
      inspectionId,
      photoId,
      updatePhotoDto,
      fileToPass,
      userId,
    );
    return new PhotoResponseDto(updatedPhoto);
  }

  /**
   * Handles the deletion of a specific photo record and its associated file.
   * [DELETE /inspections/:id/photos/:photoId]
   * Deletes a specific photo record and its associated file (if stored locally).
   * @param inspectionId Inspection ID (for path consistency).
   * @param photoId Photo ID.
   * @returns A promise that resolves when the photo is deleted.
   */
  @Delete(':id/photos/:photoId')
  @SkipThrottle()
  @HttpCode(HttpStatus.NO_CONTENT) // Standard for successful DELETE with no body
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.REVIEWER, Role.SUPERADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete a specific photo',
    description:
      'Deletes a specific photo record and its associated file (if stored locally).',
  })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'Inspection ID (for path consistency)',
  })
  @ApiParam({
    name: 'photoId',
    type: String,
    format: 'uuid',
    description: 'Photo ID',
  })
  @ApiNoContentResponse({ description: 'Photo deleted successfully (No Content).' })
  @ApiNotFoundResponse({ description: 'Photo not found.', type: HttpErrorResponseDto })
  @ApiAuthErrors()
  // @ApiBearerAuth('NamaSkemaKeamanan') // Add if JWT guard is enabled
  async deletePhoto(
    @Param('id', ParseUUIDPipe) inspectionId: string, // Included for path consistency, might not be needed by service
    @Param('photoId', ParseUUIDPipe) photoId: string,
    @GetUser('id') userId: string,
  ): Promise<void> {
    await this.photosService.deletePhoto(photoId, userId);
    // No return body for 204
  }

  // --- Inspection Retrieval Endpoints ---

  /**
   * [GET /inspections/search]
   * Retrieves a single inspection by vehicle plate number (case-insensitive, space-agnostic).
   * This endpoint is publicly accessible.
   *
   * @param {string} vehiclePlateNumber - The vehicle plate number to search for.
   * @returns {Promise<InspectionResponseDto>} The found inspection record summary.
   * @throws {NotFoundException} If inspection not found.
   */
  @Get('search')
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Search for an inspection by vehicle plate number',
    description:
      'Retrieves a single inspection by vehicle plate number (case-insensitive, space-agnostic).',
  })
  @ApiQuery({
    name: 'vehicleNumber',
    required: true,
    type: String,
    description: 'The vehicle plate number to search for (e.g., "AB 1234 CD").',
  })
  @ApiOkResponse({ description: 'The found inspection record summary.', type: InspectionResponseDto })
  @ApiNotFoundResponse({ description: 'Inspection not found.', type: HttpErrorResponseDto })
  async searchByVehicleNumber(
    @Query('vehicleNumber') vehicleNumber: string,
  ): Promise<InspectionResponseDto> {
    this.logger.log(
      `[GET /inspections/search] Searching for vehicle number: ${vehicleNumber}`,
    );
    const inspection =
      await this.inspectionsService.findByVehiclePlateNumber(vehicleNumber);

    if (!inspection) {
      throw new NotFoundException(
        `Inspection with vehicle plate number "${vehicleNumber}" not found.`,
      );
    }

    return new InspectionResponseDto(inspection);
  }

  /**
   * [GET /inspections/search/keyword]
   * Retrieves a list of inspections matching a general keyword.
   *
   * @param {string} q - The general keyword to search for.
   * @returns {Promise<InspectionResponseDto[]>} A list of found inspection summaries.
   */
  @Get('search/keyword')
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.REVIEWER, Role.SUPERADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Search for inspections by a general keyword',
    description:
      'Retrieves inspections that match a keyword in fields like plate number, vehicle make, model, etc.',
  })
  @ApiQuery({
    name: 'q',
    required: true,
    type: String,
    description:
      'The keyword to search for (e.g., "Avanza", "AB 1234 CD", "pending").',
  })
  @ApiOkResponse({ description: 'A list of found inspection records. Returns an empty array if no matches are found.', type: [InspectionResponseDto] })
  @ApiAuthErrors()
  async searchByKeyword(
    @Query('q') keyword: string,
  ): Promise<InspectionResponseDto[]> {
    this.logger.log(
      `[GET /inspections/search/keyword] Searching for keyword: ${keyword}`,
    );

    const inspections = await this.inspectionsService.searchByKeyword(keyword);

    return inspections.map(
      (inspection) => new InspectionResponseDto(inspection),
    );
  }

  /**
   * [GET /inspections]
   * Retrieves all inspection records with pagination and metadata.
   * Filters results based on the requesting user's role (passed via query).
   */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @SkipThrottle()
  @Roles(Role.ADMIN, Role.REVIEWER, Role.SUPERADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Retrieve all inspection records with pagination',
    description:
      'Retrieves all inspection records with pagination and metadata, potentially filtered by role (passed via query parameter).',
  })
  @ApiQuery({
    name: 'role',
    required: false,
    enum: Role,
    description: 'Filter inspections by user role.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    isArray: true, // Indicate that multiple values are allowed
    description: 'Filter inspections by inspection status (can be multiple).',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (1-based). Defaults to 1.',
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    type: Number,
    description: 'Number of items per page. Defaults to 10.',
  })
  @ApiOkResponse({
    description: 'Paginated list of inspection record summaries with metadata.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/InspectionResponseDto' },
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
  // @ApiBearerAuth('NamaSkemaKeamanan') // Add if JWT guard is enabled
  async findAll(
    @Query('role') userRole?: Role,
    @Query('status') status?: string | string[], // Accept as string or string array
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 10,
    /* @GetUser('role') realUserRole: Role */
  ): Promise<{
    data: InspectionResponseDto[];
    meta: { total: number; page: number; pageSize: number; totalPages: number };
  }> {
    const pageNumber =
      parseInt(page as any, 10) > 0 ? parseInt(page as any, 10) : 1;
    const pageSizeNumber =
      parseInt(pageSize as any, 10) > 0 ? parseInt(pageSize as any, 10) : 10;

    let parsedStatus: InspectionStatus[] | undefined;

    if (typeof status === 'string') {
      // If it's a comma-separated string, split it
      parsedStatus = status.split(',').map((s) => {
        const trimmedStatus = s.trim();
        if (!(trimmedStatus in InspectionStatus)) {
          throw new BadRequestException(
            `Invalid InspectionStatus: ${trimmedStatus}`,
          );
        }
        return trimmedStatus as InspectionStatus;
      });
    } else if (Array.isArray(status)) {
      // If it's already an array (e.g., from development environment or direct array input)
      parsedStatus = status.map((s) => {
        const trimmedStatus = s.trim();
        if (!(trimmedStatus in InspectionStatus)) {
          throw new BadRequestException(
            `Invalid InspectionStatus: ${trimmedStatus}`,
          );
        }
        return trimmedStatus as InspectionStatus;
      });
    }

    this.logger.warn(
      `[GET /inspections] Applying filter for role: ${userRole}, page: ${page}, pageSize: ${pageSize}, status: ${parsedStatus ? parsedStatus.join(',') : 'undefined'}`,
    );
    const result = await this.inspectionsService.findAll(
      userRole,
      parsedStatus,
      pageNumber,
      pageSizeNumber,
    );
    return {
      data: result.data.map(
        (inspection) => new InspectionResponseDto(inspection),
      ),
      meta: result.meta,
    };
  }

  /**
   * Handles the retrieval of a specific inspection by ID.
   * [GET /inspections/:id]
   * Retrieves a specific inspection by ID, applying role-based visibility rules.
   * @param id The UUID of the inspection to retrieve.
   * @param userRole Optional role to filter inspection visibility by.
   * @returns A promise that resolves to the inspection record summary.
   */
  @Get(':id')
  @SkipThrottle()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.REVIEWER, Role.SUPERADMIN)
  @ApiBearerAuth()
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
  @ApiQuery({
    name: 'role',
    required: false,
    enum: Role,
    description: 'Filter inspection visibility by user role.',
  })
  @ApiOkResponse({ description: 'The inspection record summary.', type: InspectionResponseDto })
  @ApiNotFoundResponse({ description: 'Inspection not found.', type: HttpErrorResponseDto })
  @ApiAuthErrors()
  // @ApiBearerAuth('NamaSkemaKeamanan') // Add if JWT guard is enabled
  async findOne(
    @Param('id') id: string,
    @GetUser('role') realUserRole: Role,
  ): Promise<InspectionResponseDto> {
    const inspection = await this.inspectionsService.findOne(id, realUserRole);
    return new InspectionResponseDto(inspection);
  }

  // --- Status Management Endpoints ---

  /**
   * Handles the approval of a submitted inspection.
   * [PATCH /inspections/:id/approve]
   * Approves a submitted inspection. Requires Reviewer/Admin role (to be enforced later).
   * @param {string} id - The UUID of the inspection to approve.
   * @returns {Promise<InspectionResponseDto>} The approved inspection record summary.
   */
  @Patch(':id/approve')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.REVIEWER, Role.SUPERADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Approve a submitted inspection',
    description:
      'Approves a submitted inspection. Requires Reviewer/Admin role (to be enforced later).',
  })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'Inspection ID',
  })
  @ApiOkResponse({ description: 'The approved inspection record summary.', type: InspectionResponseDto })
  @ApiBadRequestResponse({ description: 'Bad Request (e.g., invalid state).', type: HttpErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Inspection not found.', type: HttpErrorResponseDto })
  @ApiAuthErrors()
  // @ApiBearerAuth('NamaSkemaKeamanan') // Add if JWT guard is enabled
  async approveInspection(
    @Param('id') id: string,
    @GetUser('id') reviewerId: string,
    @Req() req: Request, // Inject Request object
  ): Promise<InspectionResponseDto> {
    const authHeader = req.headers.authorization;
    const token = authHeader ? authHeader.split(' ')[1] : null; // Extract token

    const inspection = await this.inspectionsService.approveInspection(
      id,
      reviewerId,
      token, // Pass the token to the service
    );
    return new InspectionResponseDto(inspection);
  }

  /**
   * [POST /inspections/bulk-approve]
   * Bulk approve multiple inspections with enhanced error handling and rollback.
   * Processes inspections sequentially to avoid race conditions and resource exhaustion.
   * @param {BulkApproveInspectionDto} bulkApproveDto - Array of inspection IDs to approve.
   * @returns {Promise<BulkApproveInspectionResponseDto>} Results of bulk approval operation.
   */
  @Post('bulk-approve')
  @Throttle({ default: { limit: 5, ttl: 300000 } }) // More restrictive: 5 requests per 5 minutes
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.REVIEWER, Role.SUPERADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Bulk approve multiple inspections',
    description:
      'Approves multiple inspections in sequence with automatic rollback on failure. Maximum 20 inspections per request.',
  })
  @ApiBody({
    type: BulkApproveInspectionDto,
    description: 'Array of inspection IDs to approve',
  })
  @ApiOkResponse({ description: 'Bulk approval results with success/failure details.', type: BulkApproveInspectionResponseDto })
  @ApiBadRequestResponse({ description: 'Bad Request (e.g., invalid inspection IDs, too many requests).', type: HttpErrorResponseDto })
  @ApiAuthErrors()
  async bulkApproveInspections(
    @Body() bulkApproveDto: BulkApproveInspectionDto,
    @GetUser('id') reviewerId: string,
    @Req() req: Request,
  ): Promise<BulkApproveInspectionResponseDto> {
    const authHeader = req.headers.authorization;
    const token = authHeader ? authHeader.split(' ')[1] : null;

    this.logger.log(
      `Bulk approve requested by ${reviewerId} for ${bulkApproveDto.inspectionIds.length} inspections`,
    );

    const result = await this.inspectionsService.bulkApproveInspections(
      bulkApproveDto.inspectionIds,
      reviewerId,
      token,
    );

    // Log summary for monitoring
    this.logger.log(
      `Bulk approve completed: ${result.summary.successful}/${result.summary.total} successful`,
    );

    return result;
  }

  /**
   * [Old minting method]
   * Initiates the archiving process for an approved inspection.
   * [PUT /inspections/:id/archive]
   * Initiates the archiving process for an approved inspection by fetching a URL and converting it to PDF.
   * Expects a JSON body with a 'url' field.
   * Uses PUT as it replaces/sets the archive-related data.
   * @param {string} id - The UUID of the inspection to archive.
   * @returns {Promise<InspectionResponseDto>} The archived inspection record summary.
   */
  @Put(':id/archive')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.REVIEWER, Role.SUPERADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Archive an approved inspection by providing a URL to convert to PDF',
    description:
      'Fetches the content from the provided URL, converts it to PDF, and proceeds with the archiving process (saving, hashing, minting).',
  })
  @ApiConsumes('application/json') // Expects JSON body
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'Inspection ID',
  })
  @ApiOkResponse({ description: 'Inspection archived successfully.', type: InspectionResponseDto })
  @ApiBadRequestResponse({ description: 'Bad Request (e.g., invalid URL, inspection not approved).', type: HttpErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Inspection not found.', type: HttpErrorResponseDto })
  @ApiAuthErrors()
  async processToArchive(
    @Param('id') id: string,
    @GetUser('id') userId: string,
  ): Promise<InspectionResponseDto> {
    // Service will handle fetching URL, converting to PDF, saving PDF, hash, blockchain sim, update status
    const inspection = await this.inspectionsService.processToArchive(
      id,
      userId,
    );
    return new InspectionResponseDto(inspection);
  }

  /**
   * Builds an unsigned transaction for archiving an inspection.
   * This transaction is intended to be signed by the frontend wallet.
   *
   * @param id The ID of the inspection to archive.
   * @param buildMintRequestDto DTO containing the admin's wallet address.
   * @returns A promise that resolves to the unsigned transaction details.
   * @throws BadRequestException if adminAddress is not provided in the request body.
   */
  @Post(':id/build-archive-tx')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @UseGuards(ThrottlerGuard)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.REVIEWER, Role.SUPERADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Step 1 - Build Unsigned Archive Transaction' })
  @ApiBody({ type: BuildMintRequestDto })
  @ApiCreatedResponse({ description: 'The unsigned transaction details for archiving.', type: BuildMintTxResponseDto })
  @ApiBadRequestResponse({ description: 'Bad Request (e.g., invalid input data, missing adminAddress).', type: HttpErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Inspection not found.', type: HttpErrorResponseDto })
  @ApiAuthErrors()
  async buildArchiveTransaction(
    @Param('id') id: string,
    @Body() buildMintRequestDto: BuildMintRequestDto,
  ): Promise<BuildMintTxResponseDto> {
    if (!buildMintRequestDto.adminAddress) {
      throw new BadRequestException(
        'adminAddress is required in the request body.',
      );
    }
    return this.inspectionsService.buildArchiveTransaction(
      id,
      buildMintRequestDto.adminAddress,
    );
  }

  /**
   * Confirms the archiving process after the transaction is successfully sent from the frontend.
   * Saves the transaction hash and NFT asset ID.
   *
   * @param id The ID of the inspection being archived.
   * @param confirmDto DTO containing the transaction hash and NFT asset ID.
   * @returns A promise that resolves to the updated inspection record summary.
   */
  @Post(':id/confirm-archive')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.REVIEWER, Role.SUPERADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Step 2 - Confirm and Save Minting Results' })
  @ApiOkResponse({ description: 'Updated inspection after confirming archive.', type: InspectionResponseDto })
  @ApiBadRequestResponse({ description: 'Bad Request (e.g., invalid input data).', type: HttpErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Inspection not found.', type: HttpErrorResponseDto })
  @ApiAuthErrors()
  async confirmArchive(
    @Param('id') id: string,
    @Body() confirmDto: ConfirmMintDto,
  ): Promise<InspectionResponseDto> {
    const inspection = await this.inspectionsService.confirmArchive(
      id,
      confirmDto,
    );
    return new InspectionResponseDto(inspection);
  }

  /**
   * Handles the deactivation of an archived inspection.
   * [PATCH /inspections/:id/deactivate]
   * Deactivates an archived inspection. Requires Admin role.
   * @param {string} id - The UUID of the inspection to deactivate.
   * @returns {Promise<InspectionResponseDto>} The deactivated inspection record summary.
   */
  @Patch(':id/deactivate')
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.REVIEWER, Role.SUPERADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Deactivate an archived inspection',
    description: 'Deactivates an archived inspection. Requires Admin role.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'Inspection ID',
  })
  @ApiOkResponse({ description: 'The deactivated inspection record summary.', type: InspectionResponseDto })
  @ApiBadRequestResponse({ description: 'Bad Request (e.g., invalid state).', type: HttpErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Inspection not found.', type: HttpErrorResponseDto })
  @ApiAuthErrors()
  // @ApiBearerAuth('NamaSkemaKeamanan') // Add if JWT guard is enabled
  async deactivateArchive(
    @Param('id') id: string,
    @GetUser('id') userId: string,
  ): Promise<InspectionResponseDto> {
    const inspection = await this.inspectionsService.deactivateArchive(
      id,
      userId,
    );
    return new InspectionResponseDto(inspection);
  }

  /**
   * Handles the reactivation of a deactivated inspection.
   * [PATCH /inspections/:id/activate]
   * Reactivates a deactivated inspection. Requires Admin role.
   * @param {string} id - The UUID of the inspection to reactivate.
   * @returns {Promise<InspectionResponseDto>} The activated inspection record summary.
   */
  @Patch(':id/activate')
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.REVIEWER, Role.SUPERADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Activate a deactivated inspection',
    description: 'Reactivates a deactivated inspection. Requires Admin role.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'Inspection ID',
  })
  @ApiOkResponse({ description: 'The activated inspection record summary.', type: InspectionResponseDto })
  @ApiBadRequestResponse({ description: 'Bad Request (e.g., invalid state).', type: HttpErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Inspection not found.', type: HttpErrorResponseDto })
  @ApiAuthErrors()
  // @ApiBearerAuth('NamaSkemaKeamanan') // Add if JWT guard is enabled
  async activateArchive(
    @Param('id') id: string,
    @GetUser('id') userId: string,
  ): Promise<InspectionResponseDto> {
    const inspection = await this.inspectionsService.activateArchive(
      id,
      userId,
    );
    return new InspectionResponseDto(inspection);
  }

  /**
   * Handles the permanent deletion of an inspection and all associated data.
   * [DELETE /inspections/:id/permanently]
   * This is a destructive action and can only be performed by a SUPERADMIN.
   * It deletes the inspection record, all related photo records, and all associated files (images and PDFs) from the disk.
   * @param {string} id - The UUID of the inspection to delete permanently.
   * @returns {Promise<void>} A promise that resolves when the deletion is complete.
   */
  @Delete(':id/permanently')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Permanently delete an inspection (Superadmin Only)',
    description:
      'Deletes an inspection, its photos, its change logs, and all associated files from the disk. This action is irreversible.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'The UUID of the inspection to delete permanently.',
  })
  @ApiNoContentResponse({ description: 'Inspection deleted successfully.' })
  @ApiNotFoundResponse({ description: 'Inspection not found.', type: HttpErrorResponseDto })
  @ApiAuthErrors()
  async deleteInspectionPermanently(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    this.logger.warn(
      `[SUPERADMIN] Received request to permanently delete inspection ${id}`,
    );
    await this.inspectionsService.deleteInspectionPermanently(id);
  }

  /**
   * Reverts the status of an inspection back to NEED_REVIEW.
   * [PATCH /inspections/:id/revert-to-review]
   * This endpoint allows SUPERADMIN users to rollback any inspection to NEED_REVIEW status,
   * regardless of its current status. This is useful when an inspection needs to be re-reviewed
   * due to errors, changes in requirements, or administrative decisions.
   * @param {string} id - The UUID of the inspection to rollback.
   * @param {string} userId - The ID of the SUPERADMIN user performing the action.
   * @returns {Promise<InspectionResponseDto>} The updated inspection with NEED_REVIEW status.
   */
  @Patch(':id/revert-to-review')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Revert inspection status to NEED_REVIEW (Superadmin Only)',
    description:
      'Reverts any inspection status back to NEED_REVIEW, allowing it to be reviewed again. This action creates a change log entry and can only be performed by SUPERADMIN users.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'The UUID of the inspection to revert status.',
  })
  @ApiNoContentResponse({ description: 'Inspection status reverted to NEED_REVIEW.' })
  @ApiBadRequestResponse({ description: 'Bad Request (e.g., already in NEED_REVIEW).', type: HttpErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Inspection not found.', type: HttpErrorResponseDto })
  @ApiAuthErrors()
  async revertInspectionToReview(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser('id') userId: string,
  ): Promise<void> {
    this.logger.log(
      `[SUPERADMIN] Received request to revert inspection ${id} status to NEED_REVIEW by user ${userId}`,
    );
    await this.inspectionsService.rollbackInspectionStatus(id, userId);
    // Return 204 No Content to save bandwidth — client can fetch updated inspection separately if needed
    return;
  }

  /**
   * Reverts the status of an inspection back to APPROVED if the current status
   * is ARCHIVED or FAIL_ARCHIVE.
   * [PATCH /inspections/:id/revert-to-approved]
   * This endpoint allows SUPERADMIN users to rollback an inspection back to APPROVED,
   * typically used when an archive/minting result needs to be undone for administrative reasons.
   */
  @Patch(':id/revert-to-approved')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Revert inspection status to APPROVED (Superadmin Only)',
    description:
      'Reverts an inspection from ARCHIVED or FAIL_ARCHIVE back to APPROVED. This action creates a change log entry and can only be performed by SUPERADMIN users.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'The UUID of the inspection to revert status.',
  })
  @ApiNoContentResponse({ description: 'Inspection status reverted to APPROVED.' })
  @ApiBadRequestResponse({ description: 'Bad Request (e.g., not in ARCHIVED/FAIL_ARCHIVE).', type: HttpErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Inspection not found.', type: HttpErrorResponseDto })
  @ApiAuthErrors()
  async revertInspectionToApproved(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser('id') userId: string,
  ): Promise<void> {
    this.logger.log(
      `[SUPERADMIN] Received request to revert inspection ${id} status to APPROVED by user ${userId}`,
    );
    await this.inspectionsService.revertInspectionToApproved(id, userId);
    // Return 204 No Content to save bandwidth — client can fetch updated inspection separately if needed
    return;
  }

  /**
   * Get current queue statistics for monitoring purposes.
   * This endpoint provides insights into the current status of PDF generation
   * and blockchain minting queues to help with debugging UTXO issues.
   */
  @Get('queue-stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get Queue Statistics (SuperAdmin Only)',
    description:
      'Retrieves current statistics for PDF generation and blockchain minting queues. Useful for monitoring and debugging purposes.',
  })
  @ApiOkResponse({
    description: 'Queue statistics retrieved successfully.',
    schema: {
      type: 'object',
      properties: {
        pdfQueue: {
          type: 'object',
          properties: {
            queueLength: { type: 'number' },
            running: { type: 'number' },
            totalProcessed: { type: 'number' },
            totalErrors: { type: 'number' },
            consecutiveErrors: { type: 'number' },
            circuitBreakerOpen: { type: 'boolean' },
          },
        },
        blockchainQueue: {
          type: 'object',
          properties: {
            queueLength: { type: 'number' },
            running: { type: 'number' },
            totalProcessed: { type: 'number' },
            totalErrors: { type: 'number' },
            consecutiveErrors: { type: 'number' },
            circuitBreakerOpen: { type: 'boolean' },
          },
        },
      },
    },
  })
  @ApiAuthErrors()
  getQueueStats() {
    this.logger.log('Received request for queue statistics');
    return this.inspectionsService.getQueueStats();
  }
} // End Controller
