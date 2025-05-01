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
    Body,
    UseInterceptors, // Required for file upload handling
    UploadedFiles,  // Decorator to access uploaded files
    Logger,         // For logging information and errors
    BadRequestException, // To throw specific HTTP errors
} from '@nestjs/common';
import { InspectionsService } from './inspections.service'; // The service handling business logic
import { CreateInspectionDto } from './dto/create-inspection.dto'; // DTO defining the structure of the request body
import { FileFieldsInterceptor } from '@nestjs/platform-express'; // NestJS interceptor for handling multiple file fields
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger'; // Decorators for API documentation (Swagger/Scalar)
import { diskStorage } from 'multer'; // Storage engine for Multer (file uploads)
import { extname } from 'path'; // Node.js utility for handling file extensions
// Import Guards if/when needed for authentication and authorization
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
// import { RolesGuard } from '../auth/guards/roles.guard';
// import { Roles } from '../auth/decorators/roles.decorator';
// import { Role } from '@prisma/client'; // Import Role enum if using RBAC

// --- Multer Configuration ---
// (Consider moving this configuration to a separate file or module for better organization)

// Maximum number of photos allowed per upload
const MAX_PHOTOS = 300;
// Destination directory for uploaded photos (ensure this directory exists or is created)
const UPLOAD_PATH = './uploads/inspection-photos';

/**
 * Multer disk storage configuration. Defines where and how files are saved locally.
 * For production, consider using cloud storage (e.g., S3, GCS) with appropriate multer storage engines.
 */
