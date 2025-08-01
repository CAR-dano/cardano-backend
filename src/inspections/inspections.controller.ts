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
} from '@nestjs/common';
import { InspectionsService } from './inspections.service';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { CreateInspectionDto } from './dto/create-inspection.dto';
import { UpdateInspectionDto } from './dto/update-inspection.dto';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express'; // NestJS interceptor for handling multiple file fields
import { diskStorage } from 'multer'; // Storage engine for Multer (file uploads)
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
const photoStorageConfig = diskStorage({
  destination: UPLOAD_PATH,
  filename: (req, file, callback) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const extension = extname(file.originalname);
    const safeOriginalName = file.originalname
      .split('.')[0]
      .replace(/[^a-z0-9]/gi, '-')
      .toLowerCase();
    callback(null, `${safeOriginalName}-${uniqueSuffix}${extension}`);
  },
});

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
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a new inspection record (Inspector only)',
    description:
      'Creates the initial inspection record containing text and JSON data. This is the first step before uploading photos or archiving. Only accessible by users with the INSPECTOR role.',
  })
  @ApiBody({ type: CreateInspectionDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'The newly created inspection record summary.',
    type: InspectionResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Bad Request (e.g., invalid input data).',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized. User is not authenticated.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden. User does not have the INSPECTOR role.',
  })
  async create(
    @Body() createInspectionDto: CreateInspectionDto,
    @GetUser('id') inspectorId: string,
  ): Promise<{ id: string }> {
    const newInspection = await this.inspectionsService.create(
      createInspectionDto,
      inspectorId,
    );
    return newInspection;
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
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.REVIEWER)
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
  @ApiResponse({
    status: 200,
    description: 'Message indicating changes have been logged.',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request (e.g., invalid input data).',
  })
  @ApiResponse({ status: 404, description: 'Inspection not found.' })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User is not authenticated.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have the required permissions.',
  })
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
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.INSPECTOR)
  @UseInterceptors(
    FilesInterceptor('photos', MAX_PHOTOS_PER_REQUEST, {
      storage: photoStorageConfig,
    }),
  )
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(Role.ADMIN, Role.REVIEWER, Role.INSPECTOR)
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
  @ApiResponse({
    status: 201,
    description: 'Array of created photo record summaries.',
    type: [PhotoResponseDto],
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad Request (e.g., invalid input, no files provided, invalid file type).',
  })
  @ApiResponse({ status: 404, description: 'Inspection not found.' })
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
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.INSPECTOR)
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
  @ApiResponse({
    status: 201,
    description: 'The created photo record summary.',
    type: PhotoResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad Request (e.g., invalid input, no file provided, invalid file type).',
  })
  @ApiResponse({ status: 404, description: 'Inspection not found.' })
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.REVIEWER)
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
  @ApiResponse({
    status: 200,
    description: 'Array of photo record summaries.',
    type: [PhotoResponseDto],
  })
  @ApiResponse({ status: 404, description: 'Inspection not found.' })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User is not authenticated.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have the required permissions.',
  })
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
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: photoStorageConfig,
    }),
  ) // Handle single optional file
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.REVIEWER)
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
  @ApiResponse({
    status: 200,
    description: 'The updated photo record summary.',
    type: PhotoResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request (e.g., invalid input, invalid file type).',
  })
  @ApiResponse({ status: 404, description: 'Inspection or Photo not found.' })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User is not authenticated.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have the required permissions.',
  })
  // @ApiBearerAuth('NamaSkemaKeamanan') // Add if JWT guard is enabled
  async updatePhoto(
    @Param('id') inspectionId: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
    @Body() updatePhotoDto: UpdatePhotoDto, // Contains optional label/needAttention
    @GetUser('id') userId: string,
    @UploadedFile(new FileValidationPipe()) newFile?: Express.Multer.File, // Optional new file
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
  @HttpCode(HttpStatus.NO_CONTENT) // Standard for successful DELETE with no body
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.REVIEWER)
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
  @ApiResponse({
    status: 204,
    description: 'Photo deleted successfully (No Content).',
  })
  @ApiResponse({ status: 404, description: 'Photo not found.' })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User is not authenticated.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have the required permissions.',
  })
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
  @ApiResponse({
    status: 200,
    description: 'The found inspection record summary.',
    type: InspectionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Inspection not found.' })
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
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.REVIEWER)
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
  @ApiResponse({
    status: 200,
    description:
      'A list of found inspection records. Returns an empty array if no matches are found.',
    type: [InspectionResponseDto], // Menandakan bahwa ini adalah array dari DTO
  })
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
  @Roles(Role.ADMIN, Role.REVIEWER)
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
  @ApiResponse({
    status: 200,
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
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User is not authenticated.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have the required permissions.',
  })
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
      `[GET /inspections] Applying filter for DUMMY role: ${userRole}, page: ${page}, pageSize: ${pageSize}, status: ${parsedStatus ? parsedStatus.join(',') : 'undefined'}`,
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.REVIEWER)
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
  @ApiResponse({
    status: 200,
    description: 'The inspection record summary.',
    type: InspectionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Inspection not found.' })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User is not authenticated.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have the required permissions.',
  })
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
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.REVIEWER)
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
  @ApiResponse({
    status: 200,
    description: 'The approved inspection record summary.',
    type: InspectionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad Request (e.g., inspection not in a state to be approved).',
  })
  @ApiResponse({ status: 404, description: 'Inspection not found.' })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User is not authenticated.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have the required permissions.',
  })
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
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.REVIEWER)
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
  @ApiResponse({
    status: 200,
    description: 'Inspection archived successfully.',
    type: InspectionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request (e.g., invalid URL, inspection not approved).',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User is not authenticated.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have the required permissions.',
  })
  @ApiResponse({ status: 404, description: 'Inspection not found.' })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User is not authenticated.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have the required permissions.',
  })
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.REVIEWER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Step 1 - Build Unsigned Archive Transaction' })
  @ApiBody({ type: BuildMintRequestDto })
  @ApiResponse({
    status: 201,
    description: 'The unsigned transaction details for archiving.',
    type: BuildMintTxResponseDto,
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
    status: HttpStatus.BAD_REQUEST,
    description:
      'Bad Request (e.g., invalid input data, missing adminAddress).',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Inspection not found.',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Internal Server Error.',
  })
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
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.REVIEWER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Step 2 - Confirm and Save Minting Results' })
  @ApiResponse({
    status: 200,
    description:
      'The updated inspection record summary after confirming archive.',
    type: InspectionResponseDto,
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
    status: HttpStatus.BAD_REQUEST,
    description: 'Bad Request (e.g., invalid input data).',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Inspection not found.',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Internal Server Error.',
  })
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
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.REVIEWER)
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
  @ApiResponse({
    status: 200,
    description: 'The deactivated inspection record summary.',
    type: InspectionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad Request (e.g., inspection not in a state to be deactivated).',
  })
  @ApiResponse({ status: 404, description: 'Inspection not found.' })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User is not authenticated.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have the required permissions.',
  })
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
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.REVIEWER)
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
  @ApiResponse({
    status: 200,
    description: 'The activated inspection record summary.',
    type: InspectionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad Request (e.g., inspection not in a state to be activated).',
  })
  @ApiResponse({ status: 404, description: 'Inspection not found.' })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User is not authenticated.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have the required permissions.',
  })
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
} // End Controller
