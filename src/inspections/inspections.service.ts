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
import { Inspection, InspectionStatus, Prisma, Role } from '@prisma/client'; // Prisma generated types (Inspection model, Prisma namespace)
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
   * @returns {Promise<Inspection>} The created inspection record.
   */
  async create(createInspectionDto: CreateInspectionDto): Promise<Inspection> {
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
          return newInspection;
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
   * Logs changes made to an inspection record by a reviewer.
   * Changes are recorded in the InspectionChangeLog table.
   * The actual Inspection record is NOT updated by this method.
   *
   * @param {string} id - The UUID of the inspection to log changes for.
   * @param {UpdateInspectionDto} updateInspectionDto - DTO containing the potential changes.
   * @param {string} userId - ID of the user performing the action (reviewer).
   * @param {Role} userRole - Role of the user.
   * @returns {Promise<Inspection>} The existing inspection record (after logging changes).
   * @throws {NotFoundException} If the inspection with the given ID is not found.
   * @throws {InternalServerErrorException} For database errors during logging.
   */
  async update(
    id: string,
    updateInspectionDto: UpdateInspectionDto,
    userId: string, // User performing the update (reviewer)
    userRole: Role, // Role of the user
  ): Promise<Inspection> {
    this.logger.log(
      `User ${userId} (Role: ${userRole}) attempting to log changes for inspection ID: ${id}`,
    );
    this.logger.debug(
      'Update DTO received:',
      JSON.stringify(updateInspectionDto, null, 2),
    );

    // 1. Fetch the existing inspection
    const existingInspection = await this.prisma.inspection.findUnique({
      where: { id },
    });

    if (!existingInspection) {
      throw new NotFoundException(`Inspection with ID "${id}" not found.`);
    }

    // Add check to prevent updating approved inspections
    if (existingInspection.status === InspectionStatus.APPROVED) {
      throw new BadRequestException(
        `Inspection with ID "${id}" has already been approved and cannot be updated.`,
      );
    }

    // 2. Compare data and log changes
    const changesToLog: Prisma.InspectionChangeLogCreateManyInput[] = [];

    // Helper function to compare values and add to changesToLog
    const addChangeIfDifferent = (
      fieldName: string,
      oldValue: any, // Consider more specific types if possible
      newValue: any, // Consider more specific types if possible
    ) => {
      // Simple comparison for primitive types and JSON (comparing JSON objects directly might not work as expected,
      // comparing stringified versions or using a deep comparison library is better for production)
      // For simplicity here, we'll do a basic check. A robust solution needs deep comparison for JSON.
      const oldValueJson =
        oldValue !== undefined ? JSON.stringify(oldValue) : undefined;
      const newValueJson =
        newValue !== undefined ? JSON.stringify(newValue) : undefined;

      if (newValueJson !== undefined && oldValueJson !== newValueJson) {
        changesToLog.push({
          inspectionId: id,
          changedByUserId: userId,
          fieldName: fieldName,
          oldValue: oldValue, // Store original types or stringified
          newValue: newValue, // Store original types or stringified
        });
      }
    };

    // Compare fields from DTO with existing data
    if (updateInspectionDto.vehiclePlateNumber !== undefined) {
      addChangeIfDifferent(
        'vehiclePlateNumber',
        existingInspection.vehiclePlateNumber,
        updateInspectionDto.vehiclePlateNumber,
      );
    }
    if (updateInspectionDto.inspectionDate !== undefined) {
      // Compare dates as ISO strings or timestamps
      const existingDate =
        existingInspection.inspectionDate?.toISOString() ?? null;
      const newDate = updateInspectionDto.inspectionDate
        ? new Date(updateInspectionDto.inspectionDate).toISOString()
        : null;
      addChangeIfDifferent('inspectionDate', existingDate, newDate);
    }
    if (updateInspectionDto.overallRating !== undefined) {
      addChangeIfDifferent(
        'overallRating',
        existingInspection.overallRating,
        updateInspectionDto.overallRating,
      );
    }
    // Compare JSON fields (requires careful handling for nested changes)
    // A simple approach is to log the entire JSON object if it changes.
    // A more granular approach would involve deep comparison of JSON structures.
    if (updateInspectionDto.identityDetails !== undefined) {
      addChangeIfDifferent(
        'identityDetails',
        existingInspection.identityDetails,
        updateInspectionDto.identityDetails,
      );
    }
    if (updateInspectionDto.vehicleData !== undefined) {
      addChangeIfDifferent(
        'vehicleData',
        existingInspection.vehicleData,
        updateInspectionDto.vehicleData,
      );
    }
    if (updateInspectionDto.equipmentChecklist !== undefined) {
      addChangeIfDifferent(
        'equipmentChecklist',
        existingInspection.equipmentChecklist,
        updateInspectionDto.equipmentChecklist,
      );
    }
    if (updateInspectionDto.inspectionSummary !== undefined) {
      addChangeIfDifferent(
        'inspectionSummary',
        existingInspection.inspectionSummary,
        updateInspectionDto.inspectionSummary,
      );
    }
    if (updateInspectionDto.detailedAssessment !== undefined) {
      addChangeIfDifferent(
        'detailedAssessment',
        existingInspection.detailedAssessment,
        updateInspectionDto.detailedAssessment,
      );
    }
    if (updateInspectionDto.bodyPaintThickness !== undefined) {
      addChangeIfDifferent(
        'bodyPaintThickness',
        existingInspection.bodyPaintThickness,
        updateInspectionDto.bodyPaintThickness,
      );
    }

    // 3. Save changes to InspectionChangeLog
    if (changesToLog.length > 0) {
      try {
        // Use createMany for efficiency if logging multiple changes
        await this.prisma.inspectionChangeLog.createMany({
          data: changesToLog,
        });
        this.logger.log(
          `Logged ${changesToLog.length} changes for inspection ID: ${id}`,
        );
      } catch (error: any) {
        // Reverted to any
        // Keep any for now, will refine later
        this.logger.error(
          `Failed to log changes for inspection ID ${id}: ${error.message}`,
          error.stack,
        );
        // Decide how to handle logging failure - throw error or just log?
        // For now, we'll throw to indicate the save operation failed.
        throw new InternalServerErrorException(
          'Could not save inspection change logs.',
        );
      }
    } else {
      this.logger.log(`No changes detected for inspection ID: ${id}`);
    }

    // 4. Return the existing inspection (update to Inspection table happens on approve)
    // We might want to return the inspection with the *applied* changes for the frontend to preview,
    // but the plan is to only apply on approve. So, returning the current state is fine for now.
    // A more advanced approach would be to apply changes in memory and return that object.
    return existingInspection; // Return the inspection as it is in the DB
  }

  /**
   * Retrieves all inspection records, ordered by creation date descending.
   * Filters results based on the requesting user's role.
   * Admins/Reviewers see all. Customers/Developers/Inspectors only see ARCHIVED.
   * (Pagination to be added later).
   *
   * @param {Role} userRole - The role of the user making the request.
   * @returns {Promise<Inspection[]>} An array of inspection records.
   */
  async findAll(userRole: Role): Promise<Inspection[]> {
    this.logger.log(`Retrieving inspections for user role: ${userRole}`);
    let whereClause: Prisma.InspectionWhereInput = {}; // Default: no filter

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
    // TODO: Consider if INSPECTOR should see their own NEED_REVIEW inspections?

    try {
      const inspections = await this.prisma.inspection.findMany({
        where: whereClause,
        orderBy: {
          createdAt: 'desc', // Order by newest first
        },
        include: { photos: true }, // Include related photos
        // include: { inspector: { select: {id: true, name: true}}, reviewer: { select: {id: true, name: true}} } // Example include
      });
      this.logger.log(
        `Retrieved ${inspections.length} inspections for role ${userRole}.`,
      );
      return inspections;
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
   * Approves an inspection, applies logged changes, and changes status to APPROVED.
   * Fetches latest changes from InspectionChangeLog and updates the Inspection record.
   * Records the reviewer ID and optionally clears applied change logs.
   *
   * @param {string} inspectionId - The UUID of the inspection to approve.
   * @param {string} reviewerId - The UUID of the user (REVIEWER/ADMIN) approving.
   * @returns {Promise<Inspection>} The updated inspection record.
   * @throws {NotFoundException} If inspection not found.
   * @throws {BadRequestException} If inspection is not in NEED_REVIEW or FAIL_ARCHIVE state.
   * @throws {InternalServerErrorException} For database errors.
   */
  async approveInspection(
    inspectionId: string,
    reviewerId: string,
  ): Promise<Inspection> {
    this.logger.log(
      `Reviewer ${reviewerId} attempting to approve inspection ${inspectionId}`,
    );

    return this.prisma.$transaction(async (tx) => {
      // 1. Find the inspection and validate status within the transaction
      const inspection = await tx.inspection.findUnique({
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

      // 2. Fetch the latest changes from InspectionChangeLog for this inspection
      const changeLogs = await tx.inspectionChangeLog.findMany({
        where: { inspectionId: inspectionId },
        orderBy: { changedAt: 'asc' }, // Apply changes in order
      });

      // 3. Apply changes to the inspection data in memory
      const updatedInspectionData: any = { ...inspection }; // Create a mutable copy

      for (const log of changeLogs) {
        // Simple approach: apply changes directly.
        // For nested JSON, a more sophisticated approach is needed.
        // This simple approach assumes fieldName is a top-level key or uses dot notation
        // which would require parsing fieldName and traversing the object.
        // For this implementation, we'll assume top-level or simple dot notation that can be handled.
        // A robust solution for deep JSON updates would involve a helper function.

        // Basic handling for top-level or simple dot notation (e.g., "vehicleData.merekKendaraan")
        const fieldPath = log.fieldName.split('.');
        let currentLevel: any = updatedInspectionData;
        for (let i = 0; i < fieldPath.length - 1; i++) {
          if (
            currentLevel[fieldPath[i]] === undefined ||
            currentLevel[fieldPath[i]] === null
          ) {
            currentLevel[fieldPath[i]] = {}; // Initialize if undefined/null for nested paths
          }
          currentLevel = currentLevel[fieldPath[i]];
        }
        // Apply the new value at the final level
        currentLevel[fieldPath[fieldPath.length - 1]] = log.newValue;
      }

      // 4. Update the Inspection record in the database with applied changes and status
      const updatedInspection = await tx.inspection.update({
        where: { id: inspectionId },
        data: {
          ...updatedInspectionData, // Apply all fields from the modified object
          status: InspectionStatus.APPROVED,
          reviewerId: reviewerId,
        },
      });

      // 5. Optionally, clear the applied change logs
      if (changeLogs.length > 0) {
        await tx.inspectionChangeLog.deleteMany({
          where: { inspectionId: inspectionId },
        });
        this.logger.log(
          `Cleared ${changeLogs.length} change logs for inspection ID: ${inspectionId}`,
        );
      }

      this.logger.log(
        `Inspection ${inspectionId} approved and updated with logged changes by reviewer ${reviewerId}`,
      );
      return updatedInspection; // Return the final updated record
    }); // Transaction ends here
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

    // 2. Update status to ARCHIVING
    try {
      await this.prisma.inspection.update({
        where: { id: inspectionId },
        data: { status: InspectionStatus.ARCHIVING },
      });
      this.logger.log(`Inspection ${inspectionId} status set to ARCHIVING.`);
    } catch (updateError: any) {
      // Reverted to any
      // Explicitly type error as any for now
      this.logger.error(
        `Failed to set status to ARCHIVING for ${inspectionId}`,
        updateError.stack,
      );
      // Decide if this is critical enough to stop the process
    }
    const frontendReportUrl = `${this.config.getOrThrow<string>('CLIENT_BASE_URL')}/data/${inspection.pretty_id}`;
    let pdfBuffer: Buffer;
    let pdfHashString: string;
    const pdfFileName = `${inspectionId}-${Date.now()}.pdf`; // Nama file unik
    const pdfFilePath = path.join(PDF_ARCHIVE_PATH, pdfFileName);
    const pdfPublicUrl = `${PDF_PUBLIC_BASE_URL}/${pdfFileName}`; // URL publik

    try {
      // 3. Generate PDF from url
      pdfBuffer = await this.generatePdfFromUrl(frontendReportUrl);
      // 4. Save PDF to Disc
      await fs.writeFile(pdfFilePath, pdfBuffer);
      this.logger.log(`PDF report saved to: ${pdfFilePath}`);

      // 5. Calculate PDF Hash
      const hash = crypto.createHash('sha256');
      hash.update(pdfBuffer);
      pdfHashString = hash.digest('hex');
      this.logger.log(`PDF hash calculated: ${pdfHashString}`);
      this.logger.log(
        `PDF hash calculated for inspection ${inspectionId}: ${pdfHashString}`,
      );

      // 6. Minting
      let blockchainResult: { txHash: string; assetId: string } | null = null;
      let blockchainSuccess = false;

      try {
        // Siapkan metadata untuk NFT
        // Explicitly type vehicleData as JsonObject for safe access
        const vehicleData = inspection.vehicleData as Prisma.JsonObject | null;

        const metadataForNft: any = {
          inspectionId: inspectionId,
          inspectionDate: inspection.inspectionDate?.toISOString(), // Kirim ISO string
          vehicleNumber: inspection.vehiclePlateNumber,
          vehicleBrand: vehicleData?.merekKendaraan ?? null, // Safe access
          vehicleModel: vehicleData?.tipeKendaraan ?? null, // Safe access
          vehicleYear: vehicleData?.tahun ?? null, // Safe access
          vehicleColor: vehicleData?.warnaKendaraan ?? null, // Safe access
          overallRating: inspection.overallRating,
          pdfUrl: pdfPublicUrl, // URL ke PDF
          pdfHash: pdfHashString, // Hash PDF
          inspectorId: inspection.inspectorId,
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

      // 7. Update Inspection Record in DB (Final Status)
      const finalStatus = blockchainSuccess
        ? InspectionStatus.ARCHIVED
        : InspectionStatus.FAIL_ARCHIVE;
      const updateData: Prisma.InspectionUpdateInput = {
        status: finalStatus,
        urlPdf: pdfPublicUrl,
        pdfFileHash: pdfHashString,
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
        `Inspection ${inspectionId} deactivated by user ${userId}`,
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
        `Failed to deactivate inspection ${inspectionId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Could not deactivate inspection ${inspectionId}.`,
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
