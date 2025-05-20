/**
 * @fileoverview Service responsible for handling business logic related to inspections.
 * Interacts with PrismaService to manage inspection data in the database.
 * Handles parsing JSON data received as strings and storing file paths from uploads.
 * Authentication details (like associating with a real user) are currently using placeholders or omitted.
 */

import {
  Injectable,
  Logger,
  InternalServerErrorException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; // Service for Prisma client interaction
import { CreateInspectionDto } from './dto/create-inspection.dto'; // DTO for incoming creation data
import { UpdateInspectionDto } from './dto/update-inspection.dto';
import {
  Inspection,
  InspectionStatus,
  Prisma,
  Role,
  InspectionChangeLog,
} from '@prisma/client'; // Prisma generated types (Inspection model, Prisma namespace)
import * as fs from 'fs/promises'; // Use promise-based fs for async file operations
import * as path from 'path'; // For constructing file paths
import * as crypto from 'crypto'; // For generating PDF hash
import { format } from 'date-fns'; // for date formating
import { BlockchainService } from '../blockchain/blockchain.service';
import puppeteer, { Browser } from 'puppeteer'; // Import puppeteer and Browser type
import { ConfigService } from '@nestjs/config';

// Define path for archived PDFs (ensure this exists or is created by deployment script/manually)
const PDF_ARCHIVE_PATH = './pdfarchived';
// Define public base URL for accessing archived PDFs (should come from config in real app)
const PDF_PUBLIC_BASE_URL = process.env.PDF_PUBLIC_BASE_URL || '/pdfarchived'; // Example: /pdfarchived if served by Nginx

@Injectable()
export class InspectionsService {
  // Initialize a logger for this service context
  private readonly logger = new Logger(InspectionsService.name);
  // Inject PrismaService dependency via constructor
  constructor(
    private prisma: PrismaService,
    private blockchainService: BlockchainService,
    private config: ConfigService,
  ) {
    // Ensure the PDF archive directory exists on startup
    this.ensureDirectoryExists(PDF_ARCHIVE_PATH);
  }

  /** Helper to ensure directory exists */
  private async ensureDirectoryExists(directoryPath: string) {
    try {
      await fs.mkdir(directoryPath, { recursive: true });
      this.logger.log(`Directory ensured: ${directoryPath}`);
    } catch (error: any) {
      // Reverted to any
      if (error.code !== 'EEXIST') {
        // Ignore error if directory already exists
        this.logger.error(
          `Failed to create directory ${directoryPath}`,
          error.stack,
        );
        // Depending on severity, you might want to throw an error here
      }
    }
  }

  /**
   * Generates the next custom inspection ID based on branch code and date.
   * Format: BRANCHCODE-DDMMYYYY-SEQ (e.g., YOG-01052025-001)
   * WARNING: Needs proper transaction/locking in high concurrency scenarios to be truly safe.
   *
   * @param branchCode - 'YOG', 'SOL', 'SEM', etc. (Should come from DTO/User context)
   * @param inspectionDate - The date of the inspection.
   * @param tx - Optional Prisma transaction client for atomicity.
   * @returns The next sequential ID string.
   */
  private async generateNextInspectionId(
    branchCode: string, // e.g., 'YOG', 'SOL', 'SEM'
    inspectionDate: Date,
    tx: Prisma.TransactionClient, // Wajibkan transaksi untuk keamanan
  ): Promise<string> {
    const datePrefix = format(inspectionDate, 'ddMMyyyy'); // Format: 01052025
    const idPrefix = `${branchCode.toUpperCase()}-${datePrefix}-`; // e.g., YOG-01052025-

    // Atomically get and increment the sequence number for this branch and date within the transaction
    const sequenceRecord = await tx.inspectionSequence.upsert({
      where: {
        branchCode_datePrefix: {
          branchCode: branchCode.toUpperCase(),
          datePrefix: datePrefix,
        },
      },
      update: {
        nextSequence: {
          increment: 1,
        },
      },
      create: {
        branchCode: branchCode.toUpperCase(),
        datePrefix: datePrefix,
        nextSequence: 1, // Start at 1 for a new sequence
      },
      select: {
        nextSequence: true,
      },
    });

    // Use the sequence number obtained *before* the increment for the current ID
    const currentSequence = sequenceRecord.nextSequence;

    // Format nomor urut dengan padding nol (misal: 001, 010, 123)
    const nextSequenceStr = currentSequence.toString().padStart(3, '0');

    return `${idPrefix}${nextSequenceStr}`; // e.g., YOG-01052025-001
  }

  /**
   * Creates a new inspection record with initial data (excluding photos).
   * Status defaults to NEED_REVIEW. Requires the ID of the submitting user (inspector).
   *
   * @param {CreateInspectionDto} createInspectionDto - DTO containing initial data.
   * @param {string} submitterId - The UUID of the user (INSPECTOR) submitting the inspection.
   * @returns {Promise<{ id: string }>} An object containing the ID of the created inspection.
   */
  async create(
    createInspectionDto: CreateInspectionDto,
  ): Promise<{ id: string }> {
    this.logger.log(
      `Creating inspection for plate: ${createInspectionDto.vehiclePlateNumber ?? 'N/A'} by inspector ${createInspectionDto.inspectorId}`,
    );
    let branchCode = 'XXX'; // Placeholder - WAJIB DIGANTI
    try {
      const identity = createInspectionDto.identityDetails;
      if (
        identity &&
        typeof identity === 'object' &&
        'cabangInspeksi' in identity &&
        typeof identity.cabangInspeksi === 'string'
      ) {
        // Ambil 3 huruf pertama dan uppercase
        branchCode = identity.cabangInspeksi.substring(0, 3).toUpperCase();
        // Validasi sederhana
        if (!['YOG', 'SOL', 'SEM'].includes(branchCode)) {
          throw new BadRequestException(
            `Invalid branch code inferred from identityDetails: ${branchCode}`,
          );
        }
      } else {
        throw new BadRequestException(
          'Cannot determine branch code from identityDetails.',
        );
      }
    } catch (e: any) {
      // Reverted to any
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException(
        'Failed to determine branch code from identityDetails JSON.',
      );
    }

    const inspectionDateObj = createInspectionDto.inspectionDate
      ? new Date(createInspectionDto.inspectionDate)
      : new Date(); // Default ke now() jika tidak ada?
    if (isNaN(inspectionDateObj.getTime())) {
      throw new BadRequestException('Invalid inspectionDate format provided.');
    }

    return this.prisma.$transaction(
      async (tx) => {
        // Generate ID Kustom di dalam transaksi
        const customId = await this.generateNextInspectionId(
          branchCode,
          inspectionDateObj,
          tx,
        );
        this.logger.log(`Generated custom inspection ID: ${customId}`);

        const dataToCreate: Prisma.InspectionCreateInput = {
          // Let Prisma generate the UUID for 'id'
          pretty_id: customId, // <-- Gunakan ID kustom untuk pretty_id
          inspector: { connect: { id: createInspectionDto.inspectorId } },
          vehiclePlateNumber: createInspectionDto.vehiclePlateNumber,
          inspectionDate: inspectionDateObj, // Gunakan objek Date
          overallRating: createInspectionDto.overallRating,
          identityDetails: createInspectionDto.identityDetails, // Hasil parse
          vehicleData: createInspectionDto.vehicleData,
          equipmentChecklist: createInspectionDto.equipmentChecklist,
          inspectionSummary: createInspectionDto.inspectionSummary,
          detailedAssessment: createInspectionDto.detailedAssessment,
          bodyPaintThickness: createInspectionDto.bodyPaintThickness,
          // photoPaths default [], status default NEED_REVIEW
        };

        try {
          const newInspection = await tx.inspection.create({
            data: dataToCreate,
          });
          this.logger.log(
            `Successfully created inspection with custom ID: ${newInspection.id}`,
          );
          return { id: newInspection.id };
        } catch (error: any) {
          // Reverted to any
          // Tangani jika ID kustom ternyata tidak unik (race condition)
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
          ) {
            this.logger.error(
              `Race condition or duplicate custom ID generated: ${customId}`,
            );
            throw new ConflictException(
              `Failed to generate unique inspection ID for ${customId}. Please try again.`,
            );
          }
          this.logger.error(
            `Failed to create inspection with custom ID ${customId}: ${error.message}`,
            error.stack,
          );
          throw new InternalServerErrorException(
            'Could not save inspection data.',
          );
        }
      },
      {
        // Opsi transaksi: tingkat isolasi tinggi untuk mencegah race condition ID
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000, // milliseconds
        timeout: 10000, // milliseconds
      },
    );
  }

  /**
   * Helper function for deep comparison of JSON objects up to three levels.
   * Logs changes to the provided 'changes' array.
   *
   * @param fieldName The top-level JSON field name in the Inspection model.
   * @param oldJsonValue The entire old JSON object/value from the database for this fieldName.
   * @param newJsonValue The entire new JSON object/value from the DTO for this fieldName.
   * @param changes Array to push log entries into.
   * @param inspectionId The ID of the inspection.
   * @param userId The ID of the user making the change.
   * @param path Current path within the JSON object (e.g., ['fitur', 'airbag']). Max depth 2 for sub-sub-field.
   */
  private logJsonChangesRecursive(
    fieldName: string, // e.g., 'identityDetails', 'detailedAssessment'
    oldJsonValue: any,
    newJsonValue: any,
    changes: Prisma.InspectionChangeLogCreateManyInput[],
    inspectionId: string,
    userId: string,
    path: string[] = [], // Path of keys, e.g., [], ['fitur'], ['fitur', 'airbag']
  ) {
    const isObject = (val: any): val is object =>
      typeof val === 'object' && val !== null && !Array.isArray(val);
    // If we are at the max depth (sub-sub-field) or one of the values is not an object, compare them directly.
    // current path represents nesting:
    // path.length === 0: comparing root of newJsonValue against root of oldJsonValue (for fieldName)
    // path.length === 1: comparing a sub-field (e.g., detailedAssessment.fitur)
    // path.length === 2: comparing a sub-sub-field (e.g., detailedAssessment.fitur.airbag) - MAX DEPTH for specific logging
    if (
      path.length >= 2 ||
      !isObject(oldJsonValue) ||
      !isObject(newJsonValue)
    ) {
      if (JSON.stringify(oldJsonValue) !== JSON.stringify(newJsonValue)) {
        changes.push({
          inspectionId: inspectionId,
          changedByUserId: userId,
          fieldName: fieldName,
          subFieldName: path[0] || null,
          subsubfieldname: path[1] || null,
          oldValue:
            oldJsonValue === undefined || oldJsonValue === null
              ? Prisma.JsonNull
              : oldJsonValue,
          newValue:
            newJsonValue === undefined || newJsonValue === null
              ? Prisma.JsonNull
              : newJsonValue,
        });
      }
      return;
    }

    // If both are objects and we haven't reached max depth for specific path logging
    const oldObj = oldJsonValue as Record<string, any>;
    const newObj = newJsonValue as Record<string, any>; // This is the partial update object

    // Iterate ONLY through keys present in the new (update DTO) object.
    // We only care about what the user *intends* to change or set.
    for (const key of Object.keys(newObj)) {
      const currentPathWithKey = [...path, key];
      this.logJsonChangesRecursive(
        fieldName, // Keep passing the top-level fieldName
        oldObj[key], // Value from existing DB record
        newObj[key], // Value from the update DTO
        changes,
        inspectionId,
        userId,
        currentPathWithKey,
      );
    }
  }

  /**
   * Finds a single inspection by vehicle plate number (case-insensitive, space-agnostic).
   * This endpoint is publicly accessible and does not require role-based filtering.
   *
   * @param {string} vehiclePlateNumber - The vehicle plate number to search for.
   * @returns {Promise<Inspection | null>} The found inspection record or null if not found.
   */
  async findByVehiclePlateNumber(
    vehiclePlateNumber: string,
  ): Promise<Inspection | null> {
    this.logger.log(
      `Searching for inspection by vehicle plate number: ${vehiclePlateNumber}`,
    );

    try {
      // Use a raw query for a robust solution that works across databases for this specific matching logic.
      // This compares the lowercased, space-removed version of the input with the lowercased, space-removed version of the DB column.
      // Prisma's `$queryRaw` handles escaping the input to prevent SQL injection.
      const idResult = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT id
        FROM "inspections"
        WHERE lower(replace("vehiclePlateNumber", ' ', '')) = lower(replace(${vehiclePlateNumber}, ' ', ''))
        LIMIT 1;
      `;

      if (idResult.length === 0) {
        this.logger.log(
          `No inspection found for plate number: ${vehiclePlateNumber}`,
        );
        return null;
      }

      const inspectionId = idResult[0].id;

      // Now fetch the full inspection object with relations using the ID
      const inspection = await this.prisma.inspection.findUnique({
        where: { id: inspectionId },
        include: { photos: true }, // Include photos as in findOne
      });

      this.logger.log(
        `Found inspection ID: ${inspection?.id} for plate number: ${vehiclePlateNumber}`,
      );
      return inspection;
    } catch (error: any) {
      this.logger.error(
        `Failed to search inspection by plate number ${vehiclePlateNumber}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Could not search inspection data.',
      );
    }
  }

  /**
   * Logs changes made to an inspection record by a reviewer/admin.
   * Changes are recorded in the InspectionChangeLog table.
   * The actual Inspection record is NOT updated by this method itself;
   * updates happen during the 'approveInspection' process.
   *
   * @param {string} id - The UUID of the inspection to log changes for.
   * @param {UpdateInspectionDto} updateInspectionDto - DTO containing the potential changes.
   * @param {string} userId - ID of the user performing the action (reviewer/admin).
   * @param {Role} userRole - Role of the user (for logging or future auth).
   * @returns {Promise<Inspection>} The existing (unchanged) inspection record.
   * @throws {NotFoundException} If the inspection with the given ID is not found.
   * @throws {BadRequestException} If trying to update an already approved inspection.
   * @throws {InternalServerErrorException} For database errors during logging.
   */
  async update(
    id: string,
    updateInspectionDto: UpdateInspectionDto,
    userId: string,
    userRole: Role, // Included for context, though not used for auth in this specific method
  ): Promise<Inspection> {
    this.logger.log(
      `User ${userId} (Role: ${userRole}) attempting to log/stage changes for inspection ID: ${id}`,
    );
    this.logger.debug(
      'Update DTO received:',
      JSON.stringify(updateInspectionDto, null, 2),
    );

    // 1. Fetch the existing inspection to compare against
    const existingInspection = await this.prisma.inspection.findUnique({
      where: { id },
    });

    if (!existingInspection) {
      throw new NotFoundException(`Inspection with ID "${id}" not found.`);
    }

    // Check: Prevent logging changes for already approved or archived inspections
    // This logic might be better suited in the controller or a specific "edit" phase
    if (
      existingInspection.status === InspectionStatus.APPROVED ||
      existingInspection.status === InspectionStatus.ARCHIVED ||
      existingInspection.status === InspectionStatus.ARCHIVING
    ) {
      throw new BadRequestException(
        `Inspection with ID "${id}" has status ${existingInspection.status} and cannot be updated or have changes logged at this stage.`,
      );
    }

    // 2. Initialize array to store change log entries
    const changesToLog: Prisma.InspectionChangeLogCreateManyInput[] = [];

    // Define which top-level fields in Inspection are JSON and should be deep compared
    const jsonFieldsInInspectionModel: Array<
      keyof UpdateInspectionDto & keyof Inspection
    > = [
      'identityDetails',
      'vehicleData',
      'equipmentChecklist',
      'inspectionSummary',
      'detailedAssessment',
      'bodyPaintThickness',
    ];

    // Iterate over the keys in the DTO (fields intended to be updated)
    for (const key in updateInspectionDto) {
      if (Object.hasOwn(updateInspectionDto, key)) {
        const dtoKey = key as keyof UpdateInspectionDto;
        const newValue = updateInspectionDto[dtoKey]; // Value from the DTO
        const oldValue = (existingInspection as any)[dtoKey]; // Current value from DB

        if (newValue === undefined) continue; // Skip if DTO field is undefined (not meant to be updated)

        if (jsonFieldsInInspectionModel.includes(dtoKey as any)) {
          this.logger.verbose(`Comparing JSON field: ${dtoKey}`);
          // For JSON fields, newValue from DTO is an object. oldValue from DB is also object/null.
          this.logJsonChangesRecursive(
            dtoKey,
            oldValue, // This is the full old JSON object for this field
            newValue, // This is the partial or full new JSON object for this field from DTO
            changesToLog,
            id,
            userId,
            [], // Start with an empty path for the top-level JSON field
          );
        } else {
          // Handle non-JSON, top-level fields (e.g., vehiclePlateNumber)
          const oldValToLog =
            oldValue === undefined || oldValue === null
              ? Prisma.JsonNull
              : oldValue;
          const newValToLog =
            newValue === undefined || newValue === null
              ? Prisma.JsonNull
              : newValue;

          // Add validation for specific top-level fields if needed
          if (dtoKey === 'vehiclePlateNumber' && typeof newValue === 'string') {
            const maxLength = 15; // Corresponds to @db.VarChar(15) in schema.prisma
            if (newValue.length > maxLength) {
              throw new BadRequestException(
                `Value for ${dtoKey} exceeds maximum length of ${maxLength} characters.`,
              );
            }
          }
          // Add similar checks for other non-JSON fields if they have length constraints

          if (JSON.stringify(oldValToLog) !== JSON.stringify(newValToLog)) {
            this.logger.verbose(
              `Logging change for top-level non-JSON field: ${dtoKey}`,
            );
            changesToLog.push({
              inspectionId: id,
              changedByUserId: userId,
              fieldName: dtoKey,
              subFieldName: null,
              subsubfieldname: null,
              oldValue: oldValToLog,
              newValue: newValToLog,
            });
          }
        }
      }
    }

    // 3. Save all detected changes to the InspectionChangeLog table
    if (changesToLog.length > 0) {
      try {
        await this.prisma.inspectionChangeLog.createMany({
          data: changesToLog,
        });
        this.logger.log(
          `Logged ${changesToLog.length} changes for inspection ID: ${id}`,
        );
      } catch (error: any) {
        this.logger.error(
          `Failed to log changes for inspection ID ${id}: ${error.message}`,
          error.stack,
        );
        throw new InternalServerErrorException(
          'Could not save inspection change logs.',
        );
      }
    } else {
      this.logger.log(
        `No significant changes detected to log for inspection ID: ${id}`,
      );
    }

    // 4. Return the existing (unmodified by this method) inspection record.
    // The actual update to the 'inspections' table happens in 'approveInspection'.
    return existingInspection;
  }

  /**
   * Retrieves all inspection records, ordered by creation date descending.
   * Filters results based on the requesting user's role.
   * Admins/Reviewers see all. Customers/Developers/Inspectors only see ARCHIVED.
   * Includes pagination and metadata.
   *
   * @param {Role} userRole - The role of the user making the request.
   * @param {number} page - The page number (1-based).
   * @param {number} pageSize - The number of items per page.
   * @returns {Promise<{ data: Inspection[], meta: { total: number, page: number, pageSize: number, totalPages: number } }>} An object containing an array of inspection records and pagination metadata.
   */
  async findAll(
    userRole: Role,
    status?: InspectionStatus,
    page: number = 1,
    pageSize: number = 10,
  ): Promise<{
    data: Inspection[];
    meta: { total: number; page: number; pageSize: number; totalPages: number };
  }> {
    this.logger.log(
      `Retrieving inspections for user role: ${userRole}, status: ${status ?? 'ALL'}, page: ${page}, pageSize: ${pageSize}`,
    );
    let whereClause: Prisma.InspectionWhereInput = {}; // Default: no filter

    // Add status filter if provided
    if (status) {
      whereClause.status = status;
      this.logger.log(`Applying filter: status = ${status}`);
    }

    const skip = (page - 1) * pageSize;
    if (skip < 0) {
      throw new BadRequestException('Page number must be positive.');
    }

    // Apply filter based on role for non-admin/reviewer roles
    if (
      userRole === Role.CUSTOMER ||
      userRole === Role.DEVELOPER ||
      userRole === Role.INSPECTOR
    ) {
      whereClause = {
        status: InspectionStatus.ARCHIVED,
        // Add deactivatedAt check if needed: deactivatedAt: null
      };
      this.logger.log('Applying filter: status = ARCHIVED');
    }
    // Apply filter based on role for non-admin/reviewer roles ONLY if no status filter is provided
    if (
      !status && // Only apply this default if no status is explicitly requested
      (userRole === Role.CUSTOMER ||
        userRole === Role.DEVELOPER ||
        userRole === Role.INSPECTOR)
    ) {
      whereClause.status = InspectionStatus.ARCHIVED;
      this.logger.log(
        'Applying default filter for non-admin/reviewer: status = ARCHIVED',
      );
    }
    // TODO: Consider if INSPECTOR should see their own NEED_REVIEW inspections?

    try {
      const total = await this.prisma.inspection.count({ where: whereClause });
      const inspections = await this.prisma.inspection.findMany({
        where: whereClause,
        orderBy: {
          createdAt: 'desc', // Order by newest first
        },
        skip: skip,
        take: pageSize,
        include: { photos: true }, // Include related photos
        // include: { inspector: { select: {id: true, name: true}}, reviewer: { select: {id: true, name: true}} } // Example include
      });
      this.logger.log(
        `Retrieved ${inspections.length} inspections for role ${userRole}. Total: ${total}`,
      );
      const totalPages = Math.ceil(total / pageSize);
      return {
        data: inspections,
        meta: {
          total,
          page,
          pageSize,
          totalPages,
        },
      };
    } catch (error: any) {
      // Reverted to any
      this.logger.error(
        `Failed to retrieve inspections for role ${userRole}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Could not retrieve inspection data.',
      );
    }
  }

  /**
   * Retrieves a single inspection by ID.
   * Applies status-based filtering for non-admin/reviewer roles.
   *
   * @param {string} id - The UUID of the inspection.
   * @param {Role} userRole - The role of the requesting user.
   * @returns {Promise<Inspection>} The found inspection record.
   * @throws {NotFoundException} If inspection not found.
   * @throws {ForbiddenException} If user role doesn't have permission to view the inspection in its current status.
   */
  async findOne(id: string, userRole: Role): Promise<Inspection> {
    this.logger.log(
      `Retrieving inspection ID: ${id} for user role: ${userRole}`,
    );
    try {
      const inspection = await this.prisma.inspection.findUniqueOrThrow({
        where: { id: id },
        include: { photos: true }, // Include related photos
        // include: { inspector: true, reviewer: true } // Include related users if needed
      });

      // Check authorization based on role and status
      if (userRole === Role.ADMIN || userRole === Role.REVIEWER) {
        this.logger.log(`Admin/Reviewer access granted for inspection ${id}`);
        return inspection; // Admins/Reviewers can see all statuses
      } else if (inspection.status === InspectionStatus.ARCHIVED) {
        // TODO: Potentially check deactivatedAt here too?
        // if (inspection.deactivatedAt !== null) { throw new ForbiddenException(...); }
        this.logger.log(
          `Public/Inspector access granted for ARCHIVED inspection ${id}`,
        );
        return inspection; // Others can only see ARCHIVED
      } else {
        // If found but not ARCHIVED, and user is not Admin/Reviewer
        this.logger.warn(
          `Access denied for user role ${userRole} on inspection ${id} with status ${inspection.status}`,
        );
        throw new ForbiddenException(
          `You do not have permission to view this inspection in its current status (${inspection.status}).`,
        );
      }
    } catch (error: any) {
      // Reverted to any
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Inspection with ID "${id}" not found.`);
      }
      if (error instanceof ForbiddenException) {
        // Re-throw ForbiddenException
        throw error;
      }
      this.logger.error(
        `Failed to retrieve inspection ID ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Could not retrieve inspection ${id}.`,
      );
    }
  }

  /**
   * Approves an inspection, applies the latest logged change for each field,
   * generates and stores the PDF, calculates its hash, and changes status to APPROVED.
   * Fetches the latest changes from InspectionChangeLog and updates the Inspection record.
   * Records the reviewer ID and optionally clears applied change logs.
   *
   * @param {string} inspectionId - The UUID of the inspection to approve.
   * @param {string} reviewerId - The UUID of the user (REVIEWER/ADMIN) approving.
   * @returns {Promise<Inspection>} The updated inspection record.
   * @throws {NotFoundException} If inspection not found.
   * @throws {BadRequestException} If inspection is not in NEED_REVIEW or FAIL_ARCHIVE state.
   * @throws {InternalServerErrorException} For database errors or PDF generation issues.
   */
  async approveInspection(
    inspectionId: string,
    reviewerId: string,
  ): Promise<Inspection> {
    this.logger.log(
      `Reviewer ${reviewerId} attempting to approve inspection ${inspectionId}`,
    );

    // 1. Find the inspection and validate status
    const inspection = await this.prisma.inspection.findUnique({
      where: { id: inspectionId },
    });

    if (!inspection) {
      throw new NotFoundException(
        `Inspection with ID "${inspectionId}" not found for approval.`,
      );
    }

    if (
      inspection.status !== InspectionStatus.NEED_REVIEW &&
      inspection.status !== InspectionStatus.FAIL_ARCHIVE
    ) {
      throw new BadRequestException(
        `Inspection ${inspectionId} cannot be approved. Current status is '${inspection.status}'. Required: '${InspectionStatus.NEED_REVIEW}' or '${InspectionStatus.FAIL_ARCHIVE}'.`,
      );
    }

    const frontendReportUrl = `${this.config.getOrThrow<string>(
      'CLIENT_BASE_URL',
    )}/data/${inspection.pretty_id}`;
    let pdfBuffer: Buffer;
    let pdfHashString: string | null = null;
    const pdfFileName = `${inspection.pretty_id}-${Date.now()}.pdf`; // Nama file unik
    const pdfFilePath = path.join(PDF_ARCHIVE_PATH, pdfFileName);
    const pdfPublicUrl = `${PDF_PUBLIC_BASE_URL}/${pdfFileName}`; // URL publik

    try {
      // Generate PDF from URL
      pdfBuffer = await this.generatePdfFromUrl(frontendReportUrl);

      // Save PDF to Disc
      await fs.writeFile(pdfFilePath, pdfBuffer);
      this.logger.log(`PDF report saved to: ${pdfFilePath}`);

      // Calculate PDF Hash
      const hash = crypto.createHash('sha256');
      hash.update(pdfBuffer);
      pdfHashString = hash.digest('hex');
      this.logger.log(`PDF hash calculated: ${pdfHashString}`);
    } catch (error: any) {
      // Reverted to any
      this.logger.error(
        `Failed to generate or save PDF for inspection ${inspectionId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to generate or save PDF report.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // 2. Fetch the latest change log for each field
      const latestChanges = await tx.inspectionChangeLog.findMany({
        where: { inspectionId: inspectionId },
        orderBy: { changedAt: 'asc' },
      });

      // Group changes by fieldName, subFieldName, and subsubfieldname
      const groupedChanges: { [key: string]: InspectionChangeLog[] } = {};
      for (const log of latestChanges) {
        let key = log.fieldName;
        if (log.subFieldName) {
          key += `.${log.subFieldName}`;
          if (log.subsubfieldname) {
            key += `.${log.subsubfieldname}`;
          }
        }
        if (!groupedChanges[key]) {
          groupedChanges[key] = [];
        }
        groupedChanges[key].push(log);
      }

      // Get the latest change for each field
      const latestValues: { [key: string]: any } = {};
      for (const key in groupedChanges) {
        if (groupedChanges.hasOwnProperty(key)) {
          const logs = groupedChanges[key];
          // Sort by changedAt descending and take the first one
          logs.sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime());
          const latestLog = logs[0];
          if (latestLog) {
            latestValues[key] = latestLog.newValue;
          }
        }
      }

      // 3. Apply the latest changes to the inspection data
      const updatedInspectionData: any = { ...inspection };

      // Define which top-level fields in Inspection are JSON and can be updated via change log
      const jsonUpdatableFields: string[] = [
        'identityDetails',
        'vehicleData',
        'equipmentChecklist',
        'inspectionSummary',
        'detailedAssessment',
        'bodyPaintThickness',
      ];

      for (const key in latestValues) {
        if (latestValues.hasOwnProperty(key)) {
          const value = latestValues[key];
          const parts = key.split('.'); // Split key into parts
          const fieldName = parts[0];

          if (parts.length === 1) {
            // Handle top-level fields (fieldName only) - Apply regardless of JSON updatable list
            const fieldName = parts[0];
            this.logger.debug(
              `Applying top-level change: key=${key}, value=${JSON.stringify(value)}, fieldName=${fieldName}`,
            ); // Added logging
            // Only attempt to update if the field exists in the original inspection object
            if (inspection.hasOwnProperty(fieldName)) {
              try {
                // Added try block
                // Explicitly check for null/undefined before assigning
                if (value !== null && value !== undefined) {
                  updatedInspectionData[fieldName] = value;
                } else {
                  // If the latest value is null/undefined, explicitly set the field to null
                  updatedInspectionData[fieldName] = null; // Or Prisma.JsonNull
                }
              } catch (error: any) {
                // Added catch block
                if (
                  error instanceof Prisma.PrismaClientKnownRequestError &&
                  error.code === 'P2000'
                ) {
                  this.logger.warn(
                    `Skipping application of change log for field "${fieldName}" due to value being too long or incompatible: ${JSON.stringify(value)}. Error: ${error.message}`,
                  );
                } else {
                  // Re-throw other errors
                  throw error;
                }
              }
            } else {
              this.logger.warn(
                `Attempted to apply change log for non-existent or non-updatable top-level field: ${key}. Ignoring.`,
              );
            }
          } else {
            // Handle nested fields (subFieldName or subsubfieldname)
            // Only apply nested changes if the fieldName is one of the designated JSON updatable fields
            if (jsonUpdatableFields.includes(fieldName)) {
              if (parts.length === 2) {
                // Handle subFieldName (one level deep)
                const subFieldName = parts[1];
                if (
                  updatedInspectionData[fieldName] &&
                  typeof updatedInspectionData[fieldName] === 'object'
                ) {
                  updatedInspectionData[fieldName] = {
                    ...updatedInspectionData[fieldName],
                    [subFieldName]: value,
                  };
                } else {
                  // If the parent object doesn't exist or is not an object, create it
                  updatedInspectionData[fieldName] = {
                    [subFieldName]: value,
                  };
                }
              } else if (parts.length === 3) {
                // Handle subsubfieldname (two levels deep)
                const subFieldName = parts[1];
                const subsubfieldname = parts[2];
                if (
                  updatedInspectionData[fieldName] &&
                  typeof updatedInspectionData[fieldName] === 'object' &&
                  updatedInspectionData[fieldName][subFieldName] &&
                  typeof updatedInspectionData[fieldName][subFieldName] ===
                    'object'
                ) {
                  updatedInspectionData[fieldName][subFieldName] = {
                    ...updatedInspectionData[fieldName][subFieldName],
                    [subsubfieldname]: value,
                  };
                } else if (
                  updatedInspectionData[fieldName] &&
                  typeof updatedInspectionData[fieldName] === 'object'
                ) {
                  // If the sub-field object doesn't exist or is not an object, create it
                  updatedInspectionData[fieldName] = {
                    ...updatedInspectionData[fieldName],
                    [subFieldName]: {
                      [subsubfieldname]: value,
                    },
                  };
                } else {
                  // If the top-level field doesn't exist or is not an object, create it and nested objects
                  updatedInspectionData[fieldName] = {
                    [subFieldName]: {
                      [subsubfieldname]: value,
                    },
                  };
                }
              }
              // Ignore parts.length > 3 for now, as logging is limited to 3 levels
            } else {
              this.logger.warn(
                `Attempted to apply nested change log for non-JSON field: ${key}. Ignoring.`,
              );
              // Optionally, log a warning or handle this case differently
            }
          }
        }
      }

      // 4. Update the Inspection record in the database
      const updatedInspection = await tx.inspection.update({
        where: { id: inspectionId },
        data: {
          ...updatedInspectionData,
          status: InspectionStatus.APPROVED,
          reviewerId: reviewerId,
          urlPdf: pdfPublicUrl,
          pdfFileHash: pdfHashString,
        },
      });

      this.logger.log(
        `Inspection ${inspectionId} approved and updated with latest logged changes by reviewer ${reviewerId}`,
      );
      return updatedInspection;
    });
  }

  /**
   * Generates PDF from a frontend URL using Puppeteer.
   * @param url The URL of the frontend page to render.
   * @returns A Buffer containing the generated PDF data.
   */
  private async generatePdfFromUrl(url: string): Promise<Buffer> {
    let browser: Browser | null = null;
    this.logger.log(`Generating PDF from URL: ${url}`);
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          // Tambahkan argumen lain jika perlu (misal proxy, ignore https errors)
          '--disable-dev-shm-usage', // Penting di beberapa environment Docker/terbatas
          '--disable-gpu', // Kadang membantu di server tanpa GPU
        ],
        // Tentukan executablePath jika puppeteer tidak bisa menemukannya otomatis di server
        // executablePath: '/usr/bin/google-chrome-stable',
      });
      const page = await browser.newPage();
      await page.goto(url, {
        waitUntil: 'networkidle0', // Tunggu network tenang
        timeout: 60000, // Tambahkan timeout (misal 60 detik)
      });

      // Opsional: Tunggu selector spesifik jika networkidle0 tidak cukup
      // await page.waitForSelector('#report-ready-indicator', { timeout: 30000 });

      const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
      this.logger.log(`PDF buffer generated successfully from ${url}`);
      return Buffer.from(pdfBuffer);
    } catch (error: any) {
      // Reverted to any
      this.logger.error(
        `Failed to generate PDF from URL ${url}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Could not generate PDF report from URL: ${error.message}`,
      );
    } finally {
      if (browser) {
        await browser.close(); // Pastikan browser SELALU ditutup
        this.logger.log(`Puppeteer browser closed for URL: ${url}`);
      }
    }
  }

  /**
   * Processes an approved inspection for archiving.
   * Fetches the content from the provided URL, converts it to PDF, calculates its hash,
   * simulates blockchain interaction, and updates the inspection status to ARCHIVED or FAIL_ARCHIVE.
   *
   * @param {string} inspectionId - The UUID of the inspection to archive.
   * @param {string} userId - The ID of the user initiating the archive (ADMIN/REVIEWER).
   * @returns {Promise<Inspection>} The final updated inspection record.
   * @throws {NotFoundException} If inspection not found.
   * @throws {BadRequestException} If inspection is not in NEED_REVIEW or FAIL_ARCHIVE state.
   * @throws {InternalServerErrorException} For database errors.
   */
  async processToArchive(
    inspectionId: string,
    userId: string,
  ): Promise<Inspection> {
    this.logger.log(
      `User ${userId} starting archive process for inspection ${inspectionId}`,
    );

    // 1. Find the inspection and validate status
    const inspection = await this.prisma.inspection.findUnique({
      where: { id: inspectionId },
    });
    if (!inspection)
      throw new NotFoundException(
        `Inspection ${inspectionId} not found for archiving.`,
      );
    if (inspection.status !== InspectionStatus.APPROVED) {
      throw new BadRequestException(
        `Inspection ${inspectionId} cannot be archived. Status is ${inspection.status}, requires ${InspectionStatus.APPROVED}.`,
      );
    }

    try {
      // 2. Minting
      let blockchainResult: { txHash: string; assetId: string } | null = null;
      let blockchainSuccess = false;

      try {
        const metadataForNft: any = {
          vehicleNumber: inspection.vehiclePlateNumber,
          pdfHash: inspection.pdfFileHash,
        };
        // Hapus field null/undefined dari metadata jika perlu
        Object.keys(metadataForNft).forEach((key) =>
          metadataForNft[key] === undefined || metadataForNft[key] === null
            ? delete metadataForNft[key]
            : {},
        );

        this.logger.log(
          `Calling blockchainService.mintInspectionNft for inspection ${inspectionId}`,
        );
        blockchainResult =
          await this.blockchainService.mintInspectionNft(metadataForNft); // Panggil service minting
        blockchainSuccess = true;
        this.logger.log(
          `Blockchain interaction SUCCESS for inspection ${inspectionId}`,
        );
      } catch (blockchainError: any) {
        // Reverted to any
        // Explicitly type error as any for now
        this.logger.error(
          `Blockchain interaction FAILED for inspection ${inspectionId}`,
          blockchainError.stack,
        );
        blockchainSuccess = false;
      }

      // 3. Update Inspection Record in DB (Final Status)
      const finalStatus = blockchainSuccess
        ? InspectionStatus.ARCHIVED
        : InspectionStatus.FAIL_ARCHIVE;
      const updateData: Prisma.InspectionUpdateInput = {
        status: finalStatus,
        nftAssetId: blockchainResult?.assetId || null,
        blockchainTxHash: blockchainResult?.txHash || null,
        archivedAt: blockchainSuccess ? new Date() : null,
      };
      const finalInspection = await this.prisma.inspection.update({
        where: { id: inspectionId },
        data: updateData,
      });
      this.logger.log(
        `Inspection ${inspectionId} final status set to ${finalStatus}.`,
      );
      return finalInspection;
    } catch (error: any) {
      // Reverted to any
      // Explicitly type error as any for now
      // Catch errors from URL fetch, PDF conversion, file saving, hashing, or the final DB update
      this.logger.error(
        `Archiving process failed during PDF generation or subsequent steps for inspection ${inspectionId}: ${error.message}`,
        error.stack,
      );

      // Attempt to revert status if stuck in ARCHIVING (best effort)
      try {
        await this.prisma.inspection.updateMany({
          where: { id: inspectionId, status: InspectionStatus.ARCHIVING },
          data: { status: InspectionStatus.FAIL_ARCHIVE },
        });
        this.logger.log(
          `Inspection ${inspectionId} status reverted to FAIL_ARCHIVE due to error.`,
        );
      } catch (revertError: any) {
        // Reverted to any
        // Explicitly type error as any for now
        this.logger.error(
          `Failed to revert status from ARCHIVING for inspection ${inspectionId} after error`,
          revertError.stack,
        );
      }

      // Re-throw appropriate error
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      )
        throw error;
      throw new InternalServerErrorException(
        `Archiving process failed for inspection ${inspectionId}.`,
      );
    }
  }

  /**
   * Deactivates an archived inspection record.
   * Changes status from ARCHIVED to DEACTIVATED.
   *
   * @param {string} inspectionId - The UUID of the inspection to deactivate.
   * @param {string} userId - The ID of the user performing the action (ADMIN).
   * @returns {Promise<Inspection>} The updated inspection record.
   * @throws {NotFoundException|BadRequestException} If not found or not ARCHIVED.
   */
  async deactivateArchive(
    inspectionId: string,
    userId: string,
  ): Promise<Inspection> {
    this.logger.log(
      `User ${userId} attempting to deactivate inspection ${inspectionId}`,
    );
    try {
      const result = await this.prisma.inspection.updateMany({
        where: {
          id: inspectionId,
          status: InspectionStatus.ARCHIVED,
        },
        data: {
          status: InspectionStatus.DEACTIVATED,
          deactivatedAt: new Date(),
        },
      });

      if (result.count === 0) {
        const exists = await this.prisma.inspection.findUnique({
          where: { id: inspectionId },
          select: { status: true },
        });
        if (!exists) {
          throw new NotFoundException(
            `Inspection with ID "${inspectionId}" not found.`,
          );
        } else {
          throw new BadRequestException(
            `Inspection ${inspectionId} cannot be deactivated because its current status is '${exists.status}', not '${InspectionStatus.ARCHIVED}'.`,
          );
        }
      }
      this.logger.log(
        `Inspection ${inspectionId} reactivated by user ${userId}`,
      );
      return this.prisma.inspection.findUniqueOrThrow({
        where: { id: inspectionId },
      });
    } catch (error: any) {
      // Reverted to any
      // Explicitly type error as any for now
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      )
        throw error;
      this.logger.error(
        `Failed to reactivate inspection ${inspectionId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Could not reactivate inspection ${inspectionId}.`,
      );
    }
  }

  /**
   * Reactivates a deactivated inspection record.
   * Changes status from DEACTIVATED back to ARCHIVED.
   *
   * @param {string} inspectionId - The UUID of the inspection to reactivate.
   * @param {string} userId - The ID of the user performing the action (ADMIN).
   * @returns {Promise<Inspection>} The updated inspection record.
   * @throws {NotFoundException|BadRequestException} If not found or not DEACTIVATED.
   */
  async activateArchive(
    inspectionId: string,
    userId: string,
  ): Promise<Inspection> {
    this.logger.log(
      `User ${userId} attempting to reactivate inspection ${inspectionId}`,
    );
    try {
      const result = await this.prisma.inspection.updateMany({
        where: {
          id: inspectionId,
          status: InspectionStatus.DEACTIVATED,
        },
        data: {
          status: InspectionStatus.ARCHIVED,
          deactivatedAt: null, // Clear deactivation timestamp
        },
      });

      if (result.count === 0) {
        const exists = await this.prisma.inspection.findUnique({
          where: { id: inspectionId },
          select: { status: true },
        });
        if (!exists) {
          throw new NotFoundException(
            `Inspection with ID "${inspectionId}" not found.`,
          );
        } else {
          throw new BadRequestException(
            `Inspection ${inspectionId} cannot be reactivated because its current status is '${exists.status}', not '${InspectionStatus.DEACTIVATED}'.`,
          );
        }
      }
      this.logger.log(
        `Inspection ${inspectionId} reactivated by user ${userId}`,
      );
      return this.prisma.inspection.findUniqueOrThrow({
        where: { id: inspectionId },
      });
    } catch (error: any) {
      // Reverted to any
      // Explicitly type error as any for now
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      )
        throw error;
      this.logger.error(
        `Failed to reactivate inspection ${inspectionId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Could not reactivate inspection ${inspectionId}.`,
      );
    }
  }
}
