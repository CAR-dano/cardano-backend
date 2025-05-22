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
import * as Papa from 'papaparse';

// Define path for archived PDFs (ensure this exists or is created by deployment script/manually)
const PDF_ARCHIVE_PATH = './pdfarchived';
// Define public base URL for accessing archived PDFs (should come from config in real app)
const PDF_PUBLIC_BASE_URL = process.env.PDF_PUBLIC_BASE_URL || '/pdfarchived'; // Example: /pdfarchived if served by Nginx

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
        e instanceof Error ? e.stack : 'No stack trace available';
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
            error instanceof Error ? error.stack : 'No stack trace available';
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

    // 2. Initialize array to store change log entries and update data for the inspection record
    const changesToLog: Prisma.InspectionChangeLogCreateManyInput[] = [];
    const updateData: Prisma.InspectionUpdateInput = {};

    // Handle changes to inspectorId and branchCityId and update identityDetails immediately
    let identityDetailsUpdated = false;
    const currentIdentityDetails =
      (existingInspection.identityDetails as Prisma.JsonObject) ?? {};
    const newIdentityDetails = { ...currentIdentityDetails }; // Start with existing details

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
      // Update identityDetails in the updateData
      newIdentityDetails.namaInspektor = newInspector.name;
      identityDetailsUpdated = true;
      // Also update the inspectorId directly in the inspection record
      updateData.inspector = {
        connect: { id: updateInspectionDto.inspectorId },
      };
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
      // Update identityDetails in the updateData
      newIdentityDetails.cabangInspeksi = newBranchCity.city;
      identityDetailsUpdated = true;
      // Also update the branchCityId directly in the inspection record
      updateData.branchCity = {
        connect: { id: updateInspectionDto.branchCityId },
      };
    }

    // If identityDetails was updated due to ID changes, add it to the updateData
    if (identityDetailsUpdated) {
      updateData.identityDetails = newIdentityDetails;
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
      // Skip inspectorId and branchCityId as they are handled above
      if (dtoKey === 'inspectorId' || dtoKey === 'branchCityId') continue;

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
        // Add the JSON field to the updateData
        updateData[dtoKey] = processedNewValue;
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
          // Add the non-JSON field to the updateData
          // Ensure newValue is not an object before assigning to non-JSON fields
          if (typeof newValue !== 'object' || newValue === null) {
            updateData[dtoKey] = newValue;
          } else {
            this.logger.warn(
              `Attempted to assign object to non-JSON field: ${dtoKey}. Ignoring.`,
            );
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
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : 'An unknown error occurred';
        const errorStack =
          error instanceof Error ? error.stack : 'No stack trace available';
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

    // 4. Update the Inspection record in the database with all collected changes
    if (Object.keys(updateData).length > 0) {
      try {
        const updatedInspection = await this.prisma.inspection.update({
          where: { id },
          data: updateData,
        });
        this.logger.log(`Inspection ${id} updated successfully.`);
        return updatedInspection;
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : 'An unknown error occurred';
        const errorStack =
          error instanceof Error ? error.stack : 'No stack trace available';
        this.logger.error(
          `Failed to update inspection ID ${id}: ${errorMessage}`,
          errorStack,
        );
        throw new InternalServerErrorException('Could not update inspection.');
      }
    } else {
      this.logger.log(`No data to update for inspection ID: ${id}.`);
      // Return the existing inspection if no updates were made
      return existingInspection;
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

    try {
      // 2. Minting
      let blockchainResult: { txHash: string; assetId: string } | null = null;
      let blockchainSuccess: boolean = false;

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
      } catch (blockchainError: unknown) {
        // Explicitly type error as any for now
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
    obj: any,
    parentKey = '',
    result: Record<string, any> = {},
  ): Record<string, any> {
    if (obj === null || (typeof obj !== 'object' && !Array.isArray(obj))) {
      result[parentKey || 'value'] = obj; // Name 'value' if parentKey is empty at root level primitive
      return result;
    }

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
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
            typeof value[0] === 'object'
          ) {
            result[newKey] = value
              .map((item) => `${item.namaPart || 'N/A'}:${item.harga || 'N/A'}`)
              .join(' | ');
          } else if (
            value.every(
              (item) =>
                typeof item === 'string' ||
                typeof item === 'number' ||
                typeof item === 'boolean',
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
      }
    }
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
}
