/**
 * @fileoverview Controller responsible for handling HTTP requests related to inspections.
 * Provides endpoints for creating new inspections (with data and photos) and retrieving all inspections.
 * Handles multipart/form-data for creation including file uploads.
 * Authentication/Authorization is currently disabled for development purposes.
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  UseInterceptors, // Required for file upload handling
  UploadedFiles, // Decorator to access uploaded files
  UploadedFile,
  Logger, // For logging information and errors
  BadRequestException, // To throw specific HTTP errors
  Param,
  ParseUUIDPipe,
  NotFoundException,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { InspectionsService } from './inspections.service'; // The service handling business logic
import { CreateInspectionDto } from './dto/create-inspection.dto'; // DTO defining the structure of the request body
import { UpdateInspectionDto } from './dto/update-inspection.dto';
import {
  FileFieldsInterceptor,
  FileInterceptor,
  FilesInterceptor,
} from '@nestjs/platform-express'; // NestJS interceptor for handling multiple file fields
import { diskStorage } from 'multer'; // Storage engine for Multer (file uploads)
import { extname } from 'path'; // Node.js utility for handling file extensions
import { Inspection, Role } from '@prisma/client';
import { InspectionResponseDto } from './dto/inspection-response.dto';
import { AddPhotosDto } from './dto/add-photos.dto';
import { AddFixedPhotoDto } from '../photos/dto/add-fixed-photo.dto';
import { AddDynamicPhotoDto } from '../photos/dto/add-dynamic-photo.dto';
import { AddDocumentPhotoDto } from '../photos/dto/add-document-photo.dto';
import { PhotoResponseDto } from '../photos/dto/photo-response.dto';
import { UpdatePhotoDto } from '../photos/dto/update-photo.dto';
import { PhotosService } from '../photos/photos.service';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { AddBatchDynamicPhotosDto } from 'src/photos/dto/add-batch-dynamic-photos.dto';
import { AddBatchFixedPhotosDto } from 'src/photos/dto/add-batch-fixed-photos.dto';
import { AddBatchDocumentPhotosDto } from 'src/photos/dto/add-batch-document-photos.dto';
// Import Guards if/when needed for authentication and authorization
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
// import { RolesGuard } from '../auth/guards/roles.guard';
// import { Roles } from '../auth/decorators/roles.decorator';

// --- Multer Configuration ---
// (Consider moving this configuration to a separate file or module for better organization)

// Maximum number of photos allowed per upload
const MAX_PHOTOS_PER_REQUEST = 10;
// Destination directory for uploaded photos (ensure this directory exists or is created)
const UPLOAD_PATH = './uploads/inspection-photos';
const PDF_ARCHIVE_PATH = './pdfarchived';

/**
 * Multer disk storage configuration. Defines where and how files are saved locally.
 * For production, consider using cloud storage (e.g., S3, GCS) with appropriate multer storage engines.
 */
const photoStorageConfig = diskStorage({
  destination: UPLOAD_PATH, // Specify the upload directory
  filename: (req, file, callback) => {
    // Generate a unique filename to prevent collisions
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const extension = extname(file.originalname); // Get the original file extension
    // Optionally sanitize the original name before using it
    const safeOriginalName = file.originalname
      .split('.')[0]
      .replace(/[^a-z0-9]/gi, '-')
      .toLowerCase(); // Basic sanitization
    // Construct the new filename: originalname-timestamp-random.extension
    callback(null, `${safeOriginalName}-${uniqueSuffix}${extension}`);
  },
});

const pdfStorageConfig = diskStorage({
  destination: PDF_ARCHIVE_PATH,
  filename: (req, file, callback) => {
    // Nama sementara, akan di-rename di service menggunakan inspectionId
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const extension = extname(file.originalname);
    callback(null, `temp-pdf-${uniqueSuffix}${extension}`);
  },
});

