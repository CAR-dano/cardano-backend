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
} from '@nestjs/common';
import { InspectionsService } from './inspections.service';
import { CreateInspectionDto } from './dto/create-inspection.dto';
import { UpdateInspectionDto } from './dto/update-inspection.dto';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express'; // NestJS interceptor for handling multiple file fields
import { diskStorage } from 'multer'; // Storage engine for Multer (file uploads)
import { extname } from 'path'; // Node.js utility for handling file extensions
import { Role } from '@prisma/client';
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
} from '@nestjs/swagger';
import { AddMultiplePhotosDto } from 'src/photos/dto/add-multiple-photos.dto';
import { AddSinglePhotoDto } from 'src/inspections/dto/add-single-photo.dto';
import { Request } from 'express';
// Import Guards if/when needed for authentication and authorization
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
// import { RolesGuard } from '../auth/guards/roles.guard';
// import { Roles } from '../auth/decorators/roles.decorator';
// import { GetUser } from '../auth/decorators/get-user.decorator';
// import { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface'; // Define or import this

// --- Multer Configuration ---
const MAX_PHOTOS_PER_REQUEST = 10; // Max files per batch upload request
const UPLOAD_PATH = './uploads/inspection-photos';
const DUMMY_USER_ID = '9f7f3423-0926-4593-a0ec-23206028ced0'; // Temporary placeholder for user ID

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
 * Multer file filter to allow only common image file types.
 */
