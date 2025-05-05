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
  NotFoundException,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { InspectionsService } from './inspections.service';
import { CreateInspectionDto } from './dto/create-inspection.dto';
import { UpdateInspectionDto } from './dto/update-inspection.dto';
import { InspectionResponseDto } from './dto/inspection-response.dto';
import {
  FileFieldsInterceptor,
  FileInterceptor,
  FilesInterceptor,
} from '@nestjs/platform-express'; // Import all relevant interceptors
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger'; // Keep for future use
import { diskStorage } from 'multer';
import { extname } from 'path';
import { Inspection, Role } from '@prisma/client'; // Import Role if used in @Roles later
import { PhotosService } from '../photos/photos.service'; // Import PhotosService
import { AddFixedPhotoDto } from '../photos/dto/add-fixed-photo.dto';
import { AddDynamicPhotoDto } from '../photos/dto/add-dynamic-photo.dto';
import { AddDocumentPhotoDto } from '../photos/dto/add-document-photo.dto';
import { UpdatePhotoDto } from '../photos/dto/update-photo.dto';
import { PhotoResponseDto } from '../photos/dto/photo-response.dto';
import { AddBatchDynamicPhotosDto } from '../photos/dto/add-batch-dynamic-photos.dto'; // Import Batch DTOs
import { AddBatchFixedPhotosDto } from '../photos/dto/add-batch-fixed-photos.dto';
import { AddBatchDocumentPhotosDto } from '../photos/dto/add-batch-document-photos.dto';
// --- Import Guards and Decorators for future use ---
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
// import { RolesGuard } from '../auth/guards/roles.guard';
// import { Roles } from '../auth/decorators/roles.decorator';
// import { GetUser } from '../auth/decorators/get-user.decorator';
// import { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface'; // Define or import this

// --- Multer Configuration ---
const MAX_PHOTOS_PER_REQUEST = 10; // Max files per batch upload request
const UPLOAD_PATH = './uploads/inspection-photos';
const PDF_ARCHIVE_PATH = './pdfarchived';

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
 * Multer disk storage configuration for uploaded PDF reports during archiving.
 * Saves files to PDF_ARCHIVE_PATH with temporary names initially.
 * The service might rename them later using the inspection ID.
 */
const pdfStorageConfig = diskStorage({
  destination: PDF_ARCHIVE_PATH,
  filename: (req, file, callback) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const extension = extname(file.originalname);
    callback(null, `temp-pdf-${uniqueSuffix}${extension}`); // Temporary name
  },
});

/**
 * Multer file filter to allow only common image file types.
 */
