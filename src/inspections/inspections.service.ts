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
      // Explicitly type error as any for now
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

    // Cari ID terakhir dengan prefix yang sama DALAM TRANSAKSI
    const lastInspection = await tx.inspection.findFirst({
      where: {
        id: {
          startsWith: idPrefix,
        },
      },
      orderBy: {
        id: 'desc', // Urutkan descending untuk mendapatkan yang terakhir
      },
      select: {
        id: true,
      },
    });

    let nextSequence = 1;
    if (lastInspection) {
      try {
        const lastSequenceStr = lastInspection.id.substring(idPrefix.length);
        const lastSequence = parseInt(lastSequenceStr, 10);
        if (!isNaN(lastSequence)) {
          nextSequence = lastSequence + 1;
        } else {
          this.logger.warn(
            `Could not parse sequence number from last ID: ${lastInspection.id}. Defaulting to 1.`,
          );
        }
      } catch (e) {
        this.logger.warn(
          `Error parsing sequence number from last ID: ${lastInspection.id}. Defaulting to 1. Error: ${e}`,
        );
      }
    }

    // Format nomor urut dengan padding nol (misal: 001, 010, 123)
    const nextSequenceStr = nextSequence.toString().padStart(3, '0');

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
  async create(
    createInspectionDto: CreateInspectionDto,
    submitterId: string,
  ): Promise<Inspection> {
    this.logger.log(
      `Creating inspection for plate: ${createInspectionDto.vehiclePlateNumber ?? 'N/A'} by user ${submitterId}`,
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
    } catch (e) {
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
          id: customId, // <-- Gunakan ID kustom
          inspector: { connect: { id: submitterId } },
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
          // Explicitly type error as any for now
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
   * Updates an existing inspection record with provided data (excluding photos).
   * Only updates fields that are present in the DTO.
   * Parses JSON strings if provided.
   *
   * @param {string} id - The UUID of the inspection to update.
   * @param {UpdateInspectionDto} updateInspectionDto - DTO containing the fields to update.
   * @param {string} userId - ID of the user performing the update (for auth checks later).
   * @param {Role} userRole - Role of the user performing the update.
   * @returns {Promise<Inspection>} The updated inspection record.
   * @throws {NotFoundException} If the inspection with the given ID is not found.
   * @throws {ForbiddenException} If user role is not allowed to update (placeholder for now).
   * @throws {BadRequestException} If JSON parsing fails.
   * @throws {InternalServerErrorException} For other database errors.
   */
  async update(
    id: string,
    updateInspectionDto: UpdateInspectionDto,
    userId: string, // Add user context for potential future checks
    userRole: Role, // Add role for potential future checks
  ): Promise<Inspection> {
    this.logger.log(
      `User ${userId} (Role: ${userRole}) attempting to update inspection ID: ${id}`,
    );
    this.logger.debug(
      'Update DTO received:',
      JSON.stringify(updateInspectionDto, null, 2),
    );

    // 1. Check if inspection exists (findUniqueOrThrow handles this)
    try {
      // Fetch first to ensure it exists before attempting update
      await this.prisma.inspection.findUniqueOrThrow({ where: { id } });
    } catch (error: any) {
      // Explicitly type error as any for now
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Inspection with ID "${id}" not found.`);
      }
      this.logger.error(
        `Error checking existence for inspection ID ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Could not retrieve inspection ${id} for update.`,
      );
    }

    // 2. Prepare data for update (parse JSON strings if present)
    const dataToUpdate: Prisma.InspectionUpdateInput = {};

    // Conditionally add fields to update object only if they exist in the DTO
    if (updateInspectionDto.vehiclePlateNumber !== undefined) {
      dataToUpdate.vehiclePlateNumber = updateInspectionDto.vehiclePlateNumber;
    }
    if (updateInspectionDto.inspectionDate !== undefined) {
      dataToUpdate.inspectionDate = new Date(
        updateInspectionDto.inspectionDate,
      ); // Convert string to Date
    }
    if (updateInspectionDto.overallRating !== undefined) {
      dataToUpdate.overallRating = updateInspectionDto.overallRating;
    }
    // Parse and add JSON fields conditionally
    if (updateInspectionDto.identityDetails !== undefined) {
      dataToUpdate.identityDetails = updateInspectionDto.identityDetails;
    }
    if (updateInspectionDto.vehicleData !== undefined) {
      dataToUpdate.vehicleData = updateInspectionDto.vehicleData;
    }
    if (updateInspectionDto.equipmentChecklist !== undefined) {
      dataToUpdate.equipmentChecklist = updateInspectionDto.equipmentChecklist;
    }
    if (updateInspectionDto.inspectionSummary !== undefined) {
      dataToUpdate.inspectionSummary = updateInspectionDto.inspectionSummary;
    }
    if (updateInspectionDto.detailedAssessment !== undefined) {
      dataToUpdate.detailedAssessment = updateInspectionDto.detailedAssessment;
    }
    // Add bodyPaintThickness if it's in UpdateInspectionDto (inherited from Create)
    if (updateInspectionDto.bodyPaintThickness !== undefined) {
      // Assuming bodyPaintThickness in DTO is stringified JSON
      dataToUpdate.bodyPaintThickness = updateInspectionDto.bodyPaintThickness;
    }

    // Check if there's actually anything to update
    if (Object.keys(dataToUpdate).length === 0) {
      this.logger.warn(
        `Update request for inspection ${id} received, but no valid fields to update.`,
      );
      // Option 1: Return the existing record without updating
      // return this.findOne(id, userRole); // Be careful with infinite loops if findOne calls update
      // Option 2: Throw a BadRequestException
      throw new BadRequestException('No valid fields provided for update.');
    }

    this.logger.debug(
      `Data prepared for Prisma update on ${id}:`,
      JSON.stringify(dataToUpdate, null, 2),
    );

    // 3. Perform the update
    try {
      const updatedInspection = await this.prisma.inspection.update({
        where: { id: id },
        data: dataToUpdate,
      });
      this.logger.log(`Successfully updated inspection ID: ${id}`);
      return updatedInspection;
    } catch (error: any) {
      // Explicitly type error as any for now
      if (error instanceof BadRequestException) throw error; // Re-throw parsing errors
      // P2025 (Record not found) should have been caught earlier, but check again just in case
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(
          `Inspection with ID "${id}" not found during update attempt.`,
        );
      }
      this.logger.error(
        `Failed to update inspection ID ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Could not update inspection ${id}.`,
      );
    }
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
        // include: { inspector: { select: {id: true, name: true}}, reviewer: { select: {id: true, name: true}} } // Example include
      });
      this.logger.log(
        `Retrieved ${inspections.length} inspections for role ${userRole}.`,
      );
      return inspections;
    } catch (error: any) {
      // Explicitly type error as any for now
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
      // Explicitly type error as any for now
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
   * Approves an inspection, changing its status from NEED_REVIEW or FAIL_ARCHIVE to APPROVED.
   * Records the reviewer ID.
   *
   * @param {string} inspectionId - The UUID of the inspection to approve.
   * @param {string} reviewerId - The UUID of the user (REVIEWER/ADMIN) approving.
   * @returns {Promise<Inspection>} The updated inspection record.
   * @throws {NotFoundException} If inspection not found.
   * @throws {BadRequestException} If inspection is not in NEED_REVIEW or FAIL_ARCHIVE state.
   */
  async approveInspection(
    inspectionId: string,
    reviewerId: string,
  ): Promise<Inspection> {
    this.logger.log(
      `Reviewer ${reviewerId} attempting to approve inspection ${inspectionId}`,
    );
    try {
      // --- PERBAIKAN WHERE CLAUSE ---
      // Update only if the current status is NEED_REVIEW OR FAIL_ARCHIVE
      const result = await this.prisma.inspection.updateMany({
        where: {
          id: inspectionId,
          // Use the 'in' operator with an array of allowed statuses
          status: {
            in: [InspectionStatus.NEED_REVIEW, InspectionStatus.FAIL_ARCHIVE],
          },
        },
        data: {
          status: InspectionStatus.APPROVED,
          reviewerId: reviewerId, // Record the reviewer
          // Clear potential failure-related fields when approving after FAIL_ARCHIVE
          // nftAssetId: null, // Optional: Decide if you want to clear these on re-approval
          // blockchainTxHash: null, // Optional
          // archivedAt: null, // Optional
        },
      });
      // -----------------------------

      // Check if any record was actually updated
      if (result.count === 0) {
        // Check if it exists at all to give a better error
        const exists = await this.prisma.inspection.findUnique({
          where: { id: inspectionId },
          select: { status: true }, // Select only status needed for check
        });
        if (!exists) {
          throw new NotFoundException(
            `Inspection with ID "${inspectionId}" not found for approval.`,
          );
        }
        // Check if it was already approved or in another non-approvable state
        else if (exists.status === InspectionStatus.APPROVED) {
          throw new BadRequestException(
            `Inspection ${inspectionId} is already approved.`,
          );
        } else {
          // If it exists but wasn't NEED_REVIEW or FAIL_ARCHIVE
          throw new BadRequestException(
            `Inspection ${inspectionId} cannot be approved. Current status is '${exists.status}'. Required: '${InspectionStatus.NEED_REVIEW}' or '${InspectionStatus.FAIL_ARCHIVE}'.`,
          );
        }
      }

      this.logger.log(
        `Inspection ${inspectionId} approved by reviewer ${reviewerId}`,
      );
      // Fetch and return the updated record to show the new status
      return this.prisma.inspection.findUniqueOrThrow({
        where: { id: inspectionId },
      });
    } catch (error: any) {
      // Re-throw known exceptions, handle others
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error(
        `Failed to approve inspection ${inspectionId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Could not approve inspection ${inspectionId}.`,
      );
    }
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
    } catch (error) {
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
      // Explicitly type error as any for now
      this.logger.error(
        `Failed to set status to ARCHIVING for ${inspectionId}`,
        updateError.stack,
      );
      // Decide if this is critical enough to stop the process
    }
    const frontendReportUrl = `${this.config.getOrThrow<string>('CLIENT_BASE_URL')}/data/${inspectionId}`;
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