/**
 * Multer file filter function to allow only specific image mime types.
 * Rejects files that are not common image types.
 *
 * @param req - The incoming request object.
 * @param file - The file object being uploaded.
 * @param callback - The callback function (error, acceptFile).
 */
const imageFileFilter = (req, file, callback) => {
  // Check the file's mimetype against allowed image types
  if (!file.mimetype.match(/^image\/(jpg|jpeg|png|gif)$/)) {
    // Reject file with a BadRequestException if it's not an allowed image type
    return callback(
      new BadRequestException(
        'Only image files (jpg, jpeg, png, gif) are allowed!',
      ),
      false,
    );
  }
  // Accept the file if it's an allowed image type
  callback(null, true);
};

const pdfFileFilter = (req, file, callback) => {
  if (file.mimetype !== 'application/pdf') {
    return callback(
      new BadRequestException('Only PDF files are allowed!'),
      false,
    );
  }
  callback(null, true);
};
// --------------------------------------------------------------------

@Controller('inspections')
export class InspectionsController {
  // Initialize a logger specific to this controller context for better traceability.
  private readonly logger = new Logger(InspectionsController.name);

  /**
   * Injects InspectionsService dependency using NestJS dependency injection.
   * @param {InspectionsService} inspectionsService - Instance of the service handling inspection logic.
   */
  constructor(
    private readonly inspectionsService: InspectionsService,
    private readonly photosService: PhotosService,
  ) {}

