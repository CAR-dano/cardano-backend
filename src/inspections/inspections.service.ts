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
import { BuildMintTxDto } from '../blockchain/dto/build-mint-tx.dto';
import { ConfirmMintDto } from './dto/confirm-mint.dto';
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
import {
  BlockchainService,
  InspectionNftMetadata,
} from '../blockchain/blockchain.service';
import { IpfsService } from '../ipfs/ipfs.service';
import puppeteer, { Browser } from 'puppeteer'; // Import puppeteer and Browser type
import { ConfigService } from '@nestjs/config';
import * as Papa from 'papaparse';
// Define path for archived PDFs (ensure this exists or is created by deployment script/manually)
const PDF_ARCHIVE_PATH = './pdfarchived';
// Define public base URL for accessing archived PDFs (should come from config in real app)
const PDF_PUBLIC_BASE_URL = process.env.PDF_PUBLIC_BASE_URL || '/pdfarchived'; // Example: /pdfarchived if served by Nginx

interface NftMetadata {
  vehicleNumber: string | null;
  pdfUrl: string | null;
  pdfHash: string | null;
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
  private readonly logger = new Logger(InspectionsService.name);
  // Inject PrismaService dependency via constructor
  constructor(
    private prisma: PrismaService,
    private blockchainService: BlockchainService,
    private config: ConfigService,
    private readonly ipfsService: IpfsService,
  ) {
    // Ensure the PDF archive directory exists on startup
    this.ensureDirectoryExists(PDF_ARCHIVE_PATH);
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
  ): Promise<{ id: string }> {
    this.logger.log(
      `Creating inspection for plate: ${createInspectionDto.vehiclePlateNumber ?? 'N/A'}`,
    );

    const { identityDetails } = createInspectionDto;
    const inspectorUuid = identityDetails.namaInspektor; // This is now the UUID
    const branchCityUuid = identityDetails.cabangInspeksi; // This is now the UUID
    const customerName = identityDetails.namaCustomer;

    // 1. Fetch Inspector and Branch City records using UUIDs
    let inspectorName: string | null = null;
    let branchCityName: string | null = null;
    let branchCode = 'XXX'; // Default branch code

    try {
      const inspector = await this.prisma.user.findUnique({
        where: { id: inspectorUuid },
        select: { name: true },
      });
      if (!inspector) {
        throw new BadRequestException(
          `Inspector with ID "${inspectorUuid}" not found.`,
        );
      }
      inspectorName = inspector.name;
      this.logger.log(`Fetched inspector name: ${inspectorName}`);

      const branchCity = await this.prisma.inspectionBranchCity.findUnique({
        where: { id: branchCityUuid },
        select: { city: true, code: true },
      });
      if (!branchCity) {
        throw new BadRequestException(
          `Inspection Branch City with ID "${branchCityUuid}" not found.`,
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
          inspector: { connect: { id: inspectorUuid } }, // Connect using the UUID
          branchCity: { connect: { id: branchCityUuid } }, // Connect using the UUID

          vehiclePlateNumber: createInspectionDto.vehiclePlateNumber,
          inspectionDate: inspectionDateObj,
          overallRating: createInspectionDto.overallRating,

          // Update identityDetails to store names and customer name
          identityDetails: {
            namaInspektor: inspectorName, // Store the fetched name
            namaCustomer: customerName, // Store the customer name from DTO
            cabangInspeksi: branchCityName, // Store the fetched name
          },

          vehicleData: createInspectionDto.vehicleData,
          equipmentChecklist: createInspectionDto.equipmentChecklist,
          inspectionSummary: createInspectionDto.inspectionSummary,
          detailedAssessment: createInspectionDto.detailedAssessment,
          bodyPaintThickness: createInspectionDto.bodyPaintThickness,
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
      // Check if the key exists in the old object before recursing to avoid errors on new keys
      // This check is not strictly necessary for the logic but can prevent errors if oldObj is null/undefined
      // However, the isObject check above should handle the null/undefined case.
      // Let's proceed with recursion as intended, assuming oldObj is an object here.
      const currentPathWithKey = [...path, key];
      this.logJsonChangesRecursive(
        fieldName, // Keep passing the top-level fieldName
        oldObj[key], // Value from existing DB record (can be undefined if key doesn't exist)
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
        include: { photos: true }, // Include related photos
        // include: { inspector: true, reviewer: true } // Include related users if needed
      });

      this.logger.log(
        `Found inspection ID: ${inspection?.id} for plate number: ${vehiclePlateNumber}`,
      );
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
      `Retrieving inspections for user role: ${userRole ?? 'N/A'}, status: ${Array.isArray(status) ? status.join(',') : (status ?? 'ALL (default)')}, page: ${page}, pageSize: ${pageSize}`,
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
        `Retrieved ${inspections.length} inspections of ${total} total for role ${userRole ?? 'N/A'}.`,
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
        `Failed to retrieve inspections for role ${userRole ?? 'N/A'}: ${errorMessage}`,
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
   * Approves an inspection, applies the latest logged change for each field,
   * generates and stores the PDF, calculates its hash, and changes status to APPROVED.
   * Fetches the latest changes from InspectionChangeLog and updates the Inspection record.
   * Records the reviewer ID and optionally clears applied change logs.
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
    this.logger.log(
      `Reviewer ${reviewerId} attempting to approve inspection ${inspectionId}`,
    );
    this.logger.debug(
      `Received token for approval: ${token ? 'Exists' : 'Null'}`,
    ); // Log token presence

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
      'CLIENT_BASE_URL_PDF',
    )}/data/${inspection.id}`;
    let pdfBuffer: Buffer;
    let pdfCid: string;
    let pdfHashString: string | null = null;
    const pdfFileName = `${inspection.pretty_id}-${Date.now()}.pdf`; // Nama file unik
    const pdfFilePath = path.join(PDF_ARCHIVE_PATH, pdfFileName);
    const pdfPublicUrl = `${PDF_PUBLIC_BASE_URL}/${pdfFileName}`; // URL publik

    try {
      // Generate PDF from URL, passing the token
      pdfBuffer = await this.generatePdfFromUrl(frontendReportUrl, token);
      pdfCid = await this.ipfsService.add(pdfBuffer);
      // Save PDF to Disc
      await fs.writeFile(pdfFilePath, pdfBuffer);
      this.logger.log(`PDF report saved to: ${pdfFilePath}`);

      // Calculate PDF Hash
      const hash = crypto.createHash('sha256');
      hash.update(pdfBuffer);
      pdfHashString = hash.digest('hex');
      this.logger.log(`PDF hash calculated: ${pdfHashString}`);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'An unknown error occurred';
      const errorStack =
        error instanceof Error ? error.stack : 'No stack trace available';
      this.logger.error(
        `Failed to generate or save PDF for inspection ${inspectionId}: ${errorMessage}`,
        errorStack,
      );
      throw new InternalServerErrorException(
        `Could not generate PDF report from URL: ${errorMessage}`,
      );
    }

    try {
      return this.prisma.$transaction(async (tx) => {
        // 2. Fetch all change logs for this inspection
        const allChanges = await tx.inspectionChangeLog.findMany({
          where: { inspectionId: inspectionId },
          orderBy: { changedAt: 'desc' }, // Order by latest first for easier processing
        });

        // Group changes by field key and get the latest change for each field
        const latestChanges = new Map<string, InspectionChangeLog>();

        for (const log of allChanges) {
          // Create a unique key for each field path
          let key = log.fieldName;
          if (log.subFieldName) {
            key += `.${log.subFieldName}`;
            if (log.subsubfieldname) {
              key += `.${log.subsubfieldname}`;
            }
          }

          // Only store if we haven't seen this field key before (since we're processing latest first)
          if (!latestChanges.has(key)) {
            latestChanges.set(key, log);
          }
        }

        // 3. Apply the latest changes to the inspection data
        // Start with a partial update object
        const updateData: Prisma.InspectionUpdateInput = {
          status: InspectionStatus.APPROVED,
          // Correctly update the reviewer relationship
          reviewer: {
            connect: { id: reviewerId },
          },
          urlPdf: pdfPublicUrl,
          pdfFileHash: pdfHashString,
          ipfsPdf: `ipfs://${pdfCid}`,
        };

