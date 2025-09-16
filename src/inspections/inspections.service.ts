/*
 * --------------------------------------------------------------------------
 * File: inspections.service.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Service responsible for handling business logic related to inspections.
 * Interacts with PrismaService to manage inspection data in the database.
 * Handles parsing JSON data received as strings and storing file paths from uploads.
 * Manages inspection lifecycle, including creation, updates, status changes,
 * PDF generation, and blockchain interaction simulation.
 * --------------------------------------------------------------------------
 */

import {
  Injectable,
  InternalServerErrorException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { AppLogger } from '../logging/app-logger.service';
import { PrismaService } from '../prisma/prisma.service'; // Service for Prisma client interaction
import { CreateInspectionDto } from './dto/create-inspection.dto'; // DTO for incoming creation data
import { UpdateInspectionDto } from './dto/update-inspection/update-inspection.dto';
import { BuildMintTxDto } from '../blockchain/dto/build-mint-tx.dto';
import { ConfirmMintDto } from './dto/confirm-mint.dto';
import {
  Inspection,
  InspectionStatus,
  Prisma,
  Role,
  InspectionChangeLog,
  Photo, // Import Photo
} from '@prisma/client'; // Prisma generated types (Inspection model, Prisma namespace)
import * as fs from 'fs/promises'; // Use promise-based fs for async file operations
import * as path from 'path'; // For constructing file paths
import * as crypto from 'crypto'; // For generating PDF hash
import { format } from 'date-fns'; // for date formating
import {
  BlockchainService,
  InspectionNftMetadata,
} from '../blockchain/blockchain.service';
import { IpfsService } from '../ipfs/ipfs.service';
import { BackblazeService } from '../common/services/backblaze.service';
import { AuditLoggerService } from '../logging/audit-logger.service';
import puppeteer, { Browser } from 'puppeteer'; // Import puppeteer and Browser type
import { ConfigService } from '@nestjs/config';
// Define path for archived PDFs (ensure this exists or is created by deployment script/manually)
const PDF_ARCHIVE_PATH = './pdfarchived';
// Define public base URL for accessing archived PDFs (kept for backward-compatibility; Backblaze URL is now authoritative)
// NOTE: PDF_PUBLIC_BASE_URL is no longer used because PDFs are uploaded to Backblaze and the returned URL is used.

interface NftMetadata {
  vehicleNumber: string | null;
  pdfHash: string | null;
}

// PDF Generation Queue to limit concurrent operations
class PdfGenerationQueue {
  private queue: (() => Promise<any>)[] = [];
  private running = 0;
  private readonly maxConcurrent: number;
  private totalProcessed = 0;
  private totalErrors = 0;
  private consecutiveErrors = 0;
  private readonly maxConsecutiveErrors = 8; // Increased for bulk operations
  private circuitBreakerOpenUntil = 0;

  constructor(maxConcurrent = 5) {
    // Increased to 5 for large bulk operations (10 inspections = 20 PDFs)
    this.maxConcurrent = maxConcurrent;
  }

  get stats() {
    return {
      queueLength: this.queue.length,
      running: this.running,
      totalProcessed: this.totalProcessed,
      totalErrors: this.totalErrors,
      consecutiveErrors: this.consecutiveErrors,
      circuitBreakerOpen: Date.now() < this.circuitBreakerOpenUntil,
    };
  }

  private isCircuitBreakerOpen(): boolean {
    return Date.now() < this.circuitBreakerOpenUntil;
  }

  async add<T>(task: () => Promise<T>): Promise<T> {
    if (this.isCircuitBreakerOpen()) {
      throw new Error(
        'PDF generation circuit breaker is open due to consecutive failures. Please try again later.',
      );
    }

    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await task();
          this.totalProcessed++;
          this.consecutiveErrors = 0; // Reset on success
          resolve(result);
        } catch (error) {
          this.totalErrors++;
          this.consecutiveErrors++;

          // Open circuit breaker if too many consecutive errors
          if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
            this.circuitBreakerOpenUntil = Date.now() + 300000; // 5 minutes
          }

          reject(error as Error);
        }
      });
      void this.processQueue();
    });
  }

  private async processQueue() {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    this.running++;
    const task = this.queue.shift();
    if (task) {
      try {
        await task();
      } finally {
        this.running--;
        void this.processQueue();
      }
    }
  }
}

// Blockchain/Minting Queue to prevent UTXO conflicts during concurrent minting
class BlockchainMintingQueue {
  private queue: (() => Promise<any>)[] = [];
  private running = 0;
  private readonly maxConcurrent: number;
  private totalProcessed = 0;
  private totalErrors = 0;
  private consecutiveErrors = 0;
  private readonly maxConsecutiveErrors = 5;
  private circuitBreakerOpenUntil = 0;

  constructor(maxConcurrent = 1) {
    // Use 1 for sequential minting to prevent UTXO conflicts
    this.maxConcurrent = maxConcurrent;
  }

  get stats() {
    return {
      queueLength: this.queue.length,
      running: this.running,
      totalProcessed: this.totalProcessed,
      totalErrors: this.totalErrors,
      consecutiveErrors: this.consecutiveErrors,
      circuitBreakerOpen: Date.now() < this.circuitBreakerOpenUntil,
    };
  }

  private isCircuitBreakerOpen(): boolean {
    return Date.now() < this.circuitBreakerOpenUntil;
  }

  async add<T>(task: () => Promise<T>): Promise<T> {
    if (this.isCircuitBreakerOpen()) {
      throw new Error(
        'Blockchain minting circuit breaker is open due to consecutive failures. Please try again later.',
      );
    }

    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await task();
          this.totalProcessed++;
          this.consecutiveErrors = 0; // Reset on success
          resolve(result);
        } catch (error) {
          this.totalErrors++;
          this.consecutiveErrors++;

          // Open circuit breaker if too many consecutive errors
          if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
            this.circuitBreakerOpenUntil = Date.now() + 180000; // 3 minutes
          }

          reject(error as Error);
        }
      });
      void this.processQueue();
    });
  }

  private async processQueue() {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    this.running++;
    const task = this.queue.shift();
    if (task) {
      try {
        await task();
      } finally {
        this.running--;
        void this.processQueue();
      }
    }
  }
}

/**
 * Service responsible for handling business logic related to inspections.
 * Interacts with PrismaService to manage inspection data in the database.
 * Handles parsing JSON data received as strings and storing file paths from uploads.
 * Manages inspection lifecycle, including creation, updates, status changes,
 * PDF generation, and blockchain interaction simulation.
 */
@Injectable()
export class InspectionsService {
  // Initialize a logger for this service context
  private readonly logger: AppLogger;
  // PDF generation queue to limit concurrent operations
  private readonly pdfQueue = new PdfGenerationQueue(5); // Increased to 5 for large bulk operations
  // Blockchain minting queue to prevent UTXO conflicts
  private readonly blockchainQueue = new BlockchainMintingQueue(1); // Sequential minting to prevent UTXO conflicts
  // Inject PrismaService dependency via constructor
  constructor(
    private prisma: PrismaService,
    private blockchainService: BlockchainService,
    private config: ConfigService,
    private readonly ipfsService: IpfsService,
    private readonly backblazeService: BackblazeService,
    logger: AppLogger,
    private readonly audit: AuditLoggerService,
  ) {
    this.logger = logger;
    this.logger.setContext(InspectionsService.name);
    // Ensure the PDF archive directory exists on startup
    void this.ensureDirectoryExists(PDF_ARCHIVE_PATH);
  }

  /**
   * Hash a vehicle number using SHA-256 and return hex string.
   * Use this when you need to store a privacy-preserving identifier on-chain.
   */
  private hashVehicleNumber(vehicleNumber: string): string {
    if (!vehicleNumber || typeof vehicleNumber !== 'string') return '';
    const normalized = vehicleNumber.trim().toUpperCase();
    return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
  }

  /**
   * Helper to produce a small object to include in NFT metadata attributes.
   * Returns { hash, alg } where alg is the hashing algorithm used.
   */
  private getVehicleNumberHashForMetadata(vehicleNumber: string) {
    const hash = this.hashVehicleNumber(vehicleNumber);
    return { vehicleNumberHash: hash, vehicleNumberAlg: 'sha256' };
  }