  /**
   * Creates the initial inspection record with text and JSON data.
   * Does NOT accept file uploads in this request.
   *
   * @param {CreateInspectionDto} createInspectionDto - DTO with text/JSON data.
   * @returns {Promise<InspectionResponseDto>} The created inspection record (without photos initially).
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
    const dummySubmitterId = '23ec1675-c4f0-4ac2-9dbf-8072af0c977b'; // Temporary placeholder
    this.logger.warn(
      `Using DUMMY submitter ID: ${dummySubmitterId} for POST /inspections`,
    );
    const newInspection = await this.inspectionsService.create(
      createInspectionDto,
      dummySubmitterId,
    );
    return newInspection;
  }

  /**
   * Partially updates an existing inspection record's data fields (excluding photos).
   * Accepts application/json body with optional fields to update.
   * Requires authentication and specific roles (to be added later).
   *
   * @param {string} id - The UUID of the inspection to update.
   * @param {UpdateInspectionDto} updateInspectionDto - DTO containing the fields to update.
   * @returns {Promise<InspectionResponseDto>} The fully updated inspection record.
   */
  @Patch(':id') // Menggunakan PATCH untuk pembaruan parsial
  @ApiOperation({
    summary: 'Update inspection data fields (Admin/Reviewer Only - Dev)',
    description:
      'Partially updates text/JSON fields for an existing inspection. Does not handle photo updates.',
  })
  @ApiConsumes('application/json') // Mengharapkan JSON body
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'Inspection ID',
  })
  @ApiBody({
    type: UpdateInspectionDto,
    description: 'Provide only the fields you want to update.',
  })
  @ApiResponse({
    status: 200,
    description: 'Inspection updated successfully.',
    type: InspectionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad Request (e.g., invalid JSON format, no fields to update).',
  })
  @ApiResponse({ status: 404, description: 'Inspection not found.' })
  // @UseGuards(JwtAuthGuard, RolesGuard) // Tambahkan ini nanti
  // @Roles(Role.ADMIN, Role.REVIEWER)    // Tentukan role yang boleh update
  async update(
    @Param('id') id: string,
    @Body() updateInspectionDto: UpdateInspectionDto,
    // @GetUser('id') userId: string, // Get authenticated user ID later
    // @GetUser('role') userRole: Role // Get role later
  ): Promise<InspectionResponseDto> {
    this.logger.log(`[PATCH /inspections/${id}] Request received`);
    this.logger.debug('Update DTO:', JSON.stringify(updateInspectionDto));

    // --- Dummy User Context (sementara) ---
    const dummyUserId = 'DUMMY_UPDATER_ID';
    const dummyUserRole = Role.ADMIN; // Asumsikan admin untuk sementara
    this.logger.warn(
      `Using DUMMY user context for update: User=${dummyUserId}, Role=${dummyUserRole}`,
    );
    // ------------------------------------

    const updatedInspection = await this.inspectionsService.update(
      id,
      updateInspectionDto,
      dummyUserId,
      dummyUserRole,
    );
    return new InspectionResponseDto(updatedInspection);
  }

  /** Upload BATCH Foto Tipe FIXED */
  @Post(':id/photos/fixed') // path: /api/v1/inspections/{id}/photos/fixed
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Step 2a (Batch): Upload multiple FIXED photos with metadata',
  })
  @ApiConsumes('multipart/form-data')
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'Inspection ID',
  })
  @ApiBody({
    // Deskripsi body
    schema: {
      type: 'object',
      properties: {
        metadata: {
          type: 'string',
          format: 'json',
          description:
            'REQUIRED: JSON string array of metadata ({originalLabel: string}) matching file order.',
          example: '[{"originalLabel":"Tampak Depan"}]',
        },
        photos: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: `Batch of FIXED photos (max ${MAX_PHOTOS_PER_REQUEST}). Order must match metadata.`,
        },
      },
      required: ['metadata', 'photos'],
    },
  })
  @UseInterceptors(
    FilesInterceptor('photos', MAX_PHOTOS_PER_REQUEST, {
      storage: photoStorageConfig,
      fileFilter: imageFileFilter,
    }),
  )
  @ApiResponse({
    status: 201,
    description: 'Batch of fixed photos added',
    type: [PhotoResponseDto],
  }) // Returns array
  @ApiResponse({ status: 400 })
  @ApiResponse({ status: 404 })
  async addMultipleFixedPhotos(
    @Param('id') id: string,
    @Body() addBatchDto: AddBatchFixedPhotosDto,
    @UploadedFiles() files: Array<Express.Multer.File>,
    // @GetUser('id') userId: string, // Get user ID later
  ): Promise<PhotoResponseDto[]> {
    this.logger.log(
      `[POST /inspections/${id}/photos/fixed-batch] Received ${files?.length} files.`,
    );
    if (!files || files.length === 0)
      throw new BadRequestException('No photo files provided.');

    const newPhotos = await this.photosService.addMultipleFixedPhotos(
      id,
      files,
      addBatchDto.metadata /*, userId*/,
    );
    return newPhotos.map((p) => new PhotoResponseDto(p));
  }

  /**
   * Uploads a BATCH of DYNAMIC photos and their corresponding metadata array (as JSON string).
   * Expects multipart/form-data with 'metadata' (JSON string array) and 'photos' (multiple files).
   */
  @Post(':id/photos/dynamic') // New endpoint for batch
  @HttpCode(HttpStatus.CREATED) // Multiple resources created
  @ApiOperation({
    summary: 'Step 2b (Batch): Upload multiple DYNAMIC photos with metadata',
  })
  @ApiConsumes('multipart/form-data')
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'Inspection ID',
  })
  @ApiBody({
    // Describe multipart body with metadata string and files
    schema: {
      type: 'object',
      properties: {
        metadata: {
          type: 'string',
          format: 'json',
          description:
            'REQUIRED: JSON string array of metadata ({label: string, needAttention?: boolean}) matching file upload order.',
          example:
            '[{"label":"Baret Pintu","needAttention":true},{"label":"Dashboard"}]',
        },
        photos: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: `Batch of DYNAMIC photos (max ${MAX_PHOTOS_PER_REQUEST} per request). Order must match metadata array.`,
        },
      },
      required: ['metadata', 'photos'],
    },
  })
  @UseInterceptors(
    FilesInterceptor(
      // Use FilesInterceptor for array upload
      'photos',
      MAX_PHOTOS_PER_REQUEST, // Limit per batch request
      { storage: photoStorageConfig, fileFilter: imageFileFilter },
    ),
  )
  @ApiResponse({
    status: 201,
    description: 'Batch of dynamic photos added successfully.',
    type: [PhotoResponseDto],
  }) // Returns array
  @ApiResponse({
    status: 400,
    description:
      'Bad Request (e.g., missing fields, count mismatch, invalid JSON/file).',
  })
  @ApiResponse({ status: 404, description: 'Inspection not found.' })
  async addMultipleDynamicPhotos(
    @Param('id') id: string,
    @Body() addBatchDto: AddBatchDynamicPhotosDto,
    @UploadedFiles() files: Array<Express.Multer.File>,
    // @GetUser('id') userId: string,
  ): Promise<PhotoResponseDto[]> {
    // Returns array of DTOs
    this.logger.log(
      `[POST /inspections/${id}/photos/dynamic-batch] Received request with ${files?.length} files.`,
    );
    if (!files || files.length === 0) {
      throw new BadRequestException(
        'No photo files were uploaded in the "photos" field.',
      );
    }

    // Call the new service method
    const newPhotos = await this.photosService.addMultipleDynamicPhotos(
      id,
      files,
      addBatchDto.metadata /*, userId*/,
    );
    // Map results to response DTO
    return newPhotos.map((p) => new PhotoResponseDto(p));
  }

  /** Upload BATCH Foto Tipe DOCUMENT */
  @Post(':id/photos/document')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Step 2c (Batch): Upload multiple DOCUMENT photos with metadata',
  })
  @ApiConsumes('multipart/form-data')
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'Inspection ID',
  })
  @ApiBody({
    // Deskripsi body
    schema: {
      type: 'object',
      properties: {
        metadata: {
          type: 'string',
          format: 'json',
          description:
            'REQUIRED: JSON string array of metadata ({label: string}) matching file order.',
          example: '[{"label":"STNK Hal 1"}]',
        },
        photos: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: `Batch of DOCUMENT photos (max ${MAX_PHOTOS_PER_REQUEST}). Order must match metadata.`,
        },
      },
      required: ['metadata', 'photos'],
    },
  })
  @UseInterceptors(
    FilesInterceptor('photos', MAX_PHOTOS_PER_REQUEST, {
      storage: photoStorageConfig,
      fileFilter: imageFileFilter,
    }),
  )
  @ApiResponse({
    status: 201,
    description: 'Batch of document photos added',
    type: [PhotoResponseDto],
  })
  @ApiResponse({ status: 400 })
  @ApiResponse({ status: 404 })
  async addMultipleDocumentPhotos(
    @Param('id') id: string,
    @Body() addBatchDto: AddBatchDocumentPhotosDto,
    @UploadedFiles() files: Array<Express.Multer.File>,
  ): Promise<PhotoResponseDto[]> {
    this.logger.log(
      `[POST /inspections/${id}/photos/document-batch] Received ${files?.length} files.`,
    );
    if (!files || files.length === 0)
      throw new BadRequestException('No photo files provided.');
    const newPhotos = await this.photosService.addMultipleDocumentPhotos(
      id,
      files,
      addBatchDto.metadata /*, userId*/,
    );
    return newPhotos.map((p) => new PhotoResponseDto(p));
  }

  /** GET All Photos for an Inspection */
  @Get(':id/photos')
  @ApiOperation({ summary: 'Get all photo records for a specific inspection' })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'Inspection ID',
  })
  @ApiResponse({
    status: 200,
    description: 'List of photo records',
    type: [PhotoResponseDto],
  })
  @ApiResponse({ status: 404, description: 'Inspection not found.' })
  async getPhotosForInspection(
    @Param('id') id: string,
  ): Promise<PhotoResponseDto[]> {
    this.logger.log(`[GET /inspections/${id}/photos] Request received`);
    const photos = await this.photosService.findForInspection(id);
    return photos.map((p) => new PhotoResponseDto(p));
  }

  /** DELETE a specific Photo */
  @Delete(':id/photos/:photoId') // Nested DELETE
  @HttpCode(HttpStatus.NO_CONTENT) // 204 No Content is typical for successful DELETE
  @ApiOperation({ summary: 'Delete a specific photo from an inspection' })
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
    description: 'Photo ID to delete',
  })
  @ApiResponse({ status: 204, description: 'Photo deleted successfully.' })
  @ApiResponse({ status: 404, description: 'Photo or Inspection not found.' })
  async deletePhoto(
    @Param('id', ParseUUIDPipe) inspectionId: string, // Anda mungkin tidak butuh ini jika photoId unik global
    @Param('photoId', ParseUUIDPipe) photoId: string,
  ): Promise<void> {
    // Return void untuk 204
    this.logger.log(
      `[DELETE /inspections/${inspectionId}/photos/${photoId}] Request received`,
    );
    await this.photosService.deletePhoto(photoId /*, userId*/);
    // Tidak perlu return body untuk 204
  }

  /**
   * Updates a specific photo's metadata and/or replaces its file.
   * Expects multipart/form-data. The 'photo' file field is optional.
   * Metadata fields ('label', 'needAttention') are also optional.
   */
  @Put(':id/photos/:photoId') // Gunakan PUT untuk update/replace
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a specific photo (metadata and/or file)' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({
    name: 'id',
    description: 'Inspection ID',
    type: String,
    format: 'uuid',
  })
  @ApiParam({
    name: 'photoId',
    description: 'Photo ID to update',
    type: String,
    format: 'uuid',
  })
  @ApiBody({
    // Body bisa berisi DTO dan file opsional
    schema: {
      type: 'object',
      properties: {
        label: {
          type: 'string',
          description: 'Optional: New label (ignored if photo type is FIXED)',
          // required: false,
        },
        needAttention: {
          type: 'string',
          description:
            'Optional: New attention flag ("true"/"false", DYNAMIC only)',
          // required: false,
        },
        photo: {
          type: 'string',
          format: 'binary',
          description: 'Optional: New image file to replace the existing one',
          // required: false,
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor(
      // Pakai FileInterceptor karena hanya 1 file opsional
      'photo', // Nama field untuk file baru (jika ada)
      { storage: photoStorageConfig, fileFilter: imageFileFilter }, // Konfigurasi Multer sama
    ),
  )
  @ApiResponse({
    status: 200,
    description: 'Photo updated successfully',
    type: PhotoResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request (e.g., invalid metadata for type, invalid file)',
  })
  @ApiResponse({ status: 404, description: 'Inspection or Photo not found' })
  async updatePhoto(
    @Param('id') inspectionId: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
    @Body() updatePhotoDto: UpdatePhotoDto, // DTO untuk metadata opsional
    @UploadedFile() newFile?: Express.Multer.File, // File baru opsional
  ): Promise<PhotoResponseDto> {
    this.logger.log(
      `[PUT /inspections/${inspectionId}/photos/${photoId}] Request received`,
    );
    this.logger.debug('Update DTO:', updatePhotoDto);
    this.logger.debug('New file:', newFile?.filename);
    // Panggil service update
    const updatedPhoto = await this.photosService.updatePhoto(
      inspectionId,
      photoId,
      updatePhotoDto,
      newFile /*, userId*/,
    );
    return new PhotoResponseDto(updatedPhoto);
  }

  /**
   * Retrieves all inspection records based on user role filter.
   * No pagination yet.
   */
  @Get()
  async findAll(@Query('role') userRole?: Role) {
    // Terima role dari query param (sementara)
    this.logger.log(
      `[GET /inspections] Request received. Filtering by role: ${userRole || 'ALL (Admin/Reviewer default)'}`,
    );
    // --- Dummy Role (jika tidak ada query param) ---
    // Nanti role didapat dari req.user.role setelah JWT Guard aktif
    const roleToFilter = userRole || Role.ADMIN; // Default ke ADMIN jika tidak ada query param
    this.logger.warn(`Applying filter for DUMMY role: ${roleToFilter}`);
    // ---------------------------------------------
    return this.inspectionsService.findAll(roleToFilter);
  }

  /**
   * Retrieves a specific inspection record by ID.
   * Filtering based on role applied in the service.
   */
  @Get(':id')
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
   * Approves a submitted inspection.
   * Uses PATCH as it partially modifies the resource (status, reviewerId).
   */
  @Patch(':id/approve') // Gunakan PATCH untuk update status
  @HttpCode(HttpStatus.OK)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(Role.ADMIN, Role.REVIEWER)
  // @ApiOperation(...) @ApiParam(...) @ApiResponse(...)
  async approveInspection(
    @Param('id') id: string,
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
   * Rejects a submitted inspection.
   * Uses PATCH.
   */
  @Patch(':id/reject')
  @HttpCode(HttpStatus.OK)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(Role.ADMIN, Role.REVIEWER)
  // @ApiOperation(...) @ApiParam(...) @ApiResponse(...)
  async rejectInspection(
    @Param('id') id: string,
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
   * Initiates the archiving process for an approved inspection.
   * Expects a single PDF file upload in the 'pdfFile' field.
   * Uses PUT as it replaces/sets the archive-related data.
   */
  @Put(':id/archive') // Gunakan PUT untuk proses 'finalisasi'
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor(
      // Pakai FileInterceptor untuk single file
      'pdfFile', // Nama field di form-data untuk PDF
      { storage: pdfStorageConfig, fileFilter: pdfFileFilter }, // Pakai config PDF
    ),
  )
  async processToArchive(
    @Param('id') id: string,
    @UploadedFile() pdfFile: Express.Multer.File,
    // @GetUser('id') userId: string,
  ): Promise<InspectionResponseDto> {
    this.logger.log(
      `[PUT /inspections/${id}/archive] Received request with PDF: ${pdfFile?.originalname}`,
    );
    if (!pdfFile) {
      throw new BadRequestException(
        'PDF file is required in the "pdfFile" field.',
      );
    }
    // --- Dummy User ID (yg melakukan aksi) ---
    const dummyUserId = 'ACTION_USER_ID_PLACEHOLDER_ARCHIVE';
    this.logger.warn(`Using DUMMY user ID for archive action: ${dummyUserId}`);
    // --------------------------------------
    // Service akan handle penyimpanan PDF, hash, blockchain sim, update status
    return this.inspectionsService.processToArchive(id, pdfFile, dummyUserId);
  }

  /**
   * Deactivates an archived inspection.
   * Uses PATCH.
   */
  @Patch(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(Role.ADMIN)
  // @ApiOperation(...) @ApiParam(...) @ApiResponse(...)
  async deactivateArchive(
    @Param('id') id: string,
    // @GetUser('id') userId: string,
  ): Promise<InspectionResponseDto> {
    const dummyUserId = 'DEACTIVATOR_USER_ID'; // Temporary
    this.logger.warn(
      `Using DUMMY user ID for deactivate action: ${dummyUserId}`,
    );
    // --------------------
    return this.inspectionsService.deactivateArchive(id, dummyUserId);
  }

  /**
   * Reactivates a deactivated inspection.
   * Uses PATCH.
   */
  @Patch(':id/activate')
  @HttpCode(HttpStatus.OK)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(Role.ADMIN)
  // @ApiOperation(...) @ApiParam(...) @ApiResponse(...)
  async activateArchive(
    @Param('id') id: string,
    // @GetUser('id') userId: string,
  ): Promise<InspectionResponseDto> {
    const dummyUserId = 'ACTIVATOR_USER_ID'; // Temporary
    this.logger.warn(`Using DUMMY user ID for activate action: ${dummyUserId}`);
    // --------------------
    return this.inspectionsService.activateArchive(id, dummyUserId);
  }
}