        // Define which top-level fields in Inspection are JSON and can be updated via change log
        const jsonUpdatableFields: (keyof Inspection)[] = [
          'identityDetails',
          'vehicleData',
          'equipmentChecklist',
          'inspectionSummary',
          'detailedAssessment',
          'bodyPaintThickness',
        ];

        // Process each latest change
        for (const [fieldKey, changeLog] of latestChanges) {
          const value = changeLog.newValue;
          const parts = fieldKey.split('.'); // Split key into parts
          const fieldName = parts[0] as keyof Inspection; // Assert fieldName type

          this.logger.debug(
            `Applying change: fieldKey=${fieldKey}, value=${JSON.stringify(value)}, fieldName=${fieldName}`,
          );

          if (parts.length === 1) {
            this.logger.debug(
              `Processing top-level field from changelog. fieldName: "${fieldName}", value: "${JSON.stringify(value)}"`,
            ); // KILOCODE DEBUG LOG
            // Handle top-level fields (fieldName only)
            // Only attempt to update if the field exists in the original inspection object
            // KILOCODE FIX: Use parts[0] for 'inspector' and 'branchCity' checks to avoid TS error
            if (
              parts[0] === 'inspector' &&
              value !== null &&
              typeof value === 'string'
            ) {
              this.logger.debug(
                `Condition for 'inspector' (from parts[0]) met. Applying change.`,
              );
              updateData.inspector = { connect: { id: value.toString() } };
              this.logger.debug(
                `Applied inspector change using connect: ${value}`,
              );
            } else if (
              parts[0] === 'branchCity' &&
              value !== null &&
              typeof value === 'string'
            ) {
              this.logger.debug(
                `Condition for 'branchCity' (from parts[0]) met. Applying change.`,
              );
              updateData.branchCity = { connect: { id: value.toString() } };
              this.logger.debug(
                `Applied branchCity change using connect: ${value}`,
              );
            }
            // KILOCODE FIX: Fallback to check actual properties on inspection object using fieldName (keyof Inspection)
            else if (
              Object.prototype.hasOwnProperty.call(inspection, fieldName)
            ) {
              // Handle specific top-level fields with proper type conversion
              if (
                fieldName === 'vehiclePlateNumber' &&
                typeof value === 'string'
              ) {
                updateData.vehiclePlateNumber = value;
              } else if (
                fieldName === 'inspectionDate' &&
                typeof value === 'string'
              ) {
                updateData.inspectionDate = new Date(value); // Convert ISO string back to Date
              } else if (
                fieldName === 'overallRating' &&
                typeof value === 'string'
              ) {
                updateData.overallRating = value;
              }
              // Add other top-level fields here as needed with appropriate type checks and assignments
              else {
                // Fallback for other top-level fields, might still need refinement
                // updateData[fieldName as keyof Prisma.InspectionUpdateInput] = value as any; // Removed generic assignment
              }
            } else {
              this.logger.warn(
                `Top-level field "${parts[0]}" from changelog (key: ${fieldKey}) did not match any specific update logic. Value: ${JSON.stringify(value)}. 'inspector' check: ${parts[0] === 'inspector'}. 'branchCity' check: ${parts[0] === 'branchCity'}. HasOwnProperty on inspection for fieldName: ${Object.prototype.hasOwnProperty.call(inspection, fieldName)}. Ignoring.`, // KILOCODE DEBUG LOG MODIFIED with parts[0]
              );
            }
          } else {
            // Handle nested fields (subFieldName or subsubfieldname)
            // Only apply nested changes if the fieldName is one of the designated JSON updatable fields
            if ((jsonUpdatableFields as string[]).includes(fieldName)) {
              // Ensure the top-level JSON field exists in updateData, initializing if necessary
              if (
                !updateData[fieldName as keyof Prisma.InspectionUpdateInput] ||
                typeof updateData[
                  fieldName as keyof Prisma.InspectionUpdateInput
                ] !== 'object' ||
                updateData[fieldName as keyof Prisma.InspectionUpdateInput] ===
                  null
              ) {
                // Initialize with the existing value from the inspection, or an empty object if existing is null/undefined
                (updateData[
                  fieldName as keyof Prisma.InspectionUpdateInput
                ] as Record<string, Prisma.JsonValue>) =
                  inspection[fieldName] &&
                  typeof inspection[fieldName] === 'object' &&
                  inspection[fieldName] !== null
                    ? {
                        ...(inspection[fieldName] as Record<
                          string,
                          Prisma.JsonValue
                        >),
                      }
                    : {};
              }

              if (parts.length === 2) {
                // Handle subFieldName (one level deep)
                const subFieldName = parts[1];
                // Use type assertion to allow indexed access and assignment
                (
                  updateData[
                    fieldName as keyof Prisma.InspectionUpdateInput
                  ] as Record<string, Prisma.JsonValue>
                )[subFieldName] = value;
              } else if (parts.length === 3) {
                // Handle subsubfieldname (two levels deep)
                const subFieldName = parts[1];
                const subsubfieldname = parts[2];

                // Ensure the sub-field object exists, initializing if necessary
                const currentField = updateData[
                  fieldName as keyof Prisma.InspectionUpdateInput
                ] as Record<string, Prisma.JsonValue>;

                if (
                  !currentField[subFieldName] ||
                  typeof currentField[subFieldName] !== 'object' ||
                  currentField[subFieldName] === null
                ) {
                  // Initialize with the existing value from the inspection, or an empty object
                  const existingParentField = inspection[fieldName];
                  currentField[subFieldName] =
                    existingParentField &&
                    typeof existingParentField === 'object' &&
                    existingParentField !== null &&
                    (existingParentField as Record<string, Prisma.JsonValue>)[
                      subFieldName
                    ] &&
                    typeof (
                      existingParentField as Record<string, Prisma.JsonValue>
                    )[subFieldName] === 'object' &&
                    (existingParentField as Record<string, Prisma.JsonValue>)[
                      subFieldName
                    ] !== null
                      ? {
                          ...((
                            existingParentField as Record<
                              string,
                              Prisma.JsonValue
                            >
                          )[subFieldName] as Record<string, Prisma.JsonValue>),
                        }
                      : {};
                }

                // Use type assertion to allow indexed access and assignment
                (
                  currentField[subFieldName] as Record<string, Prisma.JsonValue>
                )[subsubfieldname] = value;
              }
              // Ignore parts.length > 3 for now, as logging is limited to 3 levels
            } else {
              this.logger.warn(
                `Attempted to apply nested change log for non-JSON field: ${fieldKey}. Ignoring.`,
              );
              // Optionally, log a warning or handle this case differently
            }
          }
        }

