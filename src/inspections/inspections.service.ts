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

    // Helper function for deep comparison of JSON objects up to one level
    const logJsonChangesOneLevel = (
      fieldName: string,
      oldValue: any,
      newValue: any,
      changes: Prisma.InspectionChangeLogCreateManyInput[],
    ) => {
      if (
        typeof oldValue === 'object' &&
        oldValue !== null &&
        typeof newValue === 'object' &&
        newValue !== null
      ) {
        const oldObj = oldValue as any;
        const newObj = newValue as any;

        // Hanya iterasi melalui kunci yang ada di newValue
        for (const key in newObj) {
          if (newObj.hasOwnProperty(key)) {
            const oldVal = oldObj[key];
            const newVal = newObj[key];

            const oldValToLog = oldVal === undefined ? null : oldVal;
            const newValToLog = newVal === undefined ? null : newVal;

            if (JSON.stringify(oldValToLog) !== JSON.stringify(newValToLog)) {
              changes.push({
                inspectionId: id,
                changedByUserId: userId,
                fieldName: fieldName,
                subFieldName: key,
                oldValue: oldValToLog === null ? Prisma.JsonNull : oldValToLog,
                newValue: newValToLog === null ? Prisma.JsonNull : newValToLog,
              });
            }
          }
        }
      } else if (oldValue !== newValue) {
        const oldValToLog = oldValue === undefined ? null : oldValue;
        const newValToLog = newValue === undefined ? null : newValue;
        if (JSON.stringify(oldValToLog) !== JSON.stringify(newValToLog)) {
          changes.push({
            inspectionId: id,
            changedByUserId: userId,
            fieldName: fieldName,
            subFieldName: null,
            oldValue: oldValToLog === null ? Prisma.JsonNull : oldValToLog,
            newValue: newValToLog === null ? Prisma.JsonNull : newValToLog,
          });
        }
      }
    };

    // Compare fields from DTO with existing data and log changes
    for (const key in updateInspectionDto) {
      if (updateInspectionDto.hasOwnProperty(key)) {
        const newValue = (updateInspectionDto as any)[key];
        const oldValue = (existingInspection as any)[key];

        if (
          key === 'identityDetails' ||
          key === 'vehicleData' ||
          key === 'equipmentChecklist' ||
          key === 'inspectionSummary' ||
          key === 'detailedAssessment' ||
          key === 'bodyPaintThickness'
        ) {
          logJsonChangesOneLevel(key, oldValue, newValue, changesToLog);
        } else if (newValue !== undefined) {
          const oldValToLog = oldValue === undefined ? null : oldValue;
          const newValToLog = newValue === undefined ? null : newValue;
          if (JSON.stringify(oldValToLog) !== JSON.stringify(newValToLog)) {
            changesToLog.push({
              inspectionId: id,
              changedByUserId: userId,
              fieldName: key,
              subFieldName: null,
              oldValue: oldValToLog === null ? Prisma.JsonNull : oldValToLog,
              newValue: newValToLog === null ? Prisma.JsonNull : newValToLog,
            });
          }
        }
      }
    }

    // 3. Save changes to InspectionChangeLog
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
        `No significant changes detected for inspection ID: ${id}`,
      );
    }

    // 4. Return the existing inspection
    return existingInspection;
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

      // Group changes by fieldName and subFieldName
      const groupedChanges: { [key: string]: InspectionChangeLog[] } = {};
      for (const log of latestChanges) {
        const key = log.subFieldName
          ? `${log.fieldName}.${log.subFieldName}`
          : log.fieldName;
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

      for (const key in latestValues) {
        if (latestValues.hasOwnProperty(key)) {
          if (key.includes('.')) {
            // Handle subFieldName (one level deep)
            const [fieldName, subFieldName] = key.split('.');
            if (
              updatedInspectionData[fieldName] &&
              typeof updatedInspectionData[fieldName] === 'object'
            ) {
              updatedInspectionData[fieldName] = {
                ...updatedInspectionData[fieldName],
                [subFieldName]: latestValues[key],
              };
            } else {
              updatedInspectionData[fieldName] = {
                [subFieldName]: latestValues[key],
              };
            }
          } else {
            // Handle top-level fields (fieldName only)
            updatedInspectionData[key] = latestValues[key];
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
