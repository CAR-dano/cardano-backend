/**
 * @fileoverview Controller responsible for handling HTTP requests related to inspections.
 * Provides endpoints for creating inspection data, adding photos (single or batch per type),
 * retrieving all/single inspections, updating photos, deleting photos,
 * and managing inspection status lifecycle (approve, reject, archive, deactivate, activate).
 * Authentication/Authorization guards are commented out for initial development/testing.
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
   * Injects required services via NestJS Dependency Injection.
   * @param {InspectionsService} inspectionsService - Service for core inspection logic.
   * @param {PhotosService} photosService - Service specifically for handling photo operations.
   */
  constructor(
    private readonly inspectionsService: InspectionsService,
    private readonly photosService: PhotosService,
  ) {}

  /**
   * [POST /inspections]
   * Creates the initial inspection record containing text and JSON data.
   * This is the first step before uploading photos or archiving.
   * Expects 'application/json' content type.
   * @param {CreateInspectionDto} createInspectionDto - DTO containing the initial inspection data.
   * @returns {Promise<InspectionResponseDto>} The newly created inspection record summary.
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
   * [PATCH /inspections/:id]
   * Partially updates the text/JSON data fields of an existing inspection.
   * Does not handle photo updates. Expects 'application/json'.
   * @param {string} id - The UUID of the inspection to update.
   * @param {UpdateInspectionDto} updateInspectionDto - DTO containing the fields to update.
   * @returns {Promise<InspectionResponseDto>} The updated inspection record summary.
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
   * [POST /inspections/:id/photos/fixed-batch]
   * Uploads a batch of FIXED type photos (with predefined labels) for an inspection.
   * Expects 'multipart/form-data' with 'metadata' (JSON string array) and 'photos' (files).
   * @param {string} id - Inspection UUID.
   * @param {AddBatchFixedPhotosDto} addBatchDto - DTO containing the 'metadata' JSON string.
   * @param {Express.Multer.File[]} files - Array of uploaded image files from the 'photos' field.
   * @returns {Promise<PhotoResponseDto[]>} Array of created photo record summaries.
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
    // Renamed method
    @Param('id') id: string,
    @Body() addBatchDto: AddMultiplePhotosDto, // Updated DTO
    @UploadedFiles() files: Array<Express.Multer.File>,
    // @GetUser('id') userId: string,
  ): Promise<PhotoResponseDto[]> {
    this.logger.log(
      `[POST /inspections/${id}/photos/multiple] Received ${files?.length} files.`, // Updated log
    );
    if (!files || files.length === 0)
      throw new BadRequestException('No photo files provided.');
    const dummyUserId = DUMMY_USER_ID;
    const newPhotos = await this.photosService.addMultiplePhotos(
      // Updated service method
      id,
      files,
      addBatchDto.metadata,
      dummyUserId,
    );
    return newPhotos.map((p) => new PhotoResponseDto(p));
  }

  /**
   * [POST /inspections/:id/photos/single]
   * Uploads a single photo for an inspection.
   * Expects 'multipart/form-data' with 'label' (string) and optionally 'needAttention' (string "true" or "false") and 'photo' (file).
   * @param {string} id - Inspection UUID.
   * @param {AddSinglePhotoDto} addSingleDto - DTO containing the label and optional needAttention flag.
   * @param {Express.Multer.File} file - The uploaded image file from the 'photo' field.
   * @returns {Promise<PhotoResponseDto>} The created photo record summary.
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

    let parsedMetadata;
    try {
      parsedMetadata = JSON.parse(addSingleDto.metadata);
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
   * [GET /inspections/:id/photos]
   * Retrieves all photo records associated with a specific inspection.
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
   * [PUT /inspections/:id/photos/:photoId]
   * Updates a specific photo's metadata and/or replaces its file.
   * Expects 'multipart/form-data'. File and metadata fields are optional.
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

    // Panggil service update
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const updatedPhoto = await this.photosService.updatePhoto(
      inspectionId,
      photoId,
      updatePhotoDto,
      fileToPass /*, userId*/,
    );
    return new PhotoResponseDto(updatedPhoto);
  }

  /**
   * [DELETE /inspections/:id/photos/:photoId]
   * Deletes a specific photo record and its associated file (if stored locally).
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
   * [GET /inspections]
   * Retrieves all inspection records with pagination and metadata.
   * Filters results based on the requesting user's role (passed via query).
   */
  @Get()
  // @UseGuards(JwtAuthGuard) // Add later if needed
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
  // @ApiBearerAuth('NamaSkemaKeamanan') // Add if JWT guard is enabled
  async findAll(
    @Query('role') userRole?: Role,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 10,
    /* @GetUser('role') realUserRole: Role */
  ): Promise<{
    data: InspectionResponseDto[];
    meta: { total: number; page: number; pageSize: number; totalPages: number };
  }> {
    const roleToFilter = userRole || Role.ADMIN; // Temporary filter logic
    const pageNumber =
      parseInt(page as any, 10) > 0 ? parseInt(page as any, 10) : 1;
    const pageSizeNumber =
      parseInt(pageSize as any, 10) > 0 ? parseInt(pageSize as any, 10) : 10;
    this.logger.warn(
      `[GET /inspections] Applying filter for DUMMY role: ${roleToFilter}, page: ${page}, pageSize: ${pageSize}`,
    );
    const result = await this.inspectionsService.findAll(
      roleToFilter,
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
   * [GET /inspections/:id]
   * Retrieves a specific inspection by ID, applying role-based visibility rules.
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
   * [PATCH /inspections/:id/approve]
   * Approves a submitted inspection. Requires Reviewer/Admin role (to be enforced later).
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
   * Initiates the archiving process for an approved inspection by fetching a URL and converting it to PDF.
   * Expects a JSON body with a 'url' field.
   * Uses PUT as it replaces/sets the archive-related data.
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
    // --- Dummy User ID (yg melakukan aksi) ---
    const dummyUserId = DUMMY_USER_ID;
    this.logger.warn(`Using DUMMY user ID for archive action: ${dummyUserId}`);
    // --------------------------------------
    // Service will handle fetching URL, converting to PDF, saving PDF, hash, blockchain sim, update status
    const inspection = await this.inspectionsService.processToArchive(
      id,
      dummyUserId,
    );
    return new InspectionResponseDto(inspection);
  }

  /**
   * [PATCH /inspections/:id/deactivate]
   * Deactivates an archived inspection. Requires Admin role.
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
    // --------------------
    const inspection = await this.inspectionsService.deactivateArchive(
      id,
      dummyUserId,
    );
    return new InspectionResponseDto(inspection);
  }

  /**
   * [PATCH /inspections/:id/activate]
   * Reactivates a deactivated inspection. Requires Admin role.
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
    // --------------------
    const inspection = await this.inspectionsService.activateArchive(
      id,
      dummyUserId,
    );
    return new InspectionResponseDto(inspection);
  }
} // End Controller