        // 4. Update the Inspection record in the database
        const updatedInspection = await tx.inspection.update({
          where: { id: inspectionId },
          data: updateData, // Use the prepared updateData object
        });

        this.logger.log(
          `Inspection ${inspectionId} approved and updated with latest logged changes by reviewer ${reviewerId}`,
        );
        return updatedInspection;
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'An unknown error occurred';
      const errorStack =
        error instanceof Error ? error.stack : 'No stack trace available';
      this.logger.error(
        `Failed to generate or save PDF for inspection ${inspectionId}: ${errorMessage}`,
        errorStack,
      );
      throw new InternalServerErrorException(
        `Could not generate PDF report from URL: ${errorMessage}`,
      );
    }
  }

  /**
   * Retrieves all inspection records, ordered by creation date descending.
   * Filters results based on the requesting user's role and optionally by status.
   * Admins/Reviewers see all by default. Customers/Developers/Inspectors only see ARCHIVED by default (if no status is specified).
   * If `status` is 'DATABASE', returns all inspections except those with status NEED_REVIEW, overriding role-based filtering.
   * Includes pagination and metadata.
   *
   * @param {Role} userRole - The role of the user making the request.
   * @param {InspectionStatus | 'DATABASE'} [status] - Optional filter by inspection status. Use 'DATABASE' to retrieve all statuses except NEED_REVIEW, regardless of user role.
   * @param {number} page - The page number (1-based).
   * @param {number} pageSize - The number of items per page.
   * @returns {Promise<{ data: Inspection[], meta: { total: number, page: number, pageSize: number, totalPages: number } }>} An object containing an array of inspection records and pagination metadata.
   */
  async findAll(
    userRole: Role,
    status?: InspectionStatus | 'DATABASE',
    page: number = 1,
    pageSize: number = 10,
  ): Promise<{
    data: Inspection[];
    meta: { total: number; page: number; pageSize: number; totalPages: number };
  }> {
    this.logger.log(
      `Retrieving inspections for user role: ${userRole}, status: ${status ?? 'ALL (default)'}, page: ${page}, pageSize: ${pageSize}`,
    );

    // Initialize whereClause
    const whereClause: Prisma.InspectionWhereInput = {};

    // 1. Handle explicit status or 'DATABASE'
    if (status) {
      if (status === 'DATABASE') {
        whereClause.status = { not: InspectionStatus.NEED_REVIEW };
        this.logger.log(
          `Applying filter: status = DATABASE (excluding NEED_REVIEW)`,
        );
      } else {
        // This is an explicit status filter from the user
        whereClause.status = status;
        this.logger.log(`Applying filter: status = ${status}`);
      }
    } else {
      // 2. Handle default status based on role ONLY IF no explicit status is provided
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
        `Retrieved ${inspections.length} inspections of ${total} total for role ${userRole}.`,
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
        `Failed to retrieve inspections for role ${userRole}: ${errorMessage}`,
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
    } catch (error: unknown) {
      // Use unknown
      const errorMessage =
        error instanceof Error ? error.message : 'An unknown error occurred';
      const errorStack =
        error instanceof Error ? error.stack : 'No stack trace available';
      this.logger.error(
        `Failed to generate or save PDF for inspection ${inspectionId}: ${errorMessage}`,
        errorStack,
      );
      throw new InternalServerErrorException(
        `Could not generate PDF report from URL: ${errorMessage}`,
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
      const latestValues: Record<
        string,
        Prisma.JsonValue | string | number | boolean | null
      > = {};
      for (const key in groupedChanges) {
        if (Object.prototype.hasOwnProperty.call(groupedChanges, key)) {
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
      // Start with a partial update object
      const updateData: Prisma.InspectionUpdateInput = {
        status: InspectionStatus.APPROVED,
        // Correctly update the reviewer relationship
        reviewer: {
          connect: { id: reviewerId },
        },
        urlPdf: pdfPublicUrl,
        pdfFileHash: pdfHashString,
      };

      // Define which top-level fields in Inspection are JSON and can be updated via change log
      const jsonUpdatableFields: (keyof Inspection)[] = [
        'identityDetails',
        'vehicleData',
        'equipmentChecklist',
        'inspectionSummary',
        'detailedAssessment',
        'bodyPaintThickness',
      ];

      for (const key in latestValues) {
        // Use Object.prototype.hasOwnProperty.call for safer property check
        if (Object.prototype.hasOwnProperty.call(latestValues, key)) {
          const value = latestValues[key];
          const parts = key.split('.'); // Split key into parts
          const fieldName = parts[0] as keyof Inspection; // Assert fieldName type

          if (parts.length === 1) {
            // Handle top-level fields (fieldName only) - Apply regardless of JSON updatable list
            this.logger.debug(
              `Applying top-level change: key=${key}, value=${JSON.stringify(value)}, fieldName=${fieldName}`,
            );
            // Only attempt to update if the field exists in the original inspection object
            // Use Object.prototype.hasOwnProperty.call for safer property check
            if (Object.prototype.hasOwnProperty.call(inspection, fieldName)) {
              // Assign value directly to the updateData object with specific type handling
              if (
                fieldName === 'vehiclePlateNumber' &&
                typeof value === 'string'
              ) {
                updateData.vehiclePlateNumber = value;
              } else if (
                fieldName === 'inspectionDate' &&
                typeof value === 'string'
              ) {
                updateData.inspectionDate = new Date(value); // Convert ISO string back to Date
              } else if (
                fieldName === 'overallRating' &&
                typeof value === 'string'
              ) {
                updateData.overallRating = value;
              }
              // Add other top-level fields here as needed with appropriate type checks and assignments
              else {
                // Fallback for other top-level fields, might still need refinement
                updateData[fieldName as keyof Prisma.InspectionUpdateInput] =
                  value as any;
              }
            } else {
              this.logger.warn(
                `Attempted to apply change log for non-existent or non-updatable top-level field: ${key}. Ignoring.`,
              );
            }
          } else {
            // Handle nested fields (subFieldName or subsubfieldname)
            // Only apply nested changes if the fieldName is one of the designated JSON updatable fields
            if ((jsonUpdatableFields as string[]).includes(fieldName)) {
              // Ensure the top-level JSON field exists in updateData, initializing if necessary
              if (
                !updateData[fieldName as keyof Prisma.InspectionUpdateInput] ||
                typeof updateData[
                  fieldName as keyof Prisma.InspectionUpdateInput
                ] !== 'object' ||
                updateData[fieldName as keyof Prisma.InspectionUpdateInput] ===
                  null
              ) {
                // Initialize with the existing value from the inspection, or an empty object if existing is null/undefined
                (updateData[
                  fieldName as keyof Prisma.InspectionUpdateInput
                ] as Record<string, Prisma.JsonValue>) =
                  inspection[fieldName] &&
                  typeof inspection[fieldName] === 'object' &&
                  inspection[fieldName] !== null
                    ? {
                        ...(inspection[fieldName] as Record<
                          string,
                          Prisma.JsonValue
                        >),
                      }
                    : {};
              }

              if (parts.length === 2) {
                // Handle subFieldName (one level deep)
                const subFieldName = parts[1];
                // Use type assertion to allow indexed access and assignment
                (
                  updateData[
                    fieldName as keyof Prisma.InspectionUpdateInput
                  ] as Record<string, Prisma.JsonValue>
                )[subFieldName] = value;
              } else if (parts.length === 3) {
                // Handle subsubfieldname (two levels deep)
                const subFieldName = parts[1];
                const subsubfieldname = parts[2];

                // Ensure the sub-field object exists, initializing if necessary
                if (
                  !(
                    updateData[
                      fieldName as keyof Prisma.InspectionUpdateInput
                    ] as Record<string, Prisma.JsonValue>
                  )[subFieldName] ||
                  typeof (
                    updateData[
                      fieldName as keyof Prisma.InspectionUpdateInput
                    ] as Record<string, Prisma.JsonValue>
                  )[subFieldName] !== 'object' ||
                  (
                    updateData[
                      fieldName as keyof Prisma.InspectionUpdateInput
                    ] as Record<string, Prisma.JsonValue>
                  )[subFieldName] === null
                ) {
                  // Initialize with the existing value from the inspection, or an empty object
                  (
                    updateData[
                      fieldName as keyof Prisma.InspectionUpdateInput
                    ] as Record<string, Prisma.JsonValue>
                  )[subFieldName] =
                    inspection[fieldName] &&
                    typeof inspection[fieldName] === 'object' &&
                    inspection[fieldName] !== null &&
                    (inspection[fieldName] as Record<string, Prisma.JsonValue>)[
                      subFieldName
                    ] &&
                    typeof (
                      inspection[fieldName] as Record<string, Prisma.JsonValue>
                    )[subFieldName] === 'object' &&
                    (inspection[fieldName] as Record<string, Prisma.JsonValue>)[
                      subFieldName
                    ] !== null
                      ? {
                          ...((
                            inspection[fieldName] as Record<
                              string,
                              Prisma.JsonValue
                            >
                          )[subFieldName] as Record<string, Prisma.JsonValue>),
                        }
                      : {};
                }

                // Use type assertion to allow indexed access and assignment
                (
                  (
                    updateData[
                      fieldName as keyof Prisma.InspectionUpdateInput
                    ] as Record<string, Prisma.JsonValue>
                  )[subFieldName] as Record<string, Prisma.JsonValue>
                )[subsubfieldname] = value;
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
        data: updateData, // Use the prepared updateData object
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
   * @param token Optional JWT token to include in headers.
   * @returns A Buffer containing the generated PDF data.
   */
  private async generatePdfFromUrl(
    url: string,
    token: string | null, // Accept the token
  ): Promise<Buffer> {
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

      if (token) {
        const headers: Record<string, string> = {
          Authorization: `Bearer ${token}`,
        };
        await page.setExtraHTTPHeaders(headers);
        this.logger.debug(
          'Added Authorization header to Puppeteer navigation.',
        );
      }

      await page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: 360000,
        // headers are set using page.setExtraHTTPHeaders() before goto
      });

      // Opsional: Tunggu selector spesifik jika networkidle0 tidak cukup
      // await page.waitForSelector('#report-ready-indicator', { timeout: 30000 });

      const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
      this.logger.log(`PDF buffer generated successfully from ${url}`);
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
    if (!inspection.ipfsPdf && !inspection.urlPdf) {
      this.logger.error(
        `Missing PDF URL (ipfsPdf or urlPdf) for inspection ${inspectionId}. Cannot mint NFT.`,
      );
      throw new BadRequestException(
        `Missing PDF URL for inspection ${inspectionId}. Cannot mint NFT.`,
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

    try {
      // 2. Minting
      let blockchainResult: { txHash: string; assetId: string } | null = null;
      let blockchainSuccess: boolean = false;

      try {
        // Now that we've checked for null, we can safely assert these are strings for the metadata type
        const metadataForNft: NftMetadata = {
          vehicleNumber: inspection.vehiclePlateNumber,
          pdfUrl: inspection.ipfsPdf ? inspection.ipfsPdf : inspection.urlPdf,
          pdfHash: inspection.pdfFileHash,
        };
        // Hapus field null/undefined dari metadata jika perlu (This step might be redundant now with checks above, but kept for safety)
        Object.keys(metadataForNft).forEach((key) =>
          metadataForNft[key] === undefined || metadataForNft[key] === null
            ? delete metadataForNft[key]
            : {},
        );

        this.logger.log(
          `Calling blockchainService.mintInspectionNft for inspection ${inspectionId}`,
        );
        // Cast to InspectionNftMetadata as we've ensured non-nullability
        blockchainResult = await this.blockchainService.mintInspectionNft(
          metadataForNft as InspectionNftMetadata,
        ); // Panggil service minting
        blockchainSuccess = true;
        this.logger.log(
          `Blockchain interaction SUCCESS for inspection ${inspectionId}`,
        );
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
          data: { status: InspectionStatus.FAIL_ARCHIVE },
        });
        this.logger.log(
          `Inspection ${inspectionId} status reverted to FAIL_ARCHIVE due to error.`,
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
   * Flattens a nested JavaScript object into a single level.
   * Handles arrays of simple types and specific array of objects (estimasiPerbaikan).
   * @param obj The object to flatten.
   * @param parentKey The parent key for prefixing.
   * @param result The accumulating result object.
   * @returns The flattened object.
   */
  private flattenObject(
    obj: any, // Keeping 'any' for simplicity in this helper, but ideally would use a more specific type or handle recursively with known types
    parentKey = '',
    result: Record<string, any> = {}, // Keeping 'any' for simplicity
  ): Record<string, any> {
    if (obj === null || (typeof obj !== 'object' && !Array.isArray(obj))) {
      result[parentKey || 'value'] = obj; // Name 'value' if parentKey is empty at root level primitive
      return result;
    }

    // Use Object.keys for safer iteration than 'for...in'
    Object.keys(obj).forEach((key) => {
      const newKey = parentKey ? `${parentKey}_${key}` : key;
      const value = obj[key];

      if (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
      ) {
        this.flattenObject(value, newKey, result);
      } else if (Array.isArray(value)) {
        if (
          newKey.endsWith('estimasiPerbaikan') &&
          value.length > 0 &&
          typeof value[0] === 'object' &&
          value[0] !== null // Ensure the object is not null
        ) {
          // Safely access properties with optional chaining or checks
          result[newKey] = value
            .map(
              (item) =>
                `${(item as any)?.namaPart || 'N/A'}:${(item as any)?.harga || 'N/A'}`,
            ) // Use any for item for simplicity, or define a type
            .join(' | ');
        } else if (
          value.every(
            (item) =>
              typeof item === 'string' ||
              typeof item === 'number' ||
              typeof item === 'boolean' ||
              item === null, // Allow null in arrays
          )
        ) {
          result[newKey] = value.join('|');
        } else {
          // For other arrays of objects or mixed arrays, stringify as fallback
          result[newKey] = JSON.stringify(value);
        }
      } else {
        result[newKey] = value;
      }
    });

    return result;
  }

  /**
   * Retrieves all inspection data and formats it as a CSV string, excluding photo data.
   * @returns {Promise<{ filename: string; csvData: string }>} An object containing the filename and CSV data.
   */
  async exportInspectionsToCsv(): Promise<{
    filename: string;
    csvData: string;
  }> {
    this.logger.log('Exporting all inspection data to CSV');

    try {
      const inspectionsFromDb = await this.prisma.inspection.findMany({
        // Do not need 'include: { photos: false }' if 'photos' is a separate relation
        // and not automatically included. If 'photos' is a JSON column, we will handle it in mapping.
        // If 'photos' is a relation you want to ensure is NOT fetched:
        // select: { id: true, ..., photos: false } // or other Prisma way to exclude
        include: {
          // Include relations whose data you want to include
          inspector: {
            select: { name: true },
          },
          reviewer: {
            select: { name: true },
          },
          branchCity: {
            select: { city: true, code: true },
          },
          // Ensure 'photos' is not included here if it is a relation
        },
      });

      if (!inspectionsFromDb || inspectionsFromDb.length === 0) {
        this.logger.log('No inspection data available.');
        // Return empty string or message, or throw error based on preference
        return {
          filename: 'inspections_empty.csv',
          csvData: 'No inspection data available.',
        };
      }

      const processedData = inspectionsFromDb.map((inspection) => {
        const flatData: Record<string, any> = {};

        // 1. Add fields from relations (if any)
        flatData['inspectorName'] = inspection.inspector?.name || '';
        flatData['reviewerName'] = inspection.reviewer?.name || '';
        flatData['branchCityName'] = inspection.branchCity?.city || '';
        flatData['branchCode'] = inspection.branchCity?.code || '';

        // 2. Add top-level fields from the inspection object
        // (excluding those already taken from relations or are JSON objects)
        const topLevelFieldsToExclude = [
          'inspector',
          'reviewer',
          'branchCity' /* add JSON fields here */,
          'identityDetails',
          'vehicleData',
          'equipmentChecklist',
          'inspectionSummary',
          'detailedAssessment',
          'bodyPaintThickness',
          'photos',
          'notesFontSizes', // 'photos' is excluded
        ];

        for (const key in inspection) {
          if (
            Object.prototype.hasOwnProperty.call(inspection, key) &&
            !topLevelFieldsToExclude.includes(key)
          ) {
            if (inspection[key] instanceof Date) {
              flatData[key] = (inspection[key] as Date).toISOString();
            } else {
              flatData[key] = inspection[key];
            }
          }
        }

        // 3. Flatten JSON fields
        // Ensure these field names match your Prisma model
        const jsonFieldsToFlatten = {
          identityDetails: inspection.identityDetails,
          vehicleData: inspection.vehicleData,
          equipmentChecklist: inspection.equipmentChecklist,
          inspectionSummary: inspection.inspectionSummary,
          detailedAssessment: inspection.detailedAssessment,
          bodyPaintThickness: inspection.bodyPaintThickness,
          notesFontSizes: inspection.notesFontSizes,
          // Do not include 'photos' here if it is a JSON column
        };

        for (const parentKey in jsonFieldsToFlatten) {
          if (
            Object.prototype.hasOwnProperty.call(jsonFieldsToFlatten, parentKey)
          ) {
            const jsonObject = jsonFieldsToFlatten[parentKey];
            if (jsonObject && typeof jsonObject === 'object') {
              // Ensure jsonObject is not null and is indeed an object before flattening
              // Prisma might return null for optional JSON fields
              this.flattenObject(jsonObject, parentKey, flatData);
            } else if (jsonObject !== undefined && jsonObject !== null) {
              // If the JSON field is a primitive value (rare, but for safety)
              flatData[parentKey] = jsonObject;
            }
          }
        }
        // Specifically for the photos field (if it's a JSON column and not a relation)
        // We want to exclude it. If already handled in the query, this is not needed.
        // delete flatData['photos']; // This line might not be needed if 'photos' is a relation.
        // If 'photos' is a JSON column in the `inspection` table, and findMany fetches it,
        // then we need to explicitly remove it from `flatData` if `flattenObject` processes it.
        // However, ideally, if 'photos' is a JSON column containing photo info, and you want to exclude it,
        // use `select` in Prisma to not fetch it from the start.

        return flatData;
      });

      // Get all possible headers from all processed data
      // to ensure CSV column consistency
      const allKeys = new Set<string>();
      processedData.forEach((item) => {
        Object.keys(item).forEach((key) => allKeys.add(key));
      });
      const sortedHeaders = Array.from(allKeys).sort(); // Sort headers for consistency

      const csvData = Papa.unparse(processedData, {
        columns: sortedHeaders, // Use sorted and collected headers
        header: true,
      });

      const filename = `inspections_export_${new Date().toISOString().split('T')[0]}.csv`;
      this.logger.log(`CSV data generated successfully. Filename: ${filename}`);
      return { filename, csvData };
    } catch (error: any) {
      this.logger.error(
        `Failed to export inspections to CSV: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Could not export inspection data to CSV.',
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
    if (
      !inspection.vehiclePlateNumber ||
      !inspection.ipfsPdf ||
      !inspection.pdfFileHash
    ) {
      throw new BadRequestException(
        `Data inspeksi ${inspectionId} tidak lengkap untuk minting.`,
      );
    }

    // 2. Siapkan data untuk dikirim ke blockchain service
    const buildDto: BuildMintTxDto = {
      adminAddress: adminAddress,
      inspectionData: {
        vehicleNumber: inspection.vehiclePlateNumber,
        pdfHash: inspection.pdfFileHash,
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
}