const imageFileFilter = (req, file, callback) => {
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
 * Multer file filter to allow only PDF files.
 */
const pdfFileFilter = (req, file, callback) => {
  if (file.mimetype !== 'application/pdf') {
    return callback(
      new BadRequestException('Only PDF files are allowed!'),
      false,
    );
  }
  callback(null, true);
};
// ---------------------------------

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
  // @ApiOperation(...) // Add Swagger details later
  // @ApiBody({ type: CreateInspectionDto })
  // @ApiResponse({ status: 201, type: InspectionResponseDto })
  async create(
    @Body() createInspectionDto: CreateInspectionDto,
    // @GetUser('id') userId: string, // Get authenticated user ID later
  ): Promise<InspectionResponseDto> {
    const dummySubmitterId = '00000000-0000-0000-0000-000000000000'; // Temporary placeholder
    this.logger.warn(
      `Using DUMMY submitter ID: ${dummySubmitterId} for POST /inspections`,
    );
    const newInspection = await this.inspectionsService.create(
      createInspectionDto,
      dummySubmitterId,
    );
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
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(Role.ADMIN, Role.REVIEWER, Role.INSPECTOR) // Adjust roles as needed
  // @ApiOperation(...)
  // @ApiParam({ name: 'id', type: String, format: 'uuid' })
  // @ApiBody({ type: UpdateInspectionDto })
  // @ApiResponse({ status: 200, type: InspectionResponseDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateInspectionDto: UpdateInspectionDto,
    // @GetUser('id') userId: string, // Get authenticated user ID later
    // @GetUser('role') userRole: Role // Get role later
  ): Promise<InspectionResponseDto> {
    const dummyUserId = 'DUMMY_UPDATER_ID'; // Temporary
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
  @Post(':id/photos/fixed')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FilesInterceptor('photos', MAX_PHOTOS_PER_REQUEST, {
      storage: photoStorageConfig,
      fileFilter: imageFileFilter,
    }),
  )
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(Role.ADMIN, Role.REVIEWER, Role.INSPECTOR)
  // @ApiOperation(...) @ApiConsumes(...) @ApiParam(...) @ApiBody(...) @ApiResponse(...)
  async addMultipleFixedPhotos(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() addBatchDto: AddBatchFixedPhotosDto,
    @UploadedFiles() files: Array<Express.Multer.File>,
    // @GetUser('id') userId: string, // Get user ID later
  ): Promise<PhotoResponseDto[]> {
    this.logger.log(
      `[POST /inspections/${id}/photos/fixed-batch] Received ${files?.length} files.`,
    );
    if (!files || files.length === 0)
      throw new BadRequestException('No photo files provided.');
    const dummyUserId = 'DUMMY_PHOTO_UPLOADER';
    const newPhotos = await this.photosService.addMultipleFixedPhotos(
      id,
      files,
      addBatchDto.metadata,
      dummyUserId,
    );
    return newPhotos.map((p) => new PhotoResponseDto(p));
  }

  /**
   * [POST /inspections/:id/photos/dynamic-batch]
   * Uploads a batch of DYNAMIC type photos (custom labels, attention flag) for an inspection.
   * Expects 'multipart/form-data' with 'metadata' (JSON string array) and 'photos' (files).
   * @param {string} id - Inspection UUID.
   * @param {AddBatchDynamicPhotosDto} addBatchDto - DTO containing the 'metadata' JSON string.
   * @param {Express.Multer.File[]} files - Array of uploaded image files from the 'photos' field.
   * @returns {Promise<PhotoResponseDto[]>} Array of created photo record summaries.
   */
  @Post(':id/photos/dynamic')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FilesInterceptor('photos', MAX_PHOTOS_PER_REQUEST, {
      storage: photoStorageConfig,
      fileFilter: imageFileFilter,
    }),
  )
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(Role.ADMIN, Role.REVIEWER, Role.INSPECTOR)
  // @ApiOperation(...) @ApiConsumes(...) @ApiParam(...) @ApiBody(...) @ApiResponse(...)
  async addMultipleDynamicPhotos(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() addBatchDto: AddBatchDynamicPhotosDto,
    @UploadedFiles() files: Array<Express.Multer.File>,
    // @GetUser('id') userId: string,
  ): Promise<PhotoResponseDto[]> {
    this.logger.log(
      `[POST /inspections/${id}/photos/dynamic-batch] Received ${files?.length} files.`,
    );
    if (!files || files.length === 0)
      throw new BadRequestException('No photo files provided.');
    const dummyUserId = 'DUMMY_PHOTO_UPLOADER';
    const newPhotos = await this.photosService.addMultipleDynamicPhotos(
      id,
      files,
      addBatchDto.metadata,
      dummyUserId,
    );
    return newPhotos.map((p) => new PhotoResponseDto(p));
  }

  /**
   * [POST /inspections/:id/photos/document-batch]
   * Uploads a batch of DOCUMENT type photos (custom labels) for an inspection.
   * Expects 'multipart/form-data' with 'metadata' (JSON string array) and 'photos' (files).
   * @param {string} id - Inspection UUID.
   * @param {AddBatchDocumentPhotosDto} addBatchDto - DTO containing the 'metadata' JSON string.
   * @param {Express.Multer.File[]} files - Array of uploaded image files from the 'photos' field.
   * @returns {Promise<PhotoResponseDto[]>} Array of created photo record summaries.
   */
  @Post(':id/photos/document')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FilesInterceptor('photos', MAX_PHOTOS_PER_REQUEST, {
      storage: photoStorageConfig,
      fileFilter: imageFileFilter,
    }),
  )
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(Role.ADMIN, Role.REVIEWER, Role.INSPECTOR)
  // @ApiOperation(...) @ApiConsumes(...) @ApiParam(...) @ApiBody(...) @ApiResponse(...)
  async addMultipleDocumentPhotos(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() addBatchDto: AddBatchDocumentPhotosDto,
    @UploadedFiles() files: Array<Express.Multer.File>,
    // @GetUser('id') userId: string,
  ): Promise<PhotoResponseDto[]> {
    this.logger.log(
      `[POST /inspections/${id}/photos/document-batch] Received ${files?.length} files.`,
    );
    if (!files || files.length === 0)
      throw new BadRequestException('No photo files provided.');
    const dummyUserId = 'DUMMY_PHOTO_UPLOADER';
    const newPhotos = await this.photosService.addMultipleDocumentPhotos(
      id,
      files,
      addBatchDto.metadata,
      dummyUserId,
    );
    return newPhotos.map((p) => new PhotoResponseDto(p));
  }

  // --- Photo Management Endpoints ---

  /**
   * [GET /inspections/:id/photos]
   * Retrieves all photo records associated with a specific inspection.
   */
  @Get(':id/photos')
  // @UseGuards(JwtAuthGuard) // Consider if this needs auth
  // @ApiOperation(...) @ApiParam(...) @ApiResponse(...)
  async getPhotosForInspection(
    @Param('id', ParseUUIDPipe) id: string,
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
  // @ApiOperation(...) @ApiConsumes(...) @ApiParam(...) @ApiBody(...) @ApiResponse(...)
  async updatePhoto(
    @Param('id', ParseUUIDPipe) inspectionId: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
    @Body() updatePhotoDto: UpdatePhotoDto, // Contains optional label/needAttention
    @UploadedFile() newFile?: Express.Multer.File, // Optional new file
    // @GetUser('id') userId: string,
  ): Promise<PhotoResponseDto> {
    const dummyUserId = 'DUMMY_PHOTO_UPDATER';
    this.logger.log(
      `[PUT /inspections/${inspectionId}/photos/${photoId}] Request received by user ${dummyUserId}`,
    );
    const updatedPhoto = await this.photosService.updatePhoto(
      inspectionId,
      photoId,
      updatePhotoDto,
      newFile,
      dummyUserId,
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
  // @ApiOperation(...) @ApiParam(...) @ApiResponse(...)
  async deletePhoto(
    @Param('id', ParseUUIDPipe) inspectionId: string, // Included for path consistency, might not be needed by service
    @Param('photoId', ParseUUIDPipe) photoId: string,
    // @GetUser('id') userId: string,
  ): Promise<void> {
    const dummyUserId = 'DUMMY_PHOTO_DELETER';
    this.logger.log(
      `[DELETE /inspections/${inspectionId}/photos/${photoId}] Request received by user ${dummyUserId}`,
    );
    await this.photosService.deletePhoto(photoId, dummyUserId);
    // No return body for 204
  }

  // --- Inspection Retrieval Endpoints ---

  /**
   * [GET /inspections]
   * Retrieves all inspection records, potentially filtered by role (passed via query).
   */
  @Get()
  // @UseGuards(JwtAuthGuard) // Add later if needed
  // @ApiOperation(...) @ApiResponse(...)
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
   * [GET /inspections/:id]
   * Retrieves a specific inspection by ID, applying role-based visibility rules.
   */
  @Get(':id')
  // @UseGuards(JwtAuthGuard) // Add later if needed
  // @ApiOperation(...) @ApiParam(...) @ApiResponse(...)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
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
  // @ApiOperation(...) @ApiParam(...) @ApiResponse(...)
  async approveInspection(
    @Param('id', ParseUUIDPipe) id: string,
    // @GetUser('id') reviewerId: string,
  ): Promise<InspectionResponseDto> {
    const dummyReviewerId = '11111111-1111-1111-1111-111111111111'; // Temporary
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
   * [PATCH /inspections/:id/reject]
   * Rejects a submitted inspection. Requires Reviewer/Admin role.
   */
  @Patch(':id/reject')
  @HttpCode(HttpStatus.OK)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(Role.ADMIN, Role.REVIEWER)
  // @ApiOperation(...) @ApiParam(...) @ApiResponse(...)
  async rejectInspection(
    @Param('id', ParseUUIDPipe) id: string,
    // @GetUser('id') reviewerId: string,
  ): Promise<InspectionResponseDto> {
    const dummyReviewerId = '11111111-1111-1111-1111-111111111111'; // Temporary
    this.logger.warn(
      `Using DUMMY reviewer ID: ${dummyReviewerId} for PATCH /reject`,
    );
    const inspection = await this.inspectionsService.rejectInspection(
      id,
      dummyReviewerId,
    );
    return new InspectionResponseDto(inspection);
  }

  /**
   * [PUT /inspections/:id/archive]
   * Processes an inspection for archiving (upload PDF, simulate blockchain).
   * Requires Reviewer/Admin role. Expects multipart/form-data with 'pdfFile'.
   */
  @Put(':id/archive')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('pdfFile', {
      storage: pdfStorageConfig,
      fileFilter: pdfFileFilter,
    }),
  )
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(Role.ADMIN, Role.REVIEWER)
  // @ApiOperation(...) @ApiConsumes(...) @ApiParam(...) @ApiBody(...) @ApiResponse(...)
  async processToArchive(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() pdfFile: Express.Multer.File,
    // @GetUser('id') userId: string,
  ): Promise<InspectionResponseDto> {
    this.logger.log(
      `[PUT /inspections/${id}/archive] Received PDF: ${pdfFile?.originalname}`,
    );
    if (!pdfFile) throw new BadRequestException('PDF file is required.');
    const dummyUserId = 'ARCHIVER_USER_ID'; // Temporary
    this.logger.warn(`Using DUMMY user ID for archive action: ${dummyUserId}`);
    const finalInspection = await this.inspectionsService.processToArchive(
      id,
      pdfFile,
      dummyUserId,
    );
    return new InspectionResponseDto(finalInspection);
  }

  /**
   * [PATCH /inspections/:id/deactivate]
   * Deactivates an archived inspection. Requires Admin role.
   */
  @Patch(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(Role.ADMIN)
  // @ApiOperation(...) @ApiParam(...) @ApiResponse(...)
  async deactivateArchive(
    @Param('id', ParseUUIDPipe) id: string,
    // @GetUser('id') userId: string,
  ): Promise<InspectionResponseDto> {
    const dummyUserId = 'DEACTIVATOR_USER_ID'; // Temporary
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
   * [PATCH /inspections/:id/activate]
   * Reactivates a deactivated inspection. Requires Admin role.
   */
  @Patch(':id/activate')
  @HttpCode(HttpStatus.OK)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(Role.ADMIN)
  // @ApiOperation(...) @ApiParam(...) @ApiResponse(...)
  async activateArchive(
    @Param('id', ParseUUIDPipe) id: string,
    // @GetUser('id') userId: string,
  ): Promise<InspectionResponseDto> {
    const dummyUserId = 'ACTIVATOR_USER_ID'; // Temporary
    this.logger.warn(`Using DUMMY user ID for activate action: ${dummyUserId}`);
    const inspection = await this.inspectionsService.activateArchive(
      id,
      dummyUserId,
    );
    return new InspectionResponseDto(inspection);
  }
} // End Controller
