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
  User,
} from '@prisma/client'; // Prisma generated types (Inspection model, Prisma namespace)
import * as fs from 'fs/promises'; // Use promise-based fs for async file operations
import * as path from 'path'; // For constructing file paths
import * as crypto from 'crypto'; // For generating PDF hash
import { format } from 'date-fns'; // for date formating

// Define path for archived PDFs (ensure this exists or is created by deployment script/manually)
const PDF_ARCHIVE_PATH = './pdfarchived';
// Define public base URL for accessing archived PDFs (should come from config in real app)
const PDF_PUBLIC_BASE_URL =
  process.env.PDF_PUBLIC_BASE_URL || '/publicly-served-pdfs'; // Example: /pdfarchived if served by Nginx

interface ParsedPhotoMetadata {
  label: string;
  needAttention?: boolean;
}
interface PhotoDbEntry {
  label: string;
  path: string;
  needAttention: boolean; // Buat non-optional di DB, default false
}

@Injectable()
export class InspectionsService {
  // Initialize a logger for this service context
  private readonly logger = new Logger(InspectionsService.name);

  // Inject PrismaService dependency via constructor
  constructor(private prisma: PrismaService) {
    // Ensure the PDF archive directory exists on startup
    this.ensureDirectoryExists(PDF_ARCHIVE_PATH);
  }