  /**
   * Normalize vehicle fields like brand/type: trim, collapse spaces, title-case.
   */
  private normalizeVehicleField(input?: string | null): string | undefined {
    if (!input) return undefined;
    try {
      let s = String(input).trim().replace(/\s+/g, ' ');
      s = s
        .toLowerCase()
        .split(' ')
        .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : ''))
        .join(' ');
      return s || undefined;
    } catch {
      return String(input).trim() || undefined;
    }
  }

  /**
   * Get current queue statistics for monitoring purposes
   */
  getQueueStats() {
    return {
      pdfQueue: this.pdfQueue.stats,
      blockchainQueue: this.blockchainQueue.stats,
    };
  }

  /**
   * Bulk approve multiple inspections with enhanced error handling
   * Processes inspections sequentially to avoid race conditions and resource exhaustion
   */
  async bulkApproveInspections(
    inspectionIds: string[],
    reviewerId: string,
    token: string | null,
  ): Promise<{
    successful: Array<{ id: string; message: string }>;
    failed: Array<{ id: string; error: string }>;
    summary: {
      total: number;
      successful: number;
      failed: number;
      estimatedTime: string;
    };
  }> {
    const startTime = Date.now();
    const total = inspectionIds.length;

    this.logger.log(
      `Starting bulk approval of ${total} inspections by reviewer ${reviewerId}`,
    );

    const successful: Array<{ id: string; message: string }> = [];
    const failed: Array<{ id: string; error: string }> = [];

    // Process inspections sequentially to prevent overwhelming the system
    for (let i = 0; i < inspectionIds.length; i++) {
      const inspectionId = inspectionIds[i];
      const progress = `${i + 1}/${total}`;

      try {
        this.logger.log(`Processing inspection ${progress}: ${inspectionId}`);

        // Add small delay between requests to reduce server load
        if (i > 0) {
          await this.sleep(500); // 500ms delay between approvals
        }

        await this.approveInspection(inspectionId, reviewerId, token);

        successful.push({
          id: inspectionId,
          message: `Successfully approved (${progress})`,
        });

        this.logger.log(
          `✓ Inspection ${inspectionId} approved successfully (${progress})`,
        );
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        failed.push({
          id: inspectionId,
          error: errorMessage,
        });

        this.logger.error(
          `✗ Failed to approve inspection ${inspectionId} (${progress}): ${errorMessage}`,
        );

        // Continue processing other inspections even if one fails
      }
    }

    const totalTime = Date.now() - startTime;
    const avgTimePerInspection = totalTime / total;

    const summary = {
      total,
      successful: successful.length,
      failed: failed.length,
      estimatedTime: `${Math.round(totalTime / 1000)}s (avg: ${Math.round(avgTimePerInspection / 1000)}s per inspection)`,
    };

    this.logger.log(
      `Bulk approval completed: ${summary.successful}/${summary.total} successful, ${summary.failed} failed in ${summary.estimatedTime}`,
    );

    return {
      successful,
      failed,
      summary,
    };
  }

  /**
   * Helper method to rollback inspection status after error during approval
   */
  private async rollbackInspectionStatusAfterError(
    inspectionId: string,
    originalStatus: InspectionStatus,
  ): Promise<void> {
    try {
      const rollbackStatus =
        originalStatus === InspectionStatus.FAIL_ARCHIVE
          ? InspectionStatus.FAIL_ARCHIVE
          : InspectionStatus.NEED_REVIEW;

      await this.prisma.inspection.update({
        where: { id: inspectionId },
        data: {
          status: rollbackStatus,
          // Clear reviewer if rolling back to NEED_REVIEW
          ...(rollbackStatus === InspectionStatus.NEED_REVIEW && {
            reviewerId: null,
          }),
        },
      });

      this.logger.warn(
        `Inspection ${inspectionId} status rolled back to ${rollbackStatus} due to approval process error`,
      );
    } catch (rollbackError: unknown) {
      this.logger.error(
        `Failed to rollback inspection ${inspectionId} status after approval error: ${
          rollbackError instanceof Error
            ? rollbackError.message
            : 'Unknown rollback error'
        }`,
        rollbackError instanceof Error ? rollbackError.stack : 'No stack trace',
      );
    }
  }

  /**
   * Helper method to sleep for a given number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Retry wrapper with exponential backoff
   */
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000,
    operationName: string = 'operation',
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        if (attempt === maxRetries) {
          this.logger.error(
            `${operationName} failed after ${maxRetries} attempts: ${errorMessage}`,
          );
          throw error;
        }

        const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
        this.logger.warn(
          `${operationName} failed on attempt ${attempt}/${maxRetries}: ${errorMessage}. Retrying in ${delay}ms...`,
        );

        await this.sleep(delay);
      }
    }

    throw new Error(`${operationName} failed after ${maxRetries} attempts`);
  }

  /**
   * Helper to ensure directory exists.
   * @param directoryPath The path to the directory.
   */
  private async ensureDirectoryExists(directoryPath: string) {
    try {
      await fs.mkdir(directoryPath, { recursive: true });
      this.logger.log(`Directory ensured: ${directoryPath}`);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        this.logger.error(
          `Failed to create directory ${directoryPath}`,
          (error as Error).stack,
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
   * @returns {Promise<{ id: string }>} An object containing the ID of the created inspection.
   */
  async create(
    createInspectionDto: CreateInspectionDto,
    inspectorId: string,
  ): Promise<{ id: string }> {
    this.logger.log(
      `Creating inspection for plate: ${
        createInspectionDto.vehiclePlateNumber ?? 'N/A'
      } by inspector ${inspectorId}`,
    );

    const { identityDetails } = createInspectionDto;
    const customerName = identityDetails.namaCustomer;

    // Determine the effective inspector ID. Use the one from the DTO as a fallback if auth is disabled.
    let effectiveInspectorId = inspectorId;
    if (!effectiveInspectorId) {
      this.logger.warn(
        'No inspectorId from auth. Falling back to ID from createInspectionDto.identityDetails.namaInspektor.',
      );
      effectiveInspectorId = identityDetails.namaInspektor; // Assuming this field holds the UUID
    }

    if (!effectiveInspectorId) {
      throw new BadRequestException(
        'Inspector ID is missing. It must be provided either via an authenticated user or in the request body.',
      );
    }

    // 1. Fetch Inspector and Branch City records using UUIDs
    let inspectorName: string | null = null;
    let branchCityName: string | null = null;
    let branchCode = 'XXX'; // Default branch code
    let effectiveBranchCityUuid: string;

    try {
      const inspector = await this.prisma.user.findUnique({
        where: { id: effectiveInspectorId },
        select: { name: true, inspectionBranchCityId: true },
      });
      if (!inspector) {
        throw new BadRequestException(
          `Inspector with ID "${effectiveInspectorId}" not found.`,
        );
      }
      inspectorName = inspector.name;
      this.logger.log(`Fetched inspector name: ${inspectorName}`);

      // Determine the branch city UUID to use
      if (inspector.inspectionBranchCityId) {
        effectiveBranchCityUuid = inspector.inspectionBranchCityId;
        this.logger.log(
          `Using branch city from inspector profile: ${effectiveBranchCityUuid}`,
        );
      } else {
        effectiveBranchCityUuid = identityDetails.cabangInspeksi;
        this.logger.log(
          `Using branch city from request body: ${effectiveBranchCityUuid}`,
        );
      }

      if (!effectiveBranchCityUuid) {
        throw new BadRequestException(
          'Branch City ID is missing. It must be provided either in the inspector profile or in the request body.',
        );
      }

      const branchCity = await this.prisma.inspectionBranchCity.findUnique({
        where: { id: effectiveBranchCityUuid },
        select: { city: true, code: true },
      });
      if (!branchCity) {
        throw new BadRequestException(
          `Inspection Branch City with ID "${effectiveBranchCityUuid}" not found.`,
        );
      }
      branchCityName = branchCity.city;
      branchCode = branchCity.code.toUpperCase(); // Use the fetched branch code
      this.logger.log(
        `Fetched branch city name: ${branchCityName}, code: ${branchCode}`,
      );
    } catch (e: unknown) {
      if (e instanceof BadRequestException) throw e;
      // Log specific error details if available
      const errorMessage =
        e instanceof Error ? e.message : 'An unknown error occurred';
      const errorStack =
        e instanceof Error && e.stack ? e.stack : 'No stack trace available';
      this.logger.error(
        `Failed to fetch inspector or branch city details: ${errorMessage}`,
        errorStack,
      );
      throw new InternalServerErrorException(
        'Could not retrieve inspector or branch city details.',
      );
    }

    const inspectionDateObj = createInspectionDto.inspectionDate
      ? new Date(createInspectionDto.inspectionDate)
      : new Date(); // Default to now() if not provided? Consider if this should be required.
    if (isNaN(inspectionDateObj.getTime())) {
      throw new BadRequestException('Invalid inspectionDate format provided.');
    }

    return this.prisma.$transaction(
      async (tx) => {
        // Generate ID Kustom di dalam transaksi menggunakan branchCode yang sudah diambil
        const customId = await this.generateNextInspectionId(
          branchCode,
          inspectionDateObj,
          tx,
        );
        this.logger.log(`Generated custom inspection ID: ${customId}`);

        // 2. Prepare Data for Database
        const dataToCreate: Prisma.InspectionCreateInput = {
          pretty_id: customId,
          // Store the UUIDs in the dedicated ID fields
          inspector: { connect: { id: effectiveInspectorId } }, // Connect using the effective UUID
          branchCity: { connect: { id: effectiveBranchCityUuid } }, // Connect using the UUID

          vehiclePlateNumber: createInspectionDto.vehiclePlateNumber,
          inspectionDate: inspectionDateObj,
          overallRating: createInspectionDto.overallRating,

          // Update identityDetails to store names and customer name
          identityDetails: {
            namaInspektor: inspectorName, // Store the fetched name
            namaCustomer: customerName, // Store the customer name from DTO
            cabangInspeksi: branchCityName, // Store the fetched name
          },

          vehicleData: JSON.parse(
            JSON.stringify(createInspectionDto.vehicleData),
          ),
          equipmentChecklist: JSON.parse(
            JSON.stringify(createInspectionDto.equipmentChecklist),
          ),
          inspectionSummary: JSON.parse(
            JSON.stringify(createInspectionDto.inspectionSummary),
          ),
          detailedAssessment: JSON.parse(
            JSON.stringify(createInspectionDto.detailedAssessment),
          ),
          bodyPaintThickness: JSON.parse(
            JSON.stringify(createInspectionDto.bodyPaintThickness),
          ),
          notesFontSizes: createInspectionDto.notesFontSizes ?? {
            // Use provided font sizes or default
            inspectionSummary_interiorNotes: 12,
            inspectionSummary_eksteriorNotes: 12,
            inspectionSummary_kakiKakiNotes: 12,
            inspectionSummary_mesinNotes: 12,
            inspectionSummary_deskripsiKeseluruhan: 12,
            detailedAssessment_testDrive_catatan: 12,
            detailedAssessment_banDanKakiKaki_catatan: 12,
            detailedAssessment_hasilInspeksiEksterior_catatan: 12,
            detailedAssessment_toolsTest_catatan: 12,
            detailedAssessment_fitur_catatan: 12,
            detailedAssessment_hasilInspeksiMesin_catatan: 12,
            detailedAssessment_hasilInspeksiInterior_catatan: 12,
          },
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
        } catch (error: unknown) {
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
          const errorMessage =
            error instanceof Error
              ? error.message
              : 'An unknown error occurred';
          const errorStack =
            error instanceof Error && error.stack
              ? error.stack
              : 'No stack trace available';
          this.logger.error(
            `Failed to create inspection with custom ID ${customId}: ${errorMessage}`,
            errorStack,
          );
          throw new InternalServerErrorException(
            'Could not save inspection data.',
          );
        }
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 10000,
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
    oldJsonValue: Prisma.JsonValue,
    newJsonValue: Prisma.JsonValue,
    changes: Prisma.InspectionChangeLogCreateManyInput[],
    inspectionId: string,
    userId: string,
    path: string[] = [], // Path of keys, e.g., [], ['fitur'], ['fitur', 'airbag']
  ) {
    const isObject = (
      val: Prisma.JsonValue,
    ): val is Record<string, Prisma.JsonValue> =>
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
      // Compare values. Use JSON.stringify for deep comparison of primitives/arrays/simple objects.
      // This might not be perfect for complex JSON structures with different key orders,
      // but is generally sufficient for typical form data JSON.
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
    const oldObj = oldJsonValue as Record<string, Prisma.JsonValue>;
    const newObj = newJsonValue as Record<string, Prisma.JsonValue>;

    // Iterate ONLY through keys present in the new (update DTO) object.
    // We only care about what the user *intends* to change or set.
    // Use Object.keys and then check existence on oldObj.
    for (const key of Object.keys(newObj)) {
      const newValue = newObj[key];

      // If the new value is undefined or null, it's considered not present in the
      // partial update payload (as per user feedback on transformation artifacts).
      // We skip it to avoid logging unintentional changes from a real value to null.
      if (newValue === undefined || newValue === null) {
        continue;
      }

      // Check if the key exists in the old object before recursing to avoid errors on new keys
      // This check is not strictly necessary for the logic but can prevent errors if oldObj is null/undefined
      // However, the isObject check above should handle the null/undefined case.
      // Let's proceed with recursion as intended, assuming oldObj is an object here.
      const currentPathWithKey = [...path, key];
      this.logJsonChangesRecursive(
        fieldName, // Keep passing the top-level fieldName
        oldObj[key], // Value from existing DB record (can be undefined if key doesn't exist)
        newValue, // Value from the update DTO
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
          AND "status" = ${InspectionStatus.ARCHIVED}
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
        include: { photos: true }, // Include related photos
        // include: { inspector: true, reviewer: true } // Include related users if needed
      });

      this.logger.log(
        `Found inspection ID: ${inspection?.id} for plate number: ${vehiclePlateNumber}`,
      );
      // Safety check: ensure the inspection is ARCHIVED; otherwise, behave like not found
      if (!inspection || inspection.status !== InspectionStatus.ARCHIVED) {
        return null;
      }
      return inspection;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'An unknown error occurred';
      const errorStack =
        error instanceof Error ? error.stack : 'No stack trace available';
      this.logger.error(
        `Failed to search inspection by plate number ${vehiclePlateNumber}: ${errorMessage}`,
        errorStack,
      );
      throw new InternalServerErrorException(
        'Could not search inspection data.',
      );
    }
  }

  /**
   * Finds inspections matching a keyword across multiple fields.
   *
   * @param {string} keyword - The keyword to search for.
   * @returns {Promise<Inspection[]>} A list of found inspection records.
   */
  async searchByKeyword(keyword: string): Promise<Inspection[]> {
    this.logger.log(`Searching for inspections with keyword: ${keyword}`);

    // If the keyword is empty, return an empty array to avoid scanning the entire table.
    if (!keyword || keyword.trim() === '') {
      return [];
    }

    try {
      // Using Prisma's findMany API for safe and type-safe searching.
      // 'contains' will perform a LIKE '%keyword%' search.
      // 'mode: 'insensitive'' will make the search case-insensitive (e.g., 'Avanza' will match 'avanza').
      const inspections = await this.prisma.inspection.findMany({
        where: {
          OR: [
            { pretty_id: { contains: keyword, mode: 'insensitive' } },
            { vehiclePlateNumber: { contains: keyword, mode: 'insensitive' } },
            {
              vehicleData: {
                path: ['merekKendaraan'],
                string_contains: keyword,
                mode: 'insensitive',
              },
            },
            {
              vehicleData: {
                path: ['tipeKendaraan'],
                string_contains: keyword,
                mode: 'insensitive',
              },
            },
            {
              identityDetails: {
                path: ['namaCustomer'],
                string_contains: keyword,
                mode: 'insensitive',
              },
            },
            {
              identityDetails: {
                path: ['namaInspektor'],
                string_contains: keyword,
                mode: 'insensitive',
              },
            },
            {
              identityDetails: {
                path: ['cabangInspeksi'],
                string_contains: keyword,
                mode: 'insensitive',
              },
            },
          ],
        },
        include: {
          photos: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 50, // Limit the number of results for performance
      });

      this.logger.log(
        `Found ${inspections.length} inspections for keyword: ${keyword}`,
      );
      return inspections;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'An unknown error occurred';
      const errorStack =
        error instanceof Error ? error.stack : 'No stack trace available';
      this.logger.error(
        `Failed to search inspections by keyword "${keyword}": ${errorMessage}`,
        errorStack,
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
   * @returns {Promise<{ message: string }>} The existing (unchanged) inspection record.
   * @throws {NotFoundException} If the inspection with the given ID is not found.
   * @throws {BadRequestException} If trying to update an already approved inspection.
   * @throws {InternalServerErrorException} For database errors during logging.
   */
  async update(
    id: string,
    updateInspectionDto: UpdateInspectionDto,
    userId: string,
    userRole: Role, // Included for context, though not used for auth in this specific method
  ): Promise<{ message: string }> {
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

    // Handle changes to inspectorId and branchCityId and update identityDetails immediately
    const currentIdentityDetails =
      (existingInspection.identityDetails as Prisma.JsonObject) ?? {};

    if (
      updateInspectionDto.inspectorId !== undefined &&
      updateInspectionDto.inspectorId !== existingInspection.inspectorId
    ) {
      const newInspector = await this.prisma.user.findUnique({
        where: { id: updateInspectionDto.inspectorId },
        select: { name: true },
      });
      if (!newInspector) {
        throw new BadRequestException(
          `New inspector with ID "${updateInspectionDto.inspectorId}" not found.`,
        );
      }
      // Log change for identityDetails.namaInspektor
      changesToLog.push({
        inspectionId: id,
        changedByUserId: userId,
        fieldName: 'identityDetails',
        subFieldName: 'namaInspektor',
        subsubfieldname: null,
        oldValue: currentIdentityDetails?.namaInspektor ?? Prisma.JsonNull, // Safer access
        newValue: newInspector.name ?? Prisma.JsonNull,
      });
      this.logger.log(
        `Logged change for identityDetails.namaInspektor to "${newInspector.name}"`,
      );

      // Log change for inspectorId
      changesToLog.push({
        inspectionId: id,
        changedByUserId: userId,
        fieldName: 'inspector',
        subFieldName: null,
        subsubfieldname: null,
        oldValue: existingInspection?.inspectorId ?? Prisma.JsonNull, // Safer access
        newValue: updateInspectionDto.inspectorId ?? Prisma.JsonNull,
      });
      this.logger.log(
        `Logged change for inspectorId "${updateInspectionDto.inspectorId}"`,
      );
    }

    if (
      updateInspectionDto.branchCityId !== undefined &&
      updateInspectionDto.branchCityId !== existingInspection.branchCityId
    ) {
      const newBranchCity = await this.prisma.inspectionBranchCity.findUnique({
        where: { id: updateInspectionDto.branchCityId },
        select: { city: true },
      });
      if (!newBranchCity) {
        throw new BadRequestException(
          `New branch city with ID "${updateInspectionDto.branchCityId}" not found.`,
        );
      }
      // Log change for identityDetails.cabangInspeksi
      changesToLog.push({
        inspectionId: id,
        changedByUserId: userId,
        fieldName: 'identityDetails',
        subFieldName: 'cabangInspeksi',
        subsubfieldname: null,
        oldValue: currentIdentityDetails?.cabangInspeksi ?? Prisma.JsonNull, // Safer access
        newValue: newBranchCity.city ?? Prisma.JsonNull,
      });
      this.logger.log(
        `Logged change for identityDetails.cabangInspeksi to "${newBranchCity.city}"`,
      );

      // Log change for branchCityId
      changesToLog.push({
        inspectionId: id,
        changedByUserId: userId,
        fieldName: 'branchCity',
        subFieldName: null,
        subsubfieldname: null,
        oldValue: existingInspection?.branchCityId ?? Prisma.JsonNull, // Safer access
        newValue: updateInspectionDto.branchCityId ?? Prisma.JsonNull,
      });
      this.logger.log(
        `Logged change for branchCityId "${updateInspectionDto.branchCityId}"`,
      );
    }

    // Handle changes to namaCustomer in identityDetails
    if (
      updateInspectionDto.identityDetails?.namaCustomer !== undefined &&
      updateInspectionDto.identityDetails.namaCustomer !==
        currentIdentityDetails?.namaCustomer
    ) {
      const newCustomerName = updateInspectionDto.identityDetails.namaCustomer;
      // Log change for identityDetails.namaCustomer
      changesToLog.push({
        inspectionId: id,
        changedByUserId: userId,
        fieldName: 'identityDetails',
        subFieldName: 'namaCustomer',
        subsubfieldname: null,
        oldValue: currentIdentityDetails?.namaCustomer ?? Prisma.JsonNull, // Safer access
        newValue: newCustomerName ?? Prisma.JsonNull,
      });
      this.logger.log(
        `Logged change for identityDetails.namaCustomer to "${newCustomerName}"`,
      );
    }

    // Define which top-level fields in Inspection are JSON and should be deep compared
    const jsonFieldsInInspectionModel: Array<
      keyof UpdateInspectionDto & keyof Inspection
    > = [
      // 'identityDetails', // identityDetails is handled separately above
      'vehicleData',
      'equipmentChecklist',
      'inspectionSummary',
      'detailedAssessment',
      'bodyPaintThickness',
      'notesFontSizes', // Added notesFontSizes
    ];

    // Iterate over the keys in the DTO (fields intended to be updated)
    // Use Object.keys and type assertion for better type safety than 'for...in' with hasOwnProperty
    for (const key of Object.keys(updateInspectionDto)) {
      const dtoKey = key;
      const newValue = updateInspectionDto[dtoKey]; // Value from the DTO
      // Access existingInspection using bracket notation with keyof Inspection type assertion
      const oldValue = (existingInspection as Inspection)[
        dtoKey as keyof Inspection
      ]; // Current value from DB

      if (newValue === undefined) continue; // Skip if DTO field is undefined (not meant to be updated)
      // Skip inspectorId, branchCityId, and identityDetails as they are handled separately/specifically
      if (
        dtoKey === 'inspectorId' ||
        dtoKey === 'branchCityId' ||
        dtoKey === 'identityDetails'
      )
        continue;

      // Convert Date objects to ISO strings before logging/comparing
      const processedNewValue =
        newValue instanceof Date ? newValue.toISOString() : newValue;
      const processedOldValue =
        oldValue instanceof Date ? oldValue.toISOString() : oldValue;

      // Check if the key is one of the JSON fields
      if ((jsonFieldsInInspectionModel as string[]).includes(dtoKey)) {
        this.logger.verbose(`Comparing JSON field: ${dtoKey}`);
        // For JSON fields, newValue from DTO is an object. oldValue from DB is also object/null.
        this.logJsonChangesRecursive(
          dtoKey,
          processedOldValue, // Cast to JsonValue
          processedNewValue, // Cast to JsonValue
          changesToLog,
          id,
          userId,
          [], // Start with an empty path for the top-level JSON field
        );
      } else {
        // Handle non-JSON, top-level fields (e.g., vehiclePlateNumber, overallRating)
        const oldValToLog =
          processedOldValue === undefined || processedOldValue === null
            ? Prisma.JsonNull
            : processedOldValue;
        const newValToLog =
          processedNewValue === undefined || processedNewValue === null
            ? Prisma.JsonNull
            : processedNewValue;

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

    // 3. Save all detected changes to the InspectionChangeLog table
    if (changesToLog.length > 0) {
      try {
        await this.prisma.inspectionChangeLog.createMany({
          data: changesToLog,
        });
        this.logger.log(
          `Logged ${changesToLog.length} changes for inspection ID: ${id}`,
        );
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : 'An unknown error occurred';
        const errorStack =
          error instanceof Error && error.stack
            ? error.stack
            : 'No stack trace available';
        this.logger.error(
          `Failed to log changes for inspection ID ${id}: ${errorMessage}`,
          errorStack,
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

    // 4. Do NOT update the Inspection record in this method.
    // Changes are logged and will be applied during the 'approveInspection' process.
    if (changesToLog.length > 0) {
      this.logger.log(
        `Changes logged for inspection ID: ${id}. Awaiting approval to apply.`,
      );
      return {
        message: `${changesToLog.length} changes have been logged for inspection ID "${id}". Please approve the inspection to apply these changes.`,
      };
    } else {
      this.logger.log(
        `No significant changes detected to log or apply for inspection ID: ${id}.`,
      );
      return {
        message: `No significant changes detected for inspection ID "${id}".`,
      };
    }
  }

  /**
   * Retrieves all inspection records, ordered by creation date descending.
   * Filters results based on the requesting user's role and optionally by status.
   * Admins/Reviewers see all by default. Customers/Developers/Inspectors only see ARCHIVED by default (if no status is specified).
   * If `status` is 'DATABASE', returns all inspections except those with status NEED_REVIEW, overriding role-based filtering.
   * Includes pagination and metadata.
   *
   * @param {Role | undefined} userRole - The role of the user making the request.
   * @param {InspectionStatus[] | 'DATABASE' | undefined} [status] - Optional filter by inspection status. Can be a single status, an array of statuses, or 'DATABASE' to retrieve all statuses except NEED_REVIEW, regardless of user role.
   * @param {number} page - The page number (1-based).
   * @param {number} pageSize - The number of items per page.
   * @returns {Promise<{ data: Inspection[], meta: { total: number, page: number, pageSize: number, totalPages: number } }>} An object containing an array of inspection records and pagination metadata.
   */
  async findAll(
    userRole: Role | undefined,
    status?: string | InspectionStatus[], // Accept string or array
    page: number = 1,
    pageSize: number = 10,
  ): Promise<{
    data: Inspection[];
    meta: { total: number; page: number; pageSize: number; totalPages: number };
  }> {
    this.logger.log(
      `Retrieving inspections for user role: ${userRole ?? 'N/A'}, status: ${
        Array.isArray(status) ? status.join(',') : (status ?? 'ALL (default)')
      }, page: ${page}, pageSize: ${pageSize}`,
    );

    // Initialize whereClause
    const whereClause: Prisma.InspectionWhereInput = {};

    let parsedStatus: InspectionStatus[] | 'DATABASE' | undefined;

    if (status === 'DATABASE') {
      parsedStatus = 'DATABASE';
    } else if (typeof status === 'string') {
      // If it's a comma-separated string (e.g., "ARCHIVED,NEED_REVIEW"), split it
      parsedStatus = status.split(',').map((s) => {
        const trimmedStatus = s.trim();
        if (!(trimmedStatus in InspectionStatus)) {
          // Log a warning or throw an error if an invalid status is provided
          this.logger.warn(
            `Invalid InspectionStatus provided: ${trimmedStatus}`,
          );
          throw new BadRequestException(
            `Invalid InspectionStatus: ${trimmedStatus}`,
          );
        }
        return trimmedStatus as InspectionStatus;
      });
    } else if (Array.isArray(status)) {
      // If it's already an array, use it directly after validation
      parsedStatus = status.map((s) => {
        const trimmedStatus = s.trim();
        if (!(trimmedStatus in InspectionStatus)) {
          this.logger.warn(
            `Invalid InspectionStatus provided: ${trimmedStatus}`,
          );
          throw new BadRequestException(
            `Invalid InspectionStatus: ${trimmedStatus}`,
          );
        }
        return trimmedStatus as InspectionStatus;
      });
    }

    // Apply status filter based on parsedStatus
    if (parsedStatus) {
      if (parsedStatus === 'DATABASE') {
        whereClause.status = { not: InspectionStatus.NEED_REVIEW };
        this.logger.log(
          `Applying filter: status = DATABASE (excluding NEED_REVIEW)`,
        );
      } else {
        whereClause.status = { in: parsedStatus };
        this.logger.log(
          `Applying filter: status in [${parsedStatus.join(',')}]`,
        );
      }
    } else {
      // Handle default status based on role ONLY IF no explicit status is provided
      if (
        userRole === Role.CUSTOMER ||
        userRole === Role.DEVELOPER ||
        userRole === Role.INSPECTOR
      ) {
        whereClause.status = InspectionStatus.ARCHIVED;
        this.logger.log(
          `Applying default filter for role ${userRole}: status = ARCHIVED (no specific status requested)`,
        );
      }
      // If Admin/Reviewer and no status is provided, whereClause.status remains empty (meaning they see all)
    }

    const skip = (page - 1) * pageSize;
    if (skip < 0) {
      this.logger.warn(
        `Invalid page number requested: ${page}. Page number must be positive.`,
      );
      throw new BadRequestException('Page number must be positive.');
    }

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
        `Retrieved ${
          inspections.length
        } inspections of ${total} total for role ${userRole ?? 'N/A'}.`,
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
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'An unknown error occurred';
      const errorStack =
        error instanceof Error ? error.stack : 'No stack trace available';
      this.logger.error(
        `Failed to retrieve inspections for role ${
          userRole ?? 'N/A'
        }: ${errorMessage}`,
        errorStack,
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
      if (
        userRole === Role.ADMIN ||
        userRole === Role.REVIEWER ||
        userRole === Role.SUPERADMIN
      ) {
        this.logger.log(
          `Admin/Reviewer/Superadmin access granted for inspection ${id}`,
        );
        return inspection; // Admins/Reviewers/Superadmins can see all statuses
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
    } catch (error: unknown) {
      // Use unknown
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
      const errorMessage =
        error instanceof Error ? error.message : 'An unknown error occurred';
      const errorStack =
        error instanceof Error ? error.stack : 'No stack trace available';
      this.logger.error(
        `Failed to retrieve inspection ID ${id}: ${errorMessage}`,
        errorStack,
      );
      throw new InternalServerErrorException(
        `Could not retrieve inspection ${id}.`,
      );
    }
  }

  /**
   * Generates, saves, and hashes a PDF from a given URL.
   * This is a helper function for `approveInspection`.
   * @param url The URL to generate the PDF from.
   * @param baseFileName The unique filename for the PDF.
   * @param token The JWT token for authentication.
   * @returns An object with the public URL, IPFS CID, and hash of the PDF.
   */
  private async _generateAndSavePdf(
    url: string,
    baseFileName: string,
    token: string | null,
  ): Promise<{ pdfPublicUrl: string; pdfCid: string; pdfHashString: string; pdfCloudUrl: string }> {
    const queueStats = this.pdfQueue.stats;
    this.logger.log(
      `Adding PDF generation to queue for ${baseFileName}. Queue status: ${queueStats.running}/${queueStats.queueLength + queueStats.running} (running/total)`,
    );

    // Log special warning for very large bulk operations
    if (queueStats.queueLength > 15) {
      this.logger.warn(
        `Very large bulk operation detected! ${queueStats.queueLength} PDFs queued. Estimated completion time: ${Math.ceil((queueStats.queueLength / 5) * 3)} minutes`,
      );
    }

    // Use queue to limit concurrent PDF generations
    return this.pdfQueue.add(async () => {
      this.logger.log(`Starting PDF generation for ${baseFileName}`);

      // Use retry mechanism for PDF generation
      const pdfBuffer = await this.retryWithBackoff(
        () => this.generatePdfFromUrl(url, token),
        3, // max retries
        2000, // base delay 2 seconds
        `PDF generation for ${baseFileName}`,
      );

      const pdfCid = await this.ipfsService.add(pdfBuffer);
      // Previously we saved PDFs to local disk. Now upload to Backblaze B2 instead.
      // const pdfFilePath = path.join(PDF_ARCHIVE_PATH, baseFileName);
      // await fs.writeFile(pdfFilePath, pdfBuffer);
      // this.logger.log(`PDF report saved to: ${pdfFilePath}`);

      // Upload buffer to Backblaze and get public URL
      let uploadedUrl: string;
      try {
        uploadedUrl = await this.backblazeService.uploadPdfBuffer(
          pdfBuffer,
          baseFileName,
        );
        this.logger.log(`PDF uploaded to Backblaze: ${uploadedUrl}`);
      } catch (uploadErr: unknown) {
        let uploadMsg: string;
        if (uploadErr instanceof Error) {
          uploadMsg = uploadErr.message;
        } else {
          uploadMsg = 'Unknown upload error';
        }
        this.logger.error(`Failed to upload PDF to Backblaze: ${uploadMsg}`);
        // Re-throw so calling flow can handle/rollback
        throw uploadErr as Error;
      }

      const hash = crypto.createHash('sha256');
      hash.update(pdfBuffer);
      const pdfHashString = hash.digest('hex');
      this.logger.log(
        `PDF hash calculated for ${baseFileName}: ${pdfHashString}`,
      );

      // Persist proxied path so frontend can fetch via our domain and the proxy.
      // Store the proxied route under /v1/pdfarchived to minimize path confusion.
      const pdfPublicUrl = `/v1/pdfarchived/${baseFileName}`;

      const finalStats = this.pdfQueue.stats;
      this.logger.log(
        `PDF generation completed for ${baseFileName}. Queue stats: processed=${finalStats.totalProcessed}, errors=${finalStats.totalErrors}`,
      );

      return { pdfPublicUrl, pdfCid, pdfHashString, pdfCloudUrl: uploadedUrl  };
    });
  }

  /**
   * Approves an inspection, applies the latest logged change for each field,
   * generates and stores the PDF, calculates its hash, and changes status to APPROVED.
   * Fetches the latest changes from InspectionChangeLog and updates the Inspection record.
   * Records the reviewer ID and optionally clears applied change logs.
   * Enhanced with better error handling and automatic rollback to NEED_REVIEW on failure.
   *
   * @param {string} inspectionId - The UUID of the inspection to approve.
   * @param {string} reviewerId - The UUID of the user (REVIEWER/ADMIN) approving.
   * @param {string | null} token - The JWT token of the reviewer.
   * @returns {Promise<Inspection>} The updated inspection record.
   * @throws {NotFoundException} If inspection not found.
   * @throws {BadRequestException} If inspection is not in NEED_REVIEW or FAIL_ARCHIVE state.
   * @throws {InternalServerErrorException} For database errors or PDF generation issues.
   */
  async approveInspection(
    inspectionId: string,
    reviewerId: string,
    token: string | null, // Accept the token
  ): Promise<Inspection> {
    const startTime = Date.now();
    const queueStatsBefore = this.pdfQueue.stats;

    this.logger.log(
      `Reviewer ${reviewerId} attempting to approve inspection ${inspectionId}. Queue status: ${queueStatsBefore.running} running, ${queueStatsBefore.queueLength} queued`,
    );

    // Warning if queue is getting too busy (may indicate bulk approve)
    if (queueStatsBefore.queueLength > 15) {
      this.logger.warn(
        `PDF generation queue is very busy with ${queueStatsBefore.queueLength} items queued. Large bulk approval detected (possibly 10+ inspections).`,
      );
    } else if (queueStatsBefore.queueLength > 8) {
      this.logger.warn(
        `PDF generation queue is busy with ${queueStatsBefore.queueLength} items queued. Bulk approval in progress.`,
      );
    }

    if (queueStatsBefore.circuitBreakerOpen) {
      this.logger.error(
        `PDF generation circuit breaker is open. Cannot process approval for inspection ${inspectionId}`,
      );
      throw new InternalServerErrorException(
        'PDF generation service is temporarily unavailable due to consecutive failures. Please try again later.',
      );
    }

    let updatedInspectionWithChanges: Inspection | null = null;
    let originalStatus: InspectionStatus | null = null;

    try {
      // --- Transactional Database Update with Row Locking ---
      updatedInspectionWithChanges = await this.prisma.$transaction(
        async (tx) => {
          // 1. Find the inspection with row-level locking to prevent concurrent modifications
          const inspection = await tx.inspection.findUnique({
            where: { id: inspectionId },
          });

          if (!inspection) {
            throw new NotFoundException(
              `Inspection with ID "${inspectionId}" not found for approval.`,
            );
          }

          // Store original status for potential rollback
          originalStatus = inspection.status;

          // Enhanced status validation with more detailed error messages
          if (
            inspection.status !== InspectionStatus.NEED_REVIEW &&
            inspection.status !== InspectionStatus.FAIL_ARCHIVE
          ) {
            this.logger.warn(
              `Approval attempt rejected for inspection ${inspectionId}: status is '${inspection.status}', expected 'NEED_REVIEW' or 'FAIL_ARCHIVE'`,
            );
            throw new BadRequestException(
              `Inspection ${inspectionId} cannot be approved. Current status is '${inspection.status}'. Required: '${InspectionStatus.NEED_REVIEW}' or '${InspectionStatus.FAIL_ARCHIVE}'. This may indicate the inspection was already processed by another reviewer.`,
            );
          }

          // Set status to processing to prevent concurrent approvals
          await tx.inspection.update({
            where: { id: inspectionId },
            data: {
              status: InspectionStatus.APPROVED, // Temporary status during processing
              reviewer: { connect: { id: reviewerId } }, // Set reviewer immediately
            },
          });

          // 2. Fetch all change logs for this inspection
          const allChanges = await tx.inspectionChangeLog.findMany({
            where: { inspectionId: inspectionId },
            orderBy: { changedAt: 'desc' },
          });

          const latestChanges = new Map<string, InspectionChangeLog>();
          for (const log of allChanges) {
            let key = log.fieldName;
            if (log.subFieldName) {
              key += `.${log.subFieldName}`;
              if (log.subsubfieldname) {
                key += `.${log.subsubfieldname}`;
              }
            }
            if (!latestChanges.has(key)) {
              latestChanges.set(key, log);
            }
          }

          // 3. Apply the latest changes to the inspection data
          const updateData: Prisma.InspectionUpdateInput = {};
          const jsonUpdatableFields: (keyof Inspection)[] = [
            'identityDetails',
            'vehicleData',
            'equipmentChecklist',
            'inspectionSummary',
            'detailedAssessment',
            'bodyPaintThickness',
            'notesFontSizes',
          ];

          for (const [fieldKey, changeLog] of latestChanges) {
            const value = changeLog.newValue;
            const parts = fieldKey.split('.');
            const fieldName = parts[0] as keyof Inspection;

            if (parts.length === 1) {
              if (parts[0] === 'inspector' && typeof value === 'string') {
                updateData.inspector = { connect: { id: value } };
              } else if (
                parts[0] === 'branchCity' &&
                typeof value === 'string'
              ) {
                updateData.branchCity = { connect: { id: value } };
              } else if (
                Object.prototype.hasOwnProperty.call(inspection, fieldName)
              ) {
                if (
                  fieldName === 'vehiclePlateNumber' &&
                  typeof value === 'string'
                ) {
                  updateData.vehiclePlateNumber = value;
                } else if (
                  fieldName === 'inspectionDate' &&
                  typeof value === 'string'
                ) {
                  updateData.inspectionDate = new Date(value);
                } else if (
                  fieldName === 'overallRating' &&
                  typeof value === 'string'
                ) {
                  updateData.overallRating = value;
                }
              }
            } else if ((jsonUpdatableFields as string[]).includes(fieldName)) {
              // Ensure updateData[fieldName] is an object for nested updates
              if (
                !updateData[fieldName] ||
                typeof updateData[fieldName] !== 'object' ||
                Array.isArray(updateData[fieldName])
              ) {
                updateData[fieldName] = inspection[fieldName]
                  ? {
                      ...(inspection[fieldName] as Record<
                        string,
                        Prisma.JsonValue
                      >),
                    } // Explicitly cast to Record
                  : {};
              }

              let current: Record<string, Prisma.JsonValue> = updateData[
                fieldName
              ] as Record<string, Prisma.JsonValue>; // Explicitly type current
              for (let i = 1; i < parts.length - 1; i++) {
                const part = parts[i];
                if (
                  !current[part] ||
                  typeof current[part] !== 'object' ||
                  Array.isArray(current[part])
                ) {
                  current[part] = {};
                }
                current = current[part] as Record<string, Prisma.JsonValue>; // Re-assign with explicit cast
              }

              const lastPart = parts[parts.length - 1];
              // Check for inspectionSummary.estimasiPerbaikan and parse if string
              if (
                fieldName === 'inspectionSummary' &&
                parts.length === 2 && // Assuming estimasiPerbaikan is always a sub-sub-field
                lastPart === 'estimasiPerbaikan'
              ) {
                if (typeof value === 'string') {
                  try {
                    current[lastPart] = JSON.parse(value as string); // Explicitly cast value to string
                    this.logger.log(
                      `Parsed inspectionSummary.estimasiPerbaikan as JSON for inspection ${inspectionId}`,
                    );
                  } catch (e: unknown) {
                    // If parsing fails, it means the string was not valid JSON.
                    // Throw a BadRequestException to inform the client.
                    const errorMessage =
                      e instanceof Error ? e.message : 'Unknown parsing error';
                    this.logger.error(
                      `Failed to parse inspectionSummary.estimasiPerbaikan as JSON for inspection ${inspectionId}. Value: "${value}". Error: ${errorMessage}`,
                    );
                    throw new BadRequestException(
                      `Invalid JSON format for inspectionSummary.estimasiPerbaikan. Expected a valid JSON string, but received: "${value}". Parsing error: ${errorMessage}`,
                    );
                  }
                } else {
                  // If it's not a string, assign it directly (e.g., if it's already an object/array)
                  current[lastPart] = value;
                }
              } else {
                // For all other fields or if not estimasiPerbaikan, assign directly
                current[lastPart] = value;
              }
            }
          }

          // 4. Apply the changes to the inspection record (merge with status update)
          const finalUpdateData = {
            ...updateData,
            // Status and reviewer were already updated above to prevent race conditions
          };

          // Only update if there are actual changes to apply beyond status/reviewer
          if (Object.keys(updateData).length > 0) {
            await tx.inspection.update({
              where: { id: inspectionId },
              data: finalUpdateData,
            });
            this.logger.log(
              `Applied ${Object.keys(updateData).length} field changes to inspection ${inspectionId}`,
            );
          }

          // Return the updated inspection
          const updatedInspection = await tx.inspection.findUniqueOrThrow({
            where: { id: inspectionId },
          });

          this.logger.log(
            `Inspection ${inspectionId} database updates completed by reviewer ${reviewerId}`,
          );
          return updatedInspection;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 10000, // Increased wait time for bulk operations
          timeout: 30000, // Increased timeout
        },
      );

      // --- PDF Generation (Post-Transaction) with Enhanced Error Handling ---
      const timestamp = Date.now();
      const basePrettyId = updatedInspectionWithChanges.pretty_id;

      const fullPdfUrl = `${this.config.getOrThrow<string>(
        'CLIENT_BASE_URL_PDF',
      )}/data/${inspectionId}`;
      const noDocsPdfUrl = `${this.config.getOrThrow<string>(
        'CLIENT_BASE_URL_PDF',
      )}/pdf/${inspectionId}`;

      const fullPdfFileName = `${basePrettyId}-${timestamp}.pdf`;
      const noDocsPdfFileName = `${basePrettyId}-no-confidential-${timestamp}.pdf`;

      try {
        this.logger.log(
          `Starting PDF generation for inspection ${inspectionId}: ${fullPdfFileName}, ${noDocsPdfFileName}`,
        );

        const [fullPdfResult, noDocsPdfResult] = await Promise.all([
          this._generateAndSavePdf(fullPdfUrl, fullPdfFileName, token),
          this._generateAndSavePdf(noDocsPdfUrl, noDocsPdfFileName, token),
        ]);

        // Audit: PDFs uploaded (implies generated)
        this.audit.log({
          rid: 'n/a',
          actorId: reviewerId,
          action: 'PDF_UPLOADED',
          resource: 'inspection',
          subjectId: inspectionId,
          result: 'SUCCESS',
          meta: { type: 'FULL', file: fullPdfFileName, url: fullPdfResult.pdfCloudUrl },
        });
        this.audit.log({
          rid: 'n/a',
          actorId: reviewerId,
          action: 'PDF_UPLOADED',
          resource: 'inspection',
          subjectId: inspectionId,
          result: 'SUCCESS',
          meta: { type: 'NO_DOCS', file: noDocsPdfFileName, url: noDocsPdfResult.pdfCloudUrl },
        });

        // --- Final Database Update with PDF info and Final Status ---
        const finalUpdateData: Prisma.InspectionUpdateInput = {
          status: InspectionStatus.APPROVED, // Ensure final approved status
          urlPdf: fullPdfResult.pdfPublicUrl,
          urlPdfCloud: fullPdfResult.pdfCloudUrl,
          pdfFileHash: fullPdfResult.pdfHashString,
          ipfsPdf: `ipfs://${fullPdfResult.pdfCid}`,
          urlPdfNoDocs: noDocsPdfResult.pdfPublicUrl,
          urlPdfNoDocsCloud: noDocsPdfResult.pdfCloudUrl,
          pdfFileHashNoDocs: noDocsPdfResult.pdfHashString,
          ipfsPdfNoDocs: `ipfs://${noDocsPdfResult.pdfCid}`,
        };

        const finalInspection = await this.prisma.inspection.update({
          where: { id: inspectionId },
          data: finalUpdateData,
        });

        const totalTime = Date.now() - startTime;
        const queueStatsAfter = this.pdfQueue.stats;

        this.logger.log(
          `Inspection ${inspectionId} approved successfully in ${totalTime}ms. Queue stats: processed=${queueStatsAfter.totalProcessed}, errors=${queueStatsAfter.totalErrors}`,
        );

        return finalInspection;
      } catch (pdfError: unknown) {
        // Enhanced error handling with automatic rollback to NEED_REVIEW
        const errorMessage =
          pdfError instanceof Error
            ? pdfError.message
            : 'Unknown PDF generation error';

        this.logger.error(
          `PDF generation failed for inspection ${inspectionId}: ${errorMessage}`,
          pdfError instanceof Error ? pdfError.stack : 'No stack trace',
        );

        // Use helper method for rollback
        if (originalStatus) {
          await this.rollbackInspectionStatusAfterError(
            inspectionId,
            originalStatus,
          );
        }

        // Determine error type and message for client
        if (
          pdfError instanceof Error &&
          pdfError.message.includes('circuit breaker')
        ) {
          throw new InternalServerErrorException(
            'PDF generation service is temporarily overloaded. The inspection status has been reset to NEED_REVIEW. Please try again in a few minutes.',
          );
        } else if (
          pdfError instanceof Error &&
          pdfError.message.includes('timeout')
        ) {
          throw new InternalServerErrorException(
            `PDF generation timed out for inspection ${inspectionId}. The inspection status has been reset to NEED_REVIEW. Please try again.`,
          );
        } else {
          throw new InternalServerErrorException(
            `PDF generation failed for inspection ${inspectionId}: ${errorMessage}. The inspection status has been reset to NEED_REVIEW. Please try again.`,
          );
        }
      }
    } catch (transactionError: unknown) {
      // Handle database transaction errors
      const errorMessage =
        transactionError instanceof Error
          ? transactionError.message
          : 'Unknown database error';

      this.logger.error(
        `Database transaction failed for inspection ${inspectionId}: ${errorMessage}`,
        transactionError instanceof Error
          ? transactionError.stack
          : 'No stack trace',
      );

      // Check for specific database errors
      if (
        transactionError instanceof BadRequestException ||
        transactionError instanceof NotFoundException
      ) {
        throw transactionError; // Re-throw validation errors as-is
      }

      throw new InternalServerErrorException(
        `Failed to process inspection approval for ${inspectionId}: ${errorMessage}`,
      );
    }
  }

  /**
   * Generates PDF from a frontend URL using Puppeteer.
   * @param url The URL of the frontend page to render.
   * @param token Optional JWT token to include in headers.
   * @returns A Buffer containing the generated PDF data.
   */
  private async generatePdfFromUrl(
    url: string,
    token: string | null, // Accept the token
  ): Promise<Buffer> {
    let browser: Browser | null = null;
    this.logger.log(`Generating PDF from URL: ${url}`);

    // Add a random delay to help with concurrent requests (adaptive based on queue size)
    const currentQueueStats = this.pdfQueue.stats;
    let delayMultiplier = 1000; // Base 1 second

    if (currentQueueStats.queueLength > 15) {
      delayMultiplier = 5000; // 0-5s for very large bulk (10+ inspections)
    } else if (currentQueueStats.queueLength > 8) {
      delayMultiplier = 3000; // 0-3s for large bulk (5-10 inspections)
    } else if (currentQueueStats.queueLength > 3) {
      delayMultiplier = 2000; // 0-2s for medium bulk (3-5 inspections)
    }

    const randomDelay = Math.random() * delayMultiplier;
    await this.sleep(randomDelay);

    this.logger.debug(
      `Applied ${Math.round(randomDelay)}ms delay for queue size ${currentQueueStats.queueLength}`,
    );

    try {
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--memory-pressure-off',
          '--max_old_space_size=4096',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-ipc-flooding-protection',
          '--disable-hang-monitor',
          '--disable-client-side-phishing-detection',
          '--disable-component-update',
          '--disable-default-apps',
          '--disable-domain-reliability',
          '--disable-extensions',
          '--disable-features=TranslateUI',
          '--disable-sync',
          '--hide-scrollbars',
          '--mute-audio',
          '--no-default-browser-check',
          '--no-first-run',
        ],
        executablePath: '/usr/bin/chromium-browser',
        timeout: 60000, // 1 minute timeout for browser launch
        protocolTimeout: 600000, // 10 minutes timeout for protocol operations
      });

      const page = await browser.newPage();

      // Set proper viewport for web content (maintain original layout)
      await page.setViewport({
        width: 1200, // Standard desktop width
        height: 1600, // Sufficient height for content
        deviceScaleFactor: 1,
      });

      // Get compression level from environment
      const compressionLevel = process.env.PDF_COMPRESSION_LEVEL || 'low';
      const enableOptimization = compressionLevel !== 'none';

      // Only apply optimizations if compression is enabled
      if (enableOptimization) {
        await page.setRequestInterception(true);
        page.on('request', (req) => {
          const resourceType = req.resourceType();
          const requestUrl = req.url();

          // Only block truly unnecessary resources, KEEP images and fonts
          if (
            requestUrl.includes('analytics') ||
            requestUrl.includes('tracking') ||
            requestUrl.includes('ads') ||
            requestUrl.includes('facebook.com') ||
            requestUrl.includes('google-analytics') ||
            requestUrl.includes('googletag') ||
            requestUrl.includes('doubleclick') ||
            resourceType === 'websocket' ||
            resourceType === 'eventsource'
          ) {
            void req.abort();
          } else {
            // Allow all other resources including images, fonts, stylesheets
            void req.continue();
          }
        });
      }

      if (token) {
        const headers: Record<string, string> = {
          Authorization: `Bearer ${token}`,
        };
        await page.setExtraHTTPHeaders(headers);
        this.logger.debug(
          'Added Authorization header to Puppeteer navigation.',
        );
      }

      this.logger.log(`Navigating to ${url}`);

      // Use different wait strategies based on network conditions
      let waitUntil: 'load' | 'networkidle0' | 'networkidle2' = 'networkidle0';

      try {
        await page.goto(url, {
          waitUntil,
          timeout: 600000, // Increased to 10 minutes for better reliability
        });
      } catch (navigationError: unknown) {
        // If networkidle0 fails, try with networkidle2
        const errorMsg =
          navigationError instanceof Error
            ? navigationError.message
            : 'Unknown error';
        this.logger.warn(
          `Navigation with ${waitUntil} failed (${errorMsg}), trying with 'networkidle2' strategy`,
        );
        waitUntil = 'networkidle2';
        await page.goto(url, {
          waitUntil,
          timeout: 600000,
        });
      }

      await page.waitForSelector('#glosarium', {
        visible: true,
        timeout: 600000, // Increased to 10 minutes for better reliability
      });

      // Wait for images to load
      this.logger.log('Waiting for images to load...');
      await page.evaluate(async () => {
        const images = Array.from(document.querySelectorAll('img'));
        await Promise.all(
          images.map((img) => {
            if (img.complete) return Promise.resolve();
            return new Promise((resolve, reject) => {
              img.addEventListener('load', resolve);
              img.addEventListener('error', reject);
              // Fallback timeout for individual images
              setTimeout(resolve, 10000); // 10 seconds max per image
            });
          }),
        );
      });

      // Additional wait to ensure everything is rendered
      await this.sleep(2000); // 2 second buffer
      this.logger.log('All images loaded, proceeding with PDF generation...');

      // Only apply CSS optimizations if compression is enabled
      if (enableOptimization) {
        await page.addStyleTag({
          content: `
            @media print {
              * {
                -webkit-print-color-adjust: exact !important;
                color-adjust: exact !important;
              }
              /* Keep images intact and visible */
              img {
                max-width: 100% !important;
                height: auto !important;
                display: block !important;
                page-break-inside: avoid !important;
              }
              /* Only remove heavy decorative elements that don't affect content */
              .shadow:not(.inspection-shadow), .drop-shadow:not(.inspection-shadow) {
                box-shadow: none !important;
                filter: none !important;
              }
            }
          `,
        });

        // Very light optimization - only remove truly unnecessary elements
        await page.evaluate(() => {
          // Remove only video elements that are clearly not part of inspection
          const heavyElements = document.querySelectorAll(
            'video:not([data-inspection]):not([class*="inspection"])',
          );
          heavyElements.forEach((el) => {
            (el as HTMLElement).style.display = 'none';
          });
        });
      }

      this.logger.log(`Generating PDF with ${compressionLevel} compression...`);

      // Use conservative scale values to maintain layout quality
      let scale = 1.0; // Default: no scaling for best quality

      switch (compressionLevel) {
        case 'high':
          scale = 0.85; // Modest reduction
          break;
        case 'medium':
          scale = 0.9; // Light reduction
          break;
        case 'low':
        case 'none':
          scale = 1.0; // No scaling
          break;
      }

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: false,
        displayHeaderFooter: false,
        margin: {
          top: '10mm',
          bottom: '10mm',
          left: '10mm',
          right: '10mm',
        },
        scale,
        omitBackground: false,
        timeout: 600000, // Increased to 10 minutes for better reliability
        tagged: compressionLevel === 'none', // Only tag for highest quality
      });

      const sizeInMB = (pdfBuffer.length / 1024 / 1024).toFixed(2);
      this.logger.log(`PDF generated successfully from ${url}`);
      this.logger.log(
        `PDF size: ${sizeInMB} MB (compression: ${compressionLevel})`,
      );

      return Buffer.from(pdfBuffer);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'An unknown error occurred';
      const errorStack =
        error instanceof Error ? error.stack : 'No stack trace available';
      this.logger.error(
        `Failed to generate PDF from URL ${url}: ${errorMessage}`,
        errorStack,
      );
      throw new InternalServerErrorException(
        `Could not generate PDF report from URL: ${errorMessage}`,
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

    // Ensure required metadata fields are present for minting
    if (!inspection.vehiclePlateNumber) {
      this.logger.error(
        `Missing vehiclePlateNumber for inspection ${inspectionId}. Cannot mint NFT.`,
      );
      throw new BadRequestException(
        `Missing vehicle plate number for inspection ${inspectionId}. Cannot mint NFT.`,
      );
    }
    if (!inspection.pdfFileHash) {
      this.logger.error(
        `Missing PDF file hash for inspection ${inspectionId}. Cannot mint NFT.`,
      );
      throw new BadRequestException(
        `Missing PDF file hash for inspection ${inspectionId}. Cannot mint NFT.`,
      );
    }
    if (!inspection.pdfFileHashNoDocs) {
      this.logger.error(
        `Missing PDF file hash no docs for inspection ${inspectionId}. Cannot mint NFT.`,
      );
      throw new BadRequestException(
        `Missing PDF file hash no docs for inspection ${inspectionId}. Cannot mint NFT.`,
      );
    }

    try {
      // 2. Minting (with blockchain queue to prevent UTXO conflicts)
      let blockchainResult: { txHash: string; assetId: string } | null = null;
      let blockchainSuccess = false;

      try {
        // Now that we've checked for null, we can safely assert these are strings for the metadata type
        // Build metadata for NFT minting. We include a hashed vehicle number for privacy
        // and attach inspection details required for attributes.
        const vehicleHashObj = this.getVehicleNumberHashForMetadata(
          inspection.vehiclePlateNumber,
        );

        // Safely extract vehicleData (it may be stored as JSON object or JSON string)
        let vehicleDataObj: Record<string, unknown> = {};
        try {
          if (typeof inspection.vehicleData === 'string') {
            vehicleDataObj = JSON.parse(
              inspection.vehicleData as string,
            ) as Record<string, unknown>;
          } else if (
            inspection.vehicleData &&
            typeof inspection.vehicleData === 'object'
          ) {
            vehicleDataObj = inspection.vehicleData as Record<string, unknown>;
          }
        } catch (err: unknown) {
          this.logger.warn(
            `Failed to parse vehicleData for inspection ${inspectionId}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
          vehicleDataObj = {};
        }

        const carBrandValue = (vehicleDataObj['merekKendaraan'] ??
          vehicleDataObj['merek'] ??
          vehicleDataObj['brand']) as string | undefined;
        const carTypeValue = (vehicleDataObj['tipeKendaraan'] ??
          vehicleDataObj['tipekendaraan'] ??
          vehicleDataObj['tipe'] ??
          vehicleDataObj['model']) as string | undefined;

        const carBrandNorm =
          this.normalizeVehicleField(carBrandValue) ?? 'Unknown';
        const carTypeNorm =
          this.normalizeVehicleField(carTypeValue) ?? 'Unknown';

        const metadataForNft: NftMetadata & Partial<InspectionNftMetadata> = {
          // Do not include plaintext vehicleNumber on-chain if privacy is desired.
          vehicleNumber: null,
          pdfHash: inspection.pdfFileHashNoDocs,
          // hashed vehicle number and algorithm for verification/audit off-chain
          // these will be included in metadata attributes by the blockchain service
          // by reading these fields (vehicleNumberHash/vehicleNumberAlg).
          ...(vehicleHashObj as Record<string, unknown>),
          name: `${carBrandNorm} Used Car Record ${inspection.pretty_id}-${String(
            Date.now(),
          ).slice(-8)}`,
          // inspection-level fields (ensure correct types)
          inspectionDate: inspection.inspectionDate
            ? new Date(inspection.inspectionDate).toISOString()
            : new Date().toISOString(),
          overallRating:
            typeof inspection.overallRating === 'number'
              ? inspection.overallRating
              : Number(inspection.overallRating) || 0,
          carBrand: carBrandNorm,
          carType: carTypeNorm,
        } as unknown as NftMetadata & Partial<InspectionNftMetadata>;
        // Hapus field null/undefined dari metadata jika perlu (This step might be redundant now with checks above, but kept for safety)
        Object.keys(metadataForNft).forEach((key) =>
          metadataForNft[key] === undefined || metadataForNft[key] === null
            ? delete metadataForNft[key]
            : {},
        );

        // Ensure an asset name that is short and unique to avoid assetId collisions. Use first 8 chars of PDF hash or fallback to inspectionId.
        const shortHash = (() => {
          if (
            typeof inspection.pdfFileHashNoDocs === 'string' &&
            inspection.pdfFileHashNoDocs.length >= 8
          ) {
            return inspection.pdfFileHashNoDocs.slice(0, 8);
          }
          return inspectionId.replace(/-/g, '').slice(0, 8);
        })();

        // assign name field on metadata (will be sanitized later in BlockchainService)
        (metadataForNft as Partial<InspectionNftMetadata>).simpleAssetName =
          `CAR-dano-${shortHash}`;

        // Log blockchain queue stats before adding to queue
        const queueStats = this.blockchainQueue.stats;
        this.logger.log(
          `Adding blockchain minting to queue for inspection ${inspectionId}. Queue status: ${queueStats.running}/${queueStats.queueLength + queueStats.running} (running/total)`,
        );

        this.logger.log(
          `Calling blockchainService.mintInspectionNft for inspection ${inspectionId}`,
        );

        // Use blockchain queue to prevent UTXO conflicts
        blockchainResult = await this.blockchainQueue.add(async () => {
          return await this.blockchainService.mintInspectionNft(
            metadataForNft as unknown as InspectionNftMetadata,
          );
        });

        blockchainSuccess = true;
        this.logger.log(
          `Blockchain interaction SUCCESS for inspection ${inspectionId}`,
        );
        // Audit: mint success
        this.audit.log({
          rid: 'n/a',
          actorId: userId,
          action: 'MINT_SUCCESS',
          resource: 'inspection',
          subjectId: inspectionId,
          result: 'SUCCESS',
          meta: { txHash: blockchainResult?.txHash, assetId: blockchainResult?.assetId },
        });
      } catch (blockchainError: unknown) {
        const errorMessage =
          blockchainError instanceof Error
            ? blockchainError.message
            : 'An unknown blockchain error occurred';
        const errorStack =
          blockchainError instanceof Error
            ? blockchainError.stack
            : 'No stack trace available';
        this.logger.error(
          `Blockchain interaction FAILED for inspection ${inspectionId}: ${errorMessage}`,
          errorStack,
        );
        blockchainSuccess = false;
        // Audit: mint failure
        this.audit.log({
          rid: 'n/a',
          actorId: userId,
          action: 'MINT_FAILURE',
          resource: 'inspection',
          subjectId: inspectionId,
          result: 'FAILURE',
          reason: errorMessage,
        });
      }

      // 3. Update Inspection Record in DB (Final Status)
      // Requirement: if minting fails, keep the inspection as APPROVED (allow manual retry later)
      const finalStatus = blockchainSuccess
        ? InspectionStatus.ARCHIVED
        : InspectionStatus.APPROVED; // changed from FAIL_ARCHIVE to APPROVED on mint failure

      // Build update data but do not explicitly set optional fields to `null`.
      // If we write `null` for `nftAssetId` we risk clearing an existing value
      // when a concurrent record already claimed the assetId (P2002). Instead,
      // only include nftAssetId and blockchainTxHash when we actually have a value.
      const updateDataBase: Prisma.InspectionUpdateInput = {
        status: finalStatus,
        archivedAt: blockchainSuccess ? new Date() : null,
      };

      const updateData = {
        ...updateDataBase,
        // Only attach nftAssetId when we received a non-empty assetId from the
        // blockchain operation. This avoids writing `NULL` into the DB.
        ...(blockchainSuccess && blockchainResult?.assetId
          ? { nftAssetId: blockchainResult.assetId }
          : {}),
        ...(blockchainSuccess && blockchainResult?.txHash
          ? { blockchainTxHash: blockchainResult.txHash }
          : {}),
      } as Prisma.InspectionUpdateInput;
      let finalInspection: Inspection;
      try {
        finalInspection = await this.prisma.inspection.update({
          where: { id: inspectionId },
          data: updateData,
        });
      } catch (dbErr: unknown) {
        // Handle unique constraint on nft_asset_id gracefully (another record already used this assetId)
        if (
          dbErr instanceof Prisma.PrismaClientKnownRequestError &&
          dbErr.code === 'P2002'
        ) {
          const meta = dbErr.meta as unknown;
          const metaHasNftTarget =
            meta &&
            typeof meta === 'object' &&
            Array.isArray((meta as { target?: unknown }).target) &&
            ((meta as { target?: unknown }).target as unknown[]).some(
              (t) => String(t) === 'nft_asset_id',
            );

          if (metaHasNftTarget) {
            this.logger.warn(
              `nft_asset_id conflict when updating inspection ${inspectionId}. Another record already uses this assetId. Retrying update without nftAssetId.`,
            );
            // remove nftAssetId from updateData and retry
            const safeUpdate = { ...updateData } as Record<string, unknown>;
            if ('nftAssetId' in safeUpdate) delete safeUpdate.nftAssetId;
            // Attempt a second update without nftAssetId
            finalInspection = await this.prisma.inspection.update({
              where: { id: inspectionId },
              data: safeUpdate as Prisma.InspectionUpdateInput,
            });
          } else {
            throw dbErr;
          }
        } else {
          throw dbErr;
        }
      }
      this.logger.log(
        `Inspection ${inspectionId} final status set to ${finalStatus}.`,
      );
      return finalInspection;
    } catch (error: unknown) {
      // Catch errors from URL fetch, PDF conversion, file saving, hashing, or the final DB update
      const errorMessage =
        error instanceof Error ? error.message : 'An unknown error occurred';
      const errorStack =
        error instanceof Error ? error.stack : 'No stack trace available';
      this.logger.error(
        `Archiving process failed during PDF generation or subsequent steps for inspection ${inspectionId}: ${errorMessage}`,
        errorStack,
      );

      // Attempt to revert status if stuck in ARCHIVING (best effort)
      try {
        await this.prisma.inspection.updateMany({
          where: { id: inspectionId, status: InspectionStatus.ARCHIVING },
          data: { status: InspectionStatus.APPROVED },
        });
        this.logger.log(
          `Inspection ${inspectionId} status reverted to APPROVED due to error.`,
        );
      } catch (revertError: unknown) {
        const revertErrorMessage =
          revertError instanceof Error
            ? revertError.message
            : 'An unknown error occurred during revert';
        const revertErrorStack =
          revertError instanceof Error
            ? revertError.stack
            : 'No stack trace available during revert';
        this.logger.error(
          `Failed to revert status from ARCHIVING for inspection ${inspectionId} after error: ${revertErrorMessage}`,
          revertErrorStack,
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
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'An unknown error occurred';
      const errorStack =
        error instanceof Error ? error.stack : 'No stack trace available';
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      )
        throw error;
      this.logger.error(
        `Failed to reactivate inspection ${inspectionId}: ${errorMessage}`,
        errorStack,
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
            `Inspection ${inspectionId} cannot be reactivated because its current status is '${exists.status}', not '${InspectionStatus.ARCHIVED}'.`,
          );
        }
      }
      this.logger.log(
        `Inspection ${inspectionId} reactivated by user ${userId}`,
      );
      return this.prisma.inspection.findUniqueOrThrow({
        where: { id: inspectionId },
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'An unknown error occurred';
      const errorStack =
        error instanceof Error ? error.stack : 'No stack trace available';
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      )
        throw error;
      this.logger.error(
        `Failed to reactivate inspection ${inspectionId}: ${errorMessage}`,
        errorStack,
      );
      throw new InternalServerErrorException(
        `Could not reactivate inspection ${inspectionId}.`,
      );
    }
  }

  /**
   * Tahap 1: Mempersiapkan data dan membangun unsigned transaction.
   * Fungsi ini dipanggil oleh frontend untuk mendapatkan transaksi yang siap ditandatangani.
   * @param inspectionId ID dari inspeksi yang akan di-mint.
   * @param adminAddress Alamat admin yang akan menandatangani, didapat dari frontend.
   * @returns Objek yang berisi unsignedTx dan nftAssetId.
   */
  async buildArchiveTransaction(inspectionId: string, adminAddress: string) {
    this.logger.log(
      `Memulai pembangunan transaksi untuk inspeksi: ${inspectionId}`,
    );

    // 1. Lakukan validasi bisnis yang sama seperti di processToArchive
    const inspection = await this.prisma.inspection.findUnique({
      where: { id: inspectionId },
    });
    if (!inspection)
      throw new NotFoundException(`Inspeksi ${inspectionId} tidak ditemukan.`);
    if (inspection.status !== InspectionStatus.APPROVED) {
      throw new BadRequestException(
        `Inspeksi ${inspectionId} tidak bisa di-mint. Status: ${inspection.status}`,
      );
    }
    if (!inspection.vehiclePlateNumber || !inspection.pdfFileHashNoDocs) {
      throw new BadRequestException(
        `Data inspeksi ${inspectionId} tidak lengkap untuk minting.`,
      );
    }

    // 2. Siapkan data untuk dikirim ke blockchain service
    const buildDto: BuildMintTxDto = {
      adminAddress: adminAddress,
      inspectionData: {
        vehicleNumber: inspection.vehiclePlateNumber,
        pdfHash: inspection.pdfFileHashNoDocs,
        nftDisplayName: `Car Inspection ${inspection.vehiclePlateNumber}`,
      },
    };

    // 3. Delegasikan pembangunan transaksi ke BlockchainService
    return this.blockchainService.buildAikenMintTransaction(buildDto);
  }

  /**
   * Tahap 2: Menyimpan hasil minting setelah frontend berhasil mengirimkan transaksi.
   * @param inspectionId ID dari inspeksi yang di-update.
   * @param confirmDto Data konfirmasi dari frontend (txHash dan nftAssetId).
   * @returns Record inspeksi yang sudah terupdate.
   */
  async confirmArchive(
    inspectionId: string,
    confirmDto: ConfirmMintDto,
  ): Promise<Inspection> {
    this.logger.log(
      `Konfirmasi minting untuk inspeksi ${inspectionId} dengan TxHash: ${confirmDto.txHash}`,
    );

    // Pastikan inspeksi ada
    const inspection = await this.prisma.inspection.findUnique({
      where: { id: inspectionId },
    });
    if (!inspection)
      throw new NotFoundException(
        `Inspeksi ${inspectionId} tidak ditemukan untuk konfirmasi.`,
      );

    // Update database dengan hasil dari blockchain
    return this.prisma.inspection.update({
      where: { id: inspectionId },
      data: {
        status: InspectionStatus.ARCHIVED,
        nftAssetId: confirmDto.nftAssetId,
        blockchainTxHash: confirmDto.txHash,
        archivedAt: new Date(),
      },
    });
  }

  /**
   * Retrieves the 5 most recent inspections with status ARCHIVED,
   * including one photo with the label "Tampak Depan", vehiclePlateNumber,
   * vehicleData.merekKendaraan, and vehicleData.tipeKendaraan.
   *
   * @returns {Promise<Array<Inspection & { photos: Photo[] }>>} An array of inspection records
   *          with the required photo and vehicle data.
   */
  async findLatestArchivedInspections(): Promise<
    Array<Inspection & { photos: Photo[] }>
  > {
    this.logger.log(
      'Retrieving 5 latest ARCHIVED inspections with "Tampak Depan" photo.',
    );

    try {
      const inspections = await this.prisma.inspection.findMany({
        where: {
          status: InspectionStatus.ARCHIVED,
          photos: {
            some: {
              label: 'Tampak Depan',
            },
          },
        },
        orderBy: {
          archivedAt: 'desc', // Order by archived date to get the latest
        },
        take: 5, // Limit to 5 inspections
        include: {
          photos: {
            where: {
              label: 'Tampak Depan', // Only include the "Tampak Depan" photo
            },
            take: 1, // Ensure only one photo is returned if multiple "Tampak Depan" exist (shouldn't happen if data is clean)
          },
        },
      });

      // Filter out any inspections that somehow ended up without a 'Tampak Depan' photo
      // (though the 'where' clause above should prevent this)
      const filteredInspections = inspections.filter(
        (inspection) => inspection.photos.length > 0,
      );

      this.logger.log(
        `Found ${filteredInspections.length} latest ARCHIVED inspections.`,
      );
      return filteredInspections;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'An unknown error occurred';
      const errorStack =
        error instanceof Error ? error.stack : 'No stack trace available';
      this.logger.error(
        `Failed to retrieve latest archived inspections: ${errorMessage}`,
        errorStack,
      );
      throw new InternalServerErrorException(
        'Could not retrieve latest archived inspection data.',
      );
    }
  }

  /**
   * Permanently deletes an inspection, its related photos, change logs, and all associated files from disk.
   * This is a destructive operation intended only for SUPERADMIN use.
   *
   * @param {string} id - The UUID of the inspection to delete.
   * @returns {Promise<void>}
   * @throws {NotFoundException} If the inspection with the given ID is not found.
   * @throws {InternalServerErrorException} If any part of the deletion process fails.
   */
  async deleteInspectionPermanently(id: string): Promise<void> {
    this.logger.warn(
      `[SUPERADMIN] Initiating permanent deletion for inspection ID: ${id}`,
    );

    // 1. Fetch the inspection and its related photos to get file paths
    const inspection = await this.prisma.inspection.findUnique({
      where: { id },
      include: { photos: true },
    });

    if (!inspection) {
      this.logger.error(
        `Inspection with ID "${id}" not found for permanent deletion.`,
      );
      throw new NotFoundException(`Inspection with ID "${id}" not found.`);
    }

    // 2. Correctly construct file paths based on user's clarification
    const filePathsToDelete: string[] = [];
    const UPLOAD_PATH = './uploads/inspection-photos';
    const PDF_ARCHIVE_PATH = './pdfarchived';

    inspection.photos.forEach((photo) => {
      if (photo.path) {
        // photo.url is just the filename, join it with the upload path
        filePathsToDelete.push(path.join(UPLOAD_PATH, photo.path));
      }
    });
    if (inspection.urlPdf) {
      // inspection.urlPdf is /pdfarchived/filename.pdf, get basename and join with archive path
      filePathsToDelete.push(
        path.join(PDF_ARCHIVE_PATH, path.basename(inspection.urlPdf)),
      );
    }
    if (inspection.urlPdfNoDocs) {
      // inspection.urlPdfNoDocs is /pdfarchived/filename-no-docs.pdf, get basename and join
      filePathsToDelete.push(
        path.join(PDF_ARCHIVE_PATH, path.basename(inspection.urlPdfNoDocs)),
      );
    }

    this.logger.log(
      `Found ${filePathsToDelete.length} files to delete for inspection ${id}.`,
    );
    this.logger.debug(`Files to delete: ${JSON.stringify(filePathsToDelete)}`);

    // 3. Delete files from the disk
    for (const filePath of filePathsToDelete) {
      try {
        await fs.unlink(filePath);
        this.logger.log(`Successfully deleted file: ${filePath}`);
      } catch (error: unknown) {
        const nodeErr = error as NodeJS.ErrnoException | undefined;
        if (nodeErr && nodeErr.code === 'ENOENT') {
          this.logger.warn(`File not found, skipping deletion: ${filePath}`);
        } else {
          const msg =
            error instanceof Error ? error.message : JSON.stringify(error);
          const stack =
            error instanceof Error && error.stack ? error.stack : undefined;
          this.logger.error(`Error deleting file ${filePath}: ${msg}`, stack);
          // Decide if you want to stop the whole process if one file fails to delete.
          // For now, we log the error and continue.
        }
      }
    }

    // 4. Delete database records within a transaction
    try {
      await this.prisma.$transaction(async (tx) => {
        this.logger.log(`Starting DB transaction to delete inspection ${id}`);

        await tx.inspectionChangeLog.deleteMany({
          where: { inspectionId: id },
        });
        this.logger.log(`Deleted change logs for inspection ${id}.`);

        await tx.photo.deleteMany({
          where: { inspectionId: id },
        });
        this.logger.log(`Deleted photo records for inspection ${id}.`);

        await tx.inspection.delete({
          where: { id },
        });
        this.logger.log(`Deleted inspection record ${id}.`);
      });

      this.logger.warn(
        `[SUPERADMIN] Successfully and permanently deleted inspection ID: ${id}`,
      );
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : JSON.stringify(error);
      const stack =
        error instanceof Error && error.stack ? error.stack : undefined;
      this.logger.error(
        `Database transaction failed for permanent deletion of inspection ${id}: ${msg}`,
        stack,
      );
      throw new InternalServerErrorException(
        `Failed to permanently delete inspection data for ID ${id}.`,
      );
    }
  }

  /**
   * Reverts an inspection status back to NEED_REVIEW, regardless of its current status.
   * This is typically used by SUPERADMIN users to rollback inspections that need to be re-reviewed.
   * The operation creates a change log entry documenting the status rollback.
   *
   * @param {string} inspectionId - The UUID of the inspection to rollback.
   * @param {string} superAdminId - The ID of the SUPERADMIN performing the rollback.
   * @returns {Promise<Inspection>} The updated inspection record with NEED_REVIEW status.
   * @throws {NotFoundException} If inspection not found.
   * @throws {BadRequestException} If inspection is already in NEED_REVIEW status.
   * @throws {InternalServerErrorException} For database errors.
   */
  async rollbackInspectionStatus(
    inspectionId: string,
    superAdminId: string,
  ): Promise<Inspection> {
    this.logger.log(
      `SUPERADMIN ${superAdminId} attempting to rollback inspection ${inspectionId} status to NEED_REVIEW`,
    );

    try {
      const updatedInspection = await this.prisma.$transaction(async (tx) => {
        // 1. Find the inspection and validate it exists
        const inspection = await tx.inspection.findUnique({
          where: { id: inspectionId },
        });

        if (!inspection) {
          throw new NotFoundException(
            `Inspection with ID "${inspectionId}" not found for status rollback.`,
          );
        }

        // 2. Check if inspection is already in NEED_REVIEW status
        if (inspection.status === InspectionStatus.NEED_REVIEW) {
          throw new BadRequestException(
            `Inspection ${inspectionId} is already in NEED_REVIEW status. No rollback needed.`,
          );
        }

        const originalStatus = inspection.status;

        // 3. Update inspection status to NEED_REVIEW
        const updatedInspection = await tx.inspection.update({
          where: { id: inspectionId },
          data: {
            status: InspectionStatus.NEED_REVIEW,
            updatedAt: new Date(),
          },
        });

        // 4. Create change log entry for the status rollback
        await tx.inspectionChangeLog.create({
          data: {
            inspectionId: inspectionId,
            changedByUserId: superAdminId,
            fieldName: 'status',
            oldValue: originalStatus,
            newValue: InspectionStatus.NEED_REVIEW,
            changedAt: new Date(),
          },
        });

        this.logger.log(
          `Successfully rolled back inspection ${inspectionId} status from ${originalStatus} to NEED_REVIEW by SUPERADMIN ${superAdminId}`,
        );

        return updatedInspection;
      });

      return updatedInspection;
    } catch (error: unknown) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      const msg =
        error instanceof Error ? error.message : JSON.stringify(error);
      const stack =
        error instanceof Error && error.stack ? error.stack : undefined;
      this.logger.error(
        `Database transaction failed for status rollback of inspection ${inspectionId}: ${msg}`,
        stack,
      );
      throw new InternalServerErrorException(
        `Failed to rollback inspection status for ID ${inspectionId}.`,
      );
    }
  }

  /**
   * Revert an inspection from ARCHIVED or FAIL_ARCHIVE back to APPROVED.
   * Only for SUPERADMIN. Creates a change log entry documenting the status change.
   */
  async revertInspectionToApproved(
    inspectionId: string,
    superAdminId: string,
  ): Promise<Inspection> {
    this.logger.log(
      `SUPERADMIN ${superAdminId} attempting to revert inspection ${inspectionId} to APPROVED`,
    );

    try {
      const updatedInspection = await this.prisma.$transaction(async (tx) => {
        const inspection = await tx.inspection.findUnique({
          where: { id: inspectionId },
        });

        if (!inspection) {
          throw new NotFoundException(
            `Inspection with ID "${inspectionId}" not found for revert to APPROVED.`,
          );
        }

        if (
          inspection.status !== InspectionStatus.ARCHIVED &&
          inspection.status !== InspectionStatus.FAIL_ARCHIVE
        ) {
          throw new BadRequestException(
            `Inspection ${inspectionId} cannot be reverted to APPROVED because its current status is '${inspection.status}'. Allowed: '${InspectionStatus.ARCHIVED}' or '${InspectionStatus.FAIL_ARCHIVE}'.`,
          );
        }

        const originalStatus = inspection.status;

        const updated = await tx.inspection.update({
          where: { id: inspectionId },
          data: {
            status: InspectionStatus.APPROVED,
            updatedAt: new Date(),
            // Clear archived fields if we are reverting from ARCHIVED
            archivedAt:
              originalStatus === InspectionStatus.ARCHIVED
                ? null
                : inspection.archivedAt,
            nftAssetId:
              originalStatus === InspectionStatus.ARCHIVED
                ? null
                : inspection.nftAssetId,
            blockchainTxHash:
              originalStatus === InspectionStatus.ARCHIVED
                ? null
                : inspection.blockchainTxHash,
          },
        });

        await tx.inspectionChangeLog.create({
          data: {
            inspectionId: inspectionId,
            changedByUserId: superAdminId,
            fieldName: 'status',
            oldValue: originalStatus,
            newValue: InspectionStatus.APPROVED,
            changedAt: new Date(),
          },
        });

        this.logger.log(
          `Inspection ${inspectionId} status reverted from ${originalStatus} to APPROVED by SUPERADMIN ${superAdminId}`,
        );

        return updated;
      });

      return updatedInspection;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      this.logger.error(
        `Failed to revert inspection ${inspectionId} to APPROVED: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        error instanceof Error ? error.stack : 'No stack trace',
      );
      throw new InternalServerErrorException(
        `Failed to revert inspection ${inspectionId} to APPROVED.`,
      );
    }
  }
}