const fileStorageConfig = diskStorage({
    destination: UPLOAD_PATH, // Specify the upload directory
    filename: (req, file, callback) => {
        // Generate a unique filename to prevent collisions
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = extname(file.originalname); // Get the original file extension
        // Optionally sanitize the original name before using it
        const safeOriginalName = file.originalname.split('.')[0].replace(/[^a-z0-9]/gi, '-').toLowerCase(); // Basic sanitization
        // Construct the new filename: originalname-timestamp-random.extension
        callback(null, `${safeOriginalName}-${uniqueSuffix}${extension}`);
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
        return callback(new BadRequestException('Only image files (jpg, jpeg, png, gif) are allowed!'), false);
    }
    // Accept the file if it's an allowed image type
    callback(null, true);
};
// --------------------------------------------------------------------

/**
 * @ApiTags Decorator: Groups endpoints under the 'Inspection Data' tag in Swagger/Scalar UI.
 * @Controller Decorator: Defines the base route prefix for all endpoints in this controller.
 * Since a global prefix '/api/v1' is set in main.ts, the full path will be '/api/v1/inspections'.
 */
@ApiTags('Inspection Data')
@Controller('inspections')
export class InspectionsController {
    // Initialize a logger specific to this controller context for better traceability.
    private readonly logger = new Logger(InspectionsController.name);

    /**
     * Injects InspectionsService dependency using NestJS dependency injection.
     * @param {InspectionsService} inspectionsService - Instance of the service handling inspection logic.
     */
    constructor(private readonly inspectionsService: InspectionsService) { }

    /**
     * @Post Decorator: Defines this method as the handler for POST requests to the controller's base path ('/api/v1/inspections').
     * @ApiOperation Decorator: Provides a summary and description for the API documentation.
     * @ApiConsumes Decorator: Specifies that this endpoint consumes 'multipart/form-data', crucial for file uploads.
     * @ApiBody Decorator: Describes the expected request body structure for API documentation, referencing the CreateInspectionDto
     *                   and explicitly mentioning the 'photos' file field.
     * @UseInterceptors Decorator: Applies the FileFieldsInterceptor to handle file uploads.
     *      - `FileFieldsInterceptor([{ name: 'photos', maxCount: MAX_PHOTOS }])`: Configures the interceptor to look for files under the field name 'photos' with a maximum count.
     *      - `{ storage: fileStorageConfig, fileFilter: imageFileFilter }`: Applies the defined storage and file filter configurations.
     * @ApiResponse Decorators: Document the possible HTTP responses (201 Created on success, 400 Bad Request on validation/file errors).
     *
     * Handles the creation of a new inspection record.
     *
     * @param {CreateInspectionDto} createInspectionDto - The DTO populated with text/JSON data from the form fields. NestJS ValidationPipe (with transform:true) attempts to parse stringified JSON fields into objects.
     * @param {object} files - An object containing arrays of uploaded files, keyed by the field names defined in FileFieldsInterceptor. Access photos via `files.photos`.
     * @returns {Promise<Inspection>} A promise resolving to the created inspection record from the service.
     */
    @Post()
    @ApiOperation({ summary: 'Add new inspection record (Multipart)', description: 'Submit inspection data. JSON fields (like identityDetails) must be sent as stringified JSON. Upload photos under the \'photos\' field.' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                // --- DTO Fields Description for Swagger ---
                vehiclePlateNumber: { type: 'string', nullable: true, example: 'AB 1234 CD', description: 'Vehicle license plate number' },
                inspectionDate: { type: 'string', format: 'date-time', nullable: true, example: '2025-06-15T09:00:00Z', description: 'Date of inspection (ISO 8601)' },
                overallRating: { type: 'string', nullable: true, example: 'Good', description: 'Overall inspection rating' },
                identityDetails: { type: 'string', format: 'json', description: 'Stringified JSON for Page 1 (Identitas)', example: '{"namaInspektor":"Test"}' },
                vehicleData: { type: 'string', format: 'json', description: 'Stringified JSON for Page 2 (Data Kendaraan)' },
                equipmentChecklist: { type: 'string', format: 'json', description: 'Stringified JSON for Page 3 & 6 (Kelengkapan)' },
                inspectionSummary: { type: 'string', format: 'json', description: 'Stringified JSON for Page 4 (Hasil Inspeksi)' },
                detailedAssessment: { type: 'string', format: 'json', description: 'Stringified JSON for Page 5 (Penilaian)' },
                // --- File Field Description for Swagger ---
                photos: {
                    type: 'array', // Indicates multiple files can be uploaded for this field
                    items: {
                        type: 'string',
                        format: 'binary', // Standard way to denote file uploads in OpenAPI/Swagger
                    },
                    description: `Inspection photos (Max ${MAX_PHOTOS} files, type: jpg/jpeg/png/gif)`,
                }
            },
            // Optionally mark which DTO fields are required if not using @IsNotEmpty() yet
            // required: ['vehiclePlateNumber', 'inspectionDate', ...]
        }
    })
    @UseInterceptors(FileFieldsInterceptor(
        [{ name: 'photos', maxCount: MAX_PHOTOS }], // Expect files under the field name 'photos'
        { storage: fileStorageConfig, fileFilter: imageFileFilter } // Apply storage and filter logic
    ))
    @ApiResponse({ status: 201, description: 'Inspection record created successfully.' /*, type: InspectionResponseDto - Add response DTO later */ })
    @ApiResponse({ status: 400, description: 'Bad Request (e.g., invalid file type, invalid JSON format in text fields).' })
    async create(
        @Body() createInspectionDto: CreateInspectionDto, // Injects form data fields into the DTO
        @UploadedFiles() files: { photos?: Express.Multer.File[] }, // Injects uploaded files
    ) {
        // Log received data for debugging purposes
        this.logger.debug('--- InspectionsController - POST /inspections ---');
        this.logger.debug('Received DTO in Controller:', JSON.stringify(createInspectionDto, null, 2)); // Log the potentially transformed DTO
        this.logger.debug('Received Files in Controller:', files?.photos?.map(f => ({ filename: f.filename, mimetype: f.mimetype, size: f.size }))); // Log file info

        // Extract the specific array of photos (if any were uploaded)
        const photos = files?.photos;

        // Call the service method to handle the creation logic
        // Pass the DTO and the extracted photo files
        return this.inspectionsService.create(createInspectionDto, photos);
    }

    /**
     * @Get Decorator: Defines this method as the handler for GET requests to the controller's base path ('/api/v1/inspections').
     * @ApiOperation Decorator: Provides a summary for the API documentation.
     * @ApiResponse Decorators: Document the possible HTTP responses (200 OK on success).
     *                       Note: Defining a specific array type like `type: [InspectionResponseDto]` might be complex if the DTO doesn't perfectly match the Prisma model.
     *
     * Retrieves all inspection records currently stored in the database.
     * This implementation does not yet include pagination or filtering.
     * Access is currently open for development.
     *
     * @returns {Promise<Inspection[]>} A promise resolving to an array of all inspection records.
     */
    @Get()
    @ApiOperation({ summary: 'Get all inspection records (No Pagination/Auth - Dev)' })
    @ApiResponse({ status: 200, description: 'List of all inspections retrieved.'/*, type: [InspectionResponseDto] */ }) // Add response DTO if available
    async findAll() {
        this.logger.log('Request received for GET /inspections');
        // Call the service method to retrieve all inspections
        return this.inspectionsService.findAll();
    }
}