  /** Helper to ensure directory exists */
  private async ensureDirectoryExists(directoryPath: string) {
    try {
      await fs.mkdir(directoryPath, { recursive: true });
      this.logger.log(`Directory ensured: ${directoryPath}`);
    } catch (error) {
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
   * @param branchCode - 'YOG', 'SLO', 'SEM', etc. (Should come from DTO/User context)
   * @param inspectionDate - The date of the inspection.
   * @param tx - Optional Prisma transaction client for atomicity.
   * @returns The next sequential ID string.
   */
  private async generateNextInspectionId(
    branchCode: string, // e.g., 'YOG', 'SLO', 'SEM'
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
   * Status defaults to SUBMITTED. Requires the ID of the submitting user (inspector).
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
        if (!['YOG', 'SLO', 'SEM'].includes(branchCode)) {
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
          // photoPaths default [], status default SUBMITTED
        };

        try {
          const newInspection = await tx.inspection.create({
            data: dataToCreate,
          });
          this.logger.log(
            `Successfully created inspection with custom ID: ${newInspection.id}`,
          );
          return newInspection;
        } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    // TODO: Consider if INSPECTOR should see their own SUBMITTED/REJECTED inspections?

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
    } catch (error) {
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
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        this.logger.warn(`Inspection with ID "${id}" not found.`);
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
   * Approves an inspection, changing its status from SUBMITTED to APPROVED.
   *
   * @param {string} inspectionId - The UUID of the inspection to approve.
   * @param {string} reviewerId - The UUID of the user (REVIEWER) approving the inspection.
   * @returns {Promise<Inspection>} The updated inspection record.
   * @throws {NotFoundException|BadRequestException} If inspection not found or not in SUBMITTED state.
   */
  async approveInspection(
    inspectionId: string,
    reviewerId: string,
  ): Promise<Inspection> {
    this.logger.log(
      `Reviewer ${reviewerId} attempting to approve inspection ${inspectionId}`,
    );
    try {
      // Update only if the current status is SUBMITTED
      const result = await this.prisma.inspection.updateMany({
        where: {
          id: inspectionId,
          status: InspectionStatus.SUBMITTED,
        },
        data: {
          status: InspectionStatus.APPROVED,
          reviewerId: reviewerId, // Record the reviewer
          // updatedAt is handled automatically by Prisma @updatedAt
        },
      });

      // Check if any record was actually updated
      if (result.count === 0) {
        // Check if it exists at all to give a better error
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
            `Inspection ${inspectionId} cannot be approved because its current status is '${exists.status}', not '${InspectionStatus.SUBMITTED}'.`,
          );
        }
      }

      this.logger.log(
        `Inspection ${inspectionId} approved by reviewer ${reviewerId}`,
      );
      // Fetch and return the updated record
      return this.prisma.inspection.findUniqueOrThrow({
        where: { id: inspectionId },
      });
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      )
        throw error;
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
   * Rejects an inspection, changing its status from SUBMITTED to REJECTED.
   *
   * @param {string} inspectionId - The UUID of the inspection to reject.
   * @param {string} reviewerId - The UUID of the user (REVIEWER) rejecting the inspection.
   * @returns {Promise<Inspection>} The updated inspection record.
   * @throws {NotFoundException|BadRequestException} If inspection not found or not in SUBMITTED state.
   */
  async rejectInspection(
    inspectionId: string,
    reviewerId: string,
  ): Promise<Inspection> {
    this.logger.log(
      `Reviewer ${reviewerId} attempting to reject inspection ${inspectionId}`,
    );
    try {
      // Update only if the current status is SUBMITTED
      const result = await this.prisma.inspection.updateMany({
        where: {
          id: inspectionId,
          status: InspectionStatus.SUBMITTED,
        },
        data: {
          status: InspectionStatus.REJECTED,
          reviewerId: reviewerId,
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
            `Inspection ${inspectionId} cannot be rejected because its current status is '${exists.status}', not '${InspectionStatus.SUBMITTED}'.`,
          );
        }
      }
      this.logger.log(
        `Inspection ${inspectionId} rejected by reviewer ${reviewerId}`,
      );
      return this.prisma.inspection.findUniqueOrThrow({
        where: { id: inspectionId },
      });
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      )
        throw error;
      this.logger.error(
        `Failed to reject inspection ${inspectionId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Could not reject inspection ${inspectionId}.`,
      );
    }
  }

  /**
   * Processes an approved inspection for archiving.
   * Saves the provided PDF, calculates its hash, simulates blockchain interaction,
   * and updates the inspection status to ARCHIVED or FAIL_ARCHIVE.
   *
   * @param {string} inspectionId - The UUID of the inspection to archive.
   * @param {Express.Multer.File} pdfFile - The generated PDF file uploaded from frontend.
   * @param {string} userId - The ID of the user initiating the archive (ADMIN/REVIEWER).
   * @returns {Promise<Inspection>} The final updated inspection record.
   */
  async processToArchive(
    inspectionId: string,
    pdfFile: Express.Multer.File,
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
    } catch (updateError) {
      this.logger.error(
        `Failed to set status to ARCHIVING for ${inspectionId}`,
        updateError.stack,
      );
      // Decide if this is critical enough to stop the process
    }

    // 3. Save PDF locally (Replace with Object Storage logic later)
    const pdfFileName = `${inspectionId}-${Date.now()}.pdf`; // Create a unique name
    const pdfFilePath = path.join(PDF_ARCHIVE_PATH, pdfFileName);
    const pdfPublicUrl = `${PDF_PUBLIC_BASE_URL}/${pdfFileName}`; // URL for frontend access

    try {
      await fs.writeFile(pdfFilePath, pdfFile.buffer);
      this.logger.log(
        `PDF saved locally for inspection ${inspectionId} at ${pdfFilePath}`,
      );

      // 4. Calculate PDF Hash
      const hash = crypto.createHash('sha256');
      hash.update(pdfFile.buffer);
      const pdfHashString = hash.digest('hex');
      this.logger.log(
        `PDF hash calculated for inspection ${inspectionId}: ${pdfHashString}`,
      );

      // TODO: Minting
      // 5. --- Simulate Blockchain Interaction ---
      this.logger.log(
        `Simulating blockchain minting for inspection ${inspectionId}...`,
      );
      // Replace this block with actual call to BlockchainService later
      let nftAssetId: string | null = null;
      let blockchainTxHash: string | null = null;
      let blockchainSuccess = false;
      try {
        // --- Replace with actual blockchain call ---
        // const blockchainResult = await this.blockchainService.mintInspectionNft(inspection, pdfHashString, pdfPublicUrl);
        // nftAssetId = blockchainResult.assetId;
        // blockchainTxHash = blockchainResult.txHash;
        // blockchainSuccess = true;
        // ------------------------------------------

        // --- Simulation ---
        await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate delay
        // Simulate success/failure randomly or based on some condition for testing
        if (Math.random() > 0.1) {
          // Simulate 90% success rate
          nftAssetId = `simulatedPolicyId.${Buffer.from(inspectionId.substring(0, 10)).toString('hex')}`;
          blockchainTxHash = `simulatedTxHash_${crypto.randomBytes(16).toString('hex')}`;
          blockchainSuccess = true;
          this.logger.log(
            `Blockchain simulation SUCCESS for inspection ${inspectionId}: ${nftAssetId}`,
          );
        } else {
          throw new Error('Simulated blockchain minting failure');
        }
        // --- End Simulation ---
      } catch (blockchainError) {
        this.logger.error(
          `Blockchain interaction FAILED for inspection ${inspectionId}`,
          blockchainError.stack,
        );
        blockchainSuccess = false;
        // Proceed to update status to FAIL_ARCHIVE
      }

      // 6. Update Inspection Record in DB (Final Status)
      const finalStatus = blockchainSuccess
        ? InspectionStatus.ARCHIVED
        : InspectionStatus.FAIL_ARCHIVE;
      const updateData: Prisma.InspectionUpdateInput = {
        status: finalStatus,
        urlPdf: pdfPublicUrl,
        pdfFileHash: pdfHashString,
        nftAssetId: nftAssetId,
        blockchainTxHash: blockchainTxHash,
        archivedAt: blockchainSuccess ? new Date() : null, // Set archive time only on success
      };

      const finalInspection = await this.prisma.inspection.update({
        where: { id: inspectionId },
        data: updateData,
      });

      this.logger.log(
        `Inspection ${inspectionId} final status set to ${finalStatus}.`,
      );
      return finalInspection;
    } catch (error) {
      // Catch errors from file saving, hashing, or the final DB update
      // Attempt to revert status if stuck in ARCHIVING (best effort)
      try {
        await this.prisma.inspection.updateMany({
          where: { id: inspectionId, status: InspectionStatus.ARCHIVING },
          data: { status: InspectionStatus.FAIL_ARCHIVE },
        });
      } catch (revertError) {
        this.logger.error(
          `Failed to revert status from ARCHIVING for inspection ${inspectionId} after error`,
          revertError.stack,
        );
      }

      this.logger.error(
        `Archiving process failed critically for inspection ${inspectionId}: ${error.message}`,
        error.stack,
      );
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
    } catch (error) {
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
    } catch (error) {
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