const imageFileFilter = (
  req: Request,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
) => {
  // Check the file's mimetype against allowed image types
  if (!file.mimetype.match(/^image\/(jpg|jpeg|png|gif)$/)) {
    return callback(
      new BadRequestException(
        'Only image files (jpg, jpeg, png, gif) are allowed!',
      ),
      false,
    );
  }
  callback(null, true);
};

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
   * @param createInspectionDto DTO containing the initial inspection data.
   * @returns A promise that resolves to the newly created inspection record summary.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  // @UseGuards(JwtAuthGuard, RolesGuard) // Apply guards later
  // @Roles(Role.ADMIN, Role.REVIEWER, Role.INSPECTOR) // Define allowed roles later
  @ApiOperation({
    summary: 'Create a new inspection record',
    description:
      'Creates the initial inspection record containing text and JSON data. This is the first step before uploading photos or archiving.',
  })
  @ApiBody({ type: CreateInspectionDto })
  @ApiResponse({
    status: 201,
    description: 'The newly created inspection record summary.',
    type: InspectionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request (e.g., invalid input data).',
  })
  // @ApiBearerAuth('NamaSkemaKeamanan') // Add if JWT guard is enabled
  async create(
    @Body() createInspectionDto: CreateInspectionDto,
    // @GetUser('id') userId: string, // Get authenticated user ID later
  ): Promise<InspectionResponseDto> {
    const newInspection =
      await this.inspectionsService.create(createInspectionDto);
    return new InspectionResponseDto(newInspection);
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
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(Role.ADMIN, Role.REVIEWER, Role.INSPECTOR) // Adjust roles as needed
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
    description: 'The updated inspection record summary.',
    type: InspectionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request (e.g., invalid input data, invalid ID format).',
  })
  @ApiResponse({ status: 404, description: 'Inspection not found.' })
  // @ApiBearerAuth('NamaSkemaKeamanan') // Add if JWT guard is enabled
  async update(
    @Param('id') id: string,
    @Body() updateInspectionDto: UpdateInspectionDto,
    // @GetUser('id') userId: string, // Get authenticated user ID later
    // @GetUser('role') userRole: Role // Get role later
  ): Promise<InspectionResponseDto> {
    const dummyUserId = DUMMY_USER_ID; // Temporary
    const dummyUserRole = Role.ADMIN; // Temporary
    this.logger.warn(
      `Using DUMMY user context for PATCH /inspections/${id}: User=${dummyUserId}, Role=${dummyUserRole}`,
    );
    const updatedInspection = await this.inspectionsService.update(
      id,
      updateInspectionDto,
      dummyUserId,
      dummyUserRole,
    );
    return new InspectionResponseDto(updatedInspection);
  }

  // --- Photo Batch Upload Endpoints ---

  /**
   * Handles the upload of multiple photos for an inspection.
   * [POST /inspections/:id/photos/multiple]
   * Uploads a batch of photos for an inspection.
   * Expects 'multipart/form-data' with 'metadata' (JSON string array) and 'photos' (files).
   * @param id Inspection UUID.
   * @param addBatchDto DTO containing the 'metadata' JSON string.
   * @param files Array of uploaded image files from the 'photos' field.
   * @returns A promise that resolves to an array of created photo record summaries.
   */
  @Post(':id/photos/multiple') // Renamed endpoint
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FilesInterceptor('photos', MAX_PHOTOS_PER_REQUEST, {
      storage: photoStorageConfig,
      fileFilter: imageFileFilter,
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
    @UploadedFiles() files: Array<Express.Multer.File>,
    // @GetUser('id') userId: string,
  ): Promise<PhotoResponseDto[]> {
    this.logger.log(
      `[POST /inspections/${id}/photos/multiple] Received ${files?.length} files.`,
    );
    if (!files || files.length === 0)
      throw new BadRequestException('No photo files provided.');
    const dummyUserId = DUMMY_USER_ID;
    const newPhotos = await this.photosService.addMultiplePhotos(
      id,
      files,
      addBatchDto.metadata,
      dummyUserId,
    );
    return newPhotos.map((p) => new PhotoResponseDto(p));
  }

  /**
   * Interface for the parsed metadata of a single photo.
   */
  interface SinglePhotoMetadata {
    label: string;
    needAttention?: boolean;
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
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: photoStorageConfig,
      fileFilter: imageFileFilter,
    }),
  ) // Handle single file upload
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(Role.ADMIN, Role.REVIEWER, Role.INSPECTOR)
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
    @UploadedFile() file: Express.Multer.File,
    // @GetUser('id') userId: string,
  ): Promise<PhotoResponseDto> {
    this.logger.log(
      `[POST /inspections/${id}/photos/single] Received file: ${file?.filename}`,
    );
    if (!file) throw new BadRequestException('No photo file provided.');

    let parsedMetadata: SinglePhotoMetadata;
    try {
      parsedMetadata = JSON.parse(addSingleDto.metadata) as SinglePhotoMetadata;
      if (
        !parsedMetadata ||
        typeof parsedMetadata.label !== 'string' ||
        (parsedMetadata.needAttention !== undefined &&
          typeof parsedMetadata.needAttention !== 'boolean')
      ) {
        throw new BadRequestException('Invalid metadata format.');
      }
    } catch (error: any) {
      throw new BadRequestException(
        `Invalid metadata format: ${error.message}`,
      );
    }

    const dummyUserId = DUMMY_USER_ID;
    const newPhoto = await this.photosService.addPhoto(
      id,
      file,
      parsedMetadata, // Pass parsed metadata
      dummyUserId,
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
  // @UseGuards(JwtAuthGuard) // Add later if needed
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
      fileFilter: imageFileFilter,
    }),
  ) // Handle single optional file
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(Role.ADMIN, Role.REVIEWER, Role.INSPECTOR) // Define who can update
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
  // @ApiBearerAuth('NamaSkemaKeamanan') // Add if JWT guard is enabled
  async updatePhoto(
    @Param('id') inspectionId: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
    @Body() updatePhotoDto: UpdatePhotoDto, // Contains optional label/needAttention
    @UploadedFile() newFile?: Express.Multer.File, // Optional new file
    // @GetUser('id') userId: string,
  ): Promise<PhotoResponseDto> {
    const dummyUserId = DUMMY_USER_ID;
    this.logger.log(
      `[PUT /inspections/${inspectionId}/photos/${photoId}] Request received by user ${dummyUserId}`,
    );
    this.logger.debug('Update DTO:', updatePhotoDto);
    this.logger.debug('New file:', newFile?.filename);

    // Add a check to ensure newFile is a valid file object before passing to service
    // This helps mitigate potential ESLint "unsafe assignment" warnings related to Multer errors
    const fileToPass = newFile && 'filename' in newFile ? newFile : undefined;

    const updatedPhoto = await this.photosService.updatePhoto(
      inspectionId,
      photoId,
      updatePhotoDto,
      fileToPass /*, userId*/,
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
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(Role.ADMIN, Role.REVIEWER, Role.INSPECTOR) // Define who can delete
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
  // @ApiBearerAuth('NamaSkemaKeamanan') // Add if JWT guard is enabled
  async deletePhoto(
    @Param('id', ParseUUIDPipe) inspectionId: string, // Included for path consistency, might not be needed by service
    @Param('photoId', ParseUUIDPipe) photoId: string,
    // @GetUser('id') userId: string,
  ): Promise<void> {
    const dummyUserId = DUMMY_USER_ID;
    this.logger.log(
      `[DELETE /inspections/${inspectionId}/photos/${photoId}] Request received by user ${dummyUserId}`,
    );
    await this.photosService.deletePhoto(photoId, dummyUserId);
    // No return body for 204
  }

  // --- Inspection Retrieval Endpoints ---

  /**
   * Handles the retrieval of all inspection records.
   * [GET /inspections]
   * Retrieves all inspection records, potentially filtered by role (passed via query).
   * @param userRole Optional role to filter inspections by.
   * @returns A promise that resolves to an array of inspection record summaries.
   */
  @Get()
  // @UseGuards(JwtAuthGuard) // Add later if needed
  @ApiOperation({
    summary: 'Retrieve all inspection records',
    description:
      'Retrieves all inspection records, potentially filtered by role (passed via query parameter).',
  })
  @ApiQuery({
    name: 'role',
    required: false,
    enum: Role,
    description: 'Filter inspections by user role.',
  })
  @ApiResponse({
    status: 200,
    description: 'Array of inspection record summaries.',
    type: [InspectionResponseDto],
  })
  // @ApiBearerAuth('NamaSkemaKeamanan') // Add if JWT guard is enabled
  async findAll(
    @Query('role') userRole?: Role /*, @GetUser('role') realUserRole: Role */,
  ): Promise<InspectionResponseDto[]> {
    const roleToFilter = userRole || Role.ADMIN; // Temporary filter logic
    this.logger.warn(
      `[GET /inspections] Applying filter for DUMMY role: ${roleToFilter}`,
    );
    const inspections = await this.inspectionsService.findAll(roleToFilter);
    return inspections.map(
      (inspection) => new InspectionResponseDto(inspection),
    );
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
  // @UseGuards(JwtAuthGuard) // Add later if needed
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
  // @ApiBearerAuth('NamaSkemaKeamanan') // Add if JWT guard is enabled
  async findOne(
    @Param('id') id: string,
    @Query('role') userRole?: Role, // Temporary filter logic
    // @GetUser('role') realUserRole: Role // Get role later
  ): Promise<InspectionResponseDto> {
    const roleToFilter = userRole || Role.ADMIN; // Temporary filter logic
    this.logger.warn(
      `[GET /inspections/${id}] Applying filter for DUMMY role: ${roleToFilter}`,
    );
    const inspection = await this.inspectionsService.findOne(id, roleToFilter);
    return new InspectionResponseDto(inspection);
  }

  // --- Status Management Endpoints ---

  /**
   * Handles the approval of a submitted inspection.
   * [PATCH /inspections/:id/approve]
   * Approves a submitted inspection. Requires Reviewer/Admin role (to be enforced later).
   * @param id Inspection ID.
   * @returns A promise that resolves to the approved inspection record summary.
   */
  @Patch(':id/approve')
  @HttpCode(HttpStatus.OK)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(Role.ADMIN, Role.REVIEWER)
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
  // @ApiBearerAuth('NamaSkemaKeamanan') // Add if JWT guard is enabled
  async approveInspection(
    @Param('id') id: string,
    // @GetUser('id') reviewerId: string,
  ): Promise<InspectionResponseDto> {
    const dummyReviewerId = DUMMY_USER_ID; // Temporary
    this.logger.warn(
      `Using DUMMY reviewer ID: ${dummyReviewerId} for PATCH /approve`,
    );
    const inspection = await this.inspectionsService.approveInspection(
      id,
      dummyReviewerId,
    );
    return new InspectionResponseDto(inspection);
  }

  /**
   * Initiates the archiving process for an approved inspection.
   * [PUT /inspections/:id/archive]
   * Initiates the archiving process for an approved inspection by fetching a URL and converting it to PDF.
   * Expects a JSON body with a 'url' field.
   * Uses PUT as it replaces/sets the archive-related data.
   * @param id Inspection ID.
   * @returns A promise that resolves to the archived inspection record summary.
   */
  @Put(':id/archive')
  @HttpCode(HttpStatus.OK)
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
  @ApiResponse({ status: 404, description: 'Inspection not found.' })
  // @UseGuards(JwtAuthGuard, RolesGuard) // Add guards later
  // @Roles(Role.ADMIN, Role.REVIEWER)    // Define allowed roles later
  async processToArchive(
    @Param('id') id: string,
    // @GetUser('id') userId: string,
  ): Promise<InspectionResponseDto> {
    const dummyUserId = DUMMY_USER_ID;
    this.logger.warn(`Using DUMMY user ID for archive action: ${dummyUserId}`);
    // Service will handle fetching URL, converting to PDF, saving PDF, hash, blockchain sim, update status
    const inspection = await this.inspectionsService.processToArchive(
      id,
      dummyUserId,
    );
    return new InspectionResponseDto(inspection);
  }

  /**
   * Handles the deactivation of an archived inspection.
   * [PATCH /inspections/:id/deactivate]
   * Deactivates an archived inspection. Requires Admin role.
   * @param id Inspection ID.
   * @returns A promise that resolves to the deactivated inspection record summary.
   */
  @Patch(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(Role.ADMIN)
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
  // @ApiBearerAuth('NamaSkemaKeamanan') // Add if JWT guard is enabled
  async deactivateArchive(
    @Param('id') id: string,
    // @GetUser('id') userId: string,
  ): Promise<InspectionResponseDto> {
    const dummyUserId = DUMMY_USER_ID; // Temporary
    this.logger.warn(
      `Using DUMMY user ID for deactivate action: ${dummyUserId}`,
    );
    const inspection = await this.inspectionsService.deactivateArchive(
      id,
      dummyUserId,
    );
    return new InspectionResponseDto(inspection);
  }

  /**
   * Handles the reactivation of a deactivated inspection.
   * [PATCH /inspections/:id/activate]
   * Reactivates a deactivated inspection. Requires Admin role.
   * @param id Inspection ID.
   * @returns A promise that resolves to the activated inspection record summary.
   */
  @Patch(':id/activate')
  @HttpCode(HttpStatus.OK)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(Role.ADMIN)
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
  // @ApiBearerAuth('NamaSkemaKeamanan') // Add if JWT guard is enabled
  async activateArchive(
    @Param('id') id: string,
    // @GetUser('id') userId: string,
  ): Promise<InspectionResponseDto> {
    const dummyUserId = DUMMY_USER_ID; // Temporary
    this.logger.warn(`Using DUMMY user ID for activate action: ${dummyUserId}`);
    const inspection = await this.inspectionsService.activateArchive(
      id,
      dummyUserId,
    );
    return new InspectionResponseDto(inspection);
  }
} // End Controller
