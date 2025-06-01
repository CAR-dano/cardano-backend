/*
 * --------------------------------------------------------------------------
 * File: inspections.service.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Service responsible for handling business logic related to inspections.
 * Interacts with PrismaService to manage inspection data in the database.
 * Manages inspection lifecycle, including creation, updates, status changes,
 * and blockchain interaction simulation.
 * Delegates specialized tasks like PDF generation, sequence ID generation,
 * and change log processing to dedicated services.
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
import { PrismaService } from '../prisma/prisma.service';
import { CreateInspectionDto } from './dto/create-inspection.dto';
import { UpdateInspectionDto } from './dto/update-inspection.dto';
import {
  Inspection,
  InspectionStatus,
  Prisma,
  Role,
  // InspectionChangeLog, // No longer directly used for Map type
} from '@prisma/client';
import { BlockchainService } from '../blockchain/blockchain.service';
import { ConfigService } from '@nestjs/config';
import { MintRequestDto } from '../blockchain/dto/mint-request.dto';

// Refactored Service Imports
import { PdfService } from '../pdf/pdf.service';
import { SequenceService } from '../sequences/sequence.service';
import { ChangeLogProcessorService } from '../inspection-change-log/change-log-processor.service';

/**
 * Service responsible for handling business logic related to inspections.
 */
@Injectable()
export class InspectionsService {
  private readonly logger = new Logger(InspectionsService.name);

  constructor(
    private prisma: PrismaService,
    private blockchainService: BlockchainService,
    private config: ConfigService,
    private pdfService: PdfService, // Injected
    private sequenceService: SequenceService, // Injected
    private changeLogProcessorService: ChangeLogProcessorService, // Injected
  ) {
    // ensureDirectoryExists was moved to PdfService and called in its constructor
  }

  /**
   * Creates a new inspection record with initial data (excluding photos).
   * Status defaults to NEED_REVIEW. Requires the ID of the submitting user (inspector).
   * Uses SequenceService to generate the custom inspection ID.
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
    const inspectorUuid = identityDetails.namaInspektor;
    const branchCityUuid = identityDetails.cabangInspeksi;
    const customerName = identityDetails.namaCustomer;

    let inspectorName: string | null = null;
    let branchCityName: string | null = null;
    let branchCode = 'XXX';

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
      branchCode = branchCity.code.toUpperCase();
      this.logger.log(
        `Fetched branch city name: ${branchCityName}, code: ${branchCode}`,
      );
    } catch (e: unknown) {
      if (e instanceof BadRequestException) throw e;
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred';
      const errorStack = e instanceof Error ? e.stack : 'No stack trace available';
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
      : new Date();
    if (isNaN(inspectionDateObj.getTime())) {
      throw new BadRequestException('Invalid inspectionDate format provided.');
    }

    return this.prisma.$transaction(
      async (tx) => {
        // Use SequenceService to generate ID
        const customId = await this.sequenceService.generateNextInspectionId(
          branchCode,
          inspectionDateObj,
          tx,
        );
        this.logger.log(`Generated custom inspection ID: ${customId}`);

        const dataToCreate: Prisma.InspectionCreateInput = {
          pretty_id: customId,
          inspector: { connect: { id: inspectorUuid } },
          branchCity: { connect: { id: branchCityUuid } },
          vehiclePlateNumber: createInspectionDto.vehiclePlateNumber,
          inspectionDate: inspectionDateObj,
          overallRating: createInspectionDto.overallRating,
          identityDetails: {
            namaInspektor: inspectorName,
            namaCustomer: customerName,
            cabangInspeksi: branchCityName,
          },
          vehicleData: createInspectionDto.vehicleData,
          equipmentChecklist: createInspectionDto.equipmentChecklist,
          inspectionSummary: createInspectionDto.inspectionSummary,
          detailedAssessment: createInspectionDto.detailedAssessment,
          bodyPaintThickness: createInspectionDto.bodyPaintThickness,
          notesFontSizes: createInspectionDto.notesFontSizes ?? {
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
          // status defaults to NEED_REVIEW as per Prisma schema
        };

        try {
          const newInspection = await tx.inspection.create({
            data: dataToCreate,
          });
          this.logger.log(
            `Successfully created inspection with ID: ${newInspection.id}`,
          );
          return { id: newInspection.id };
        } catch (error: unknown) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
          ) {
            this.logger.error(
              `Race condition or duplicate custom ID generated: ${customId}`,
               error.stack,
            );
            throw new ConflictException(
              `Failed to generate unique inspection ID for ${customId}. Please try again.`,
            );
          }
          const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
          const errorStack = error instanceof Error ? error.stack : 'No stack trace available';
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
      const inspection = await this.prisma.inspection.findUnique({
        where: { id: inspectionId },
        include: { photos: true },
      });
      this.logger.log(
        `Found inspection ID: ${inspection?.id} for plate number: ${vehiclePlateNumber}`,
      );
      return inspection;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      const errorStack = error instanceof Error ? error.stack : 'No stack trace available';
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
   * The Inspection record status is updated to HAS_PENDING_CHANGES.
   *
   * @param {string} id - The UUID of the inspection to log changes for.
   * @param {UpdateInspectionDto} updateInspectionDto - DTO containing the potential changes.
   * @param {string} userId - ID of the user performing the action.
   * @param {Role} userRole - Role of the user.
   * @returns {Promise<{ message: string }>} A message indicating logging status.
   */
  async update(
    id: string,
    updateInspectionDto: UpdateInspectionDto,
    userId: string,
    userRole: Role,
  ): Promise<{ message: string }> {
    this.logger.log(
      `User ${userId} (Role: ${userRole}) attempting to log/stage changes for inspection ID: ${id}`,
    );
    this.logger.debug('Update DTO received:', JSON.stringify(updateInspectionDto, null, 2));

    const existingInspection = await this.prisma.inspection.findUnique({
      where: { id },
    });

    if (!existingInspection) {
      throw new NotFoundException(`Inspection with ID "${id}" not found.`);
    }

    if (
      existingInspection.status === InspectionStatus.APPROVED ||
      existingInspection.status === InspectionStatus.ARCHIVED ||
      existingInspection.status === InspectionStatus.ARCHIVING
    ) {
      throw new BadRequestException(
        `Inspection with ID "${id}" has status ${existingInspection.status} and cannot be updated or have changes logged at this stage.`,
      );
    }

    const changesToLog: Prisma.InspectionChangeLogCreateManyInput[] = [];
    const currentIdentityDetails = (existingInspection.identityDetails as Prisma.JsonObject) ?? {};

    // Handle direct inspectorId change logging
    if (updateInspectionDto.inspectorId !== undefined && updateInspectionDto.inspectorId !== existingInspection.inspectorId) {
      const newInspector = await this.prisma.user.findUnique({ where: { id: updateInspectionDto.inspectorId }, select: { name: true } });
      if (!newInspector) throw new BadRequestException(`New inspector with ID "${updateInspectionDto.inspectorId}" not found.`);

      changesToLog.push({
        inspectionId: id, changedByUserId: userId, fieldName: 'identityDetails', subFieldName: 'namaInspektor',
        oldValue: currentIdentityDetails?.namaInspektor ?? Prisma.JsonNull, newValue: newInspector.name ?? Prisma.JsonNull,
      });
      changesToLog.push({
        inspectionId: id, changedByUserId: userId, fieldName: 'inspector', // represents inspectorId
        oldValue: existingInspection.inspectorId ?? Prisma.JsonNull, newValue: updateInspectionDto.inspectorId,
      });
       this.logger.log(`Logged changes for inspector to ID: ${updateInspectionDto.inspectorId} (Name: ${newInspector.name})`);
    }

    // Handle direct branchCityId change logging
    if (updateInspectionDto.branchCityId !== undefined && updateInspectionDto.branchCityId !== existingInspection.branchCityId) {
      const newBranchCity = await this.prisma.inspectionBranchCity.findUnique({ where: { id: updateInspectionDto.branchCityId }, select: { city: true } });
      if (!newBranchCity) throw new BadRequestException(`New branch city with ID "${updateInspectionDto.branchCityId}" not found.`);

      changesToLog.push({
        inspectionId: id, changedByUserId: userId, fieldName: 'identityDetails', subFieldName: 'cabangInspeksi',
        oldValue: currentIdentityDetails?.cabangInspeksi ?? Prisma.JsonNull, newValue: newBranchCity.city ?? Prisma.JsonNull,
      });
      changesToLog.push({
        inspectionId: id, changedByUserId: userId, fieldName: 'branchCity', // represents branchCityId
        oldValue: existingInspection.branchCityId ?? Prisma.JsonNull, newValue: updateInspectionDto.branchCityId,
      });
      this.logger.log(`Logged changes for branchCity to ID: ${updateInspectionDto.branchCityId} (Name: ${newBranchCity.city})`);
    }

    // Handle namaCustomer in identityDetails
    if (updateInspectionDto.identityDetails?.namaCustomer !== undefined && updateInspectionDto.identityDetails.namaCustomer !== currentIdentityDetails?.namaCustomer) {
        changesToLog.push({
            inspectionId: id, changedByUserId: userId, fieldName: 'identityDetails', subFieldName: 'namaCustomer',
            oldValue: currentIdentityDetails?.namaCustomer ?? Prisma.JsonNull, newValue: updateInspectionDto.identityDetails.namaCustomer ?? Prisma.JsonNull,
        });
        this.logger.log(`Logged change for identityDetails.namaCustomer to "${updateInspectionDto.identityDetails.namaCustomer}"`);
    }


    const jsonFieldsInInspectionModel: Array<keyof UpdateInspectionDto & keyof Inspection> = [
      'vehicleData', 'equipmentChecklist', 'inspectionSummary',
      'detailedAssessment', 'bodyPaintThickness', 'notesFontSizes',
    ];

    for (const key of Object.keys(updateInspectionDto)) {
      const dtoKey = key as keyof UpdateInspectionDto;
      const newValue = updateInspectionDto[dtoKey];
      const oldValue = (existingInspection as any)[dtoKey];

      if (newValue === undefined) continue;
      if (dtoKey === 'inspectorId' || dtoKey === 'branchCityId' || dtoKey === 'identityDetails') continue;

      const processedNewValue = newValue instanceof Date ? newValue.toISOString() : newValue;
      const processedOldValue = oldValue instanceof Date ? oldValue.toISOString() : oldValue;

      if ((jsonFieldsInInspectionModel as string[]).includes(dtoKey)) {
        this.logger.verbose(`Comparing JSON field: ${dtoKey}`);
        this.changeLogProcessorService.logJsonChangesRecursive(
          dtoKey,
          processedOldValue as Prisma.JsonValue,
          processedNewValue as Prisma.JsonValue,
          changesToLog,
          id,
          userId,
          [],
        );
      } else {
        const oldValToLog = processedOldValue === undefined || processedOldValue === null ? Prisma.JsonNull : processedOldValue;
        const newValToLog = processedNewValue === undefined || processedNewValue === null ? Prisma.JsonNull : processedNewValue;

        if (dtoKey === 'vehiclePlateNumber' && typeof newValue === 'string' && newValue.length > 15) {
          throw new BadRequestException(`Value for ${dtoKey} exceeds maximum length of 15 characters.`);
        }
        if (JSON.stringify(oldValToLog) !== JSON.stringify(newValToLog)) {
          this.logger.verbose(`Logging change for top-level non-JSON field: ${dtoKey}`);
          changesToLog.push({
            inspectionId: id, changedByUserId: userId, fieldName: dtoKey,
            oldValue: oldValToLog, newValue: newValToLog,
          });
        }
      }
    }

    if (changesToLog.length > 0) {
      try {
        await this.prisma.inspectionChangeLog.createMany({ data: changesToLog });
        this.logger.log(`Logged ${changesToLog.length} changes for inspection ID: ${id}`);

        await this.prisma.inspection.update({
          where: { id },
          data: {
            status: InspectionStatus.HAS_PENDING_CHANGES,
            updatedAt: new Date(),
           },
        });
        this.logger.log(`Inspection ${id} status updated to HAS_PENDING_CHANGES.`);
        return { message: `${changesToLog.length} changes logged. Inspection status set to HAS_PENDING_CHANGES.` };

      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        const errorStack = error instanceof Error ? error.stack : 'No stack trace available';
        this.logger.error(
          `Failed to log changes or update status for inspection ID ${id}: ${errorMessage}`,
          errorStack,
        );
        throw new InternalServerErrorException('Could not save inspection change logs or update status.');
      }
    } else {
      this.logger.log(`No significant changes detected to log for inspection ID: ${id}`);
      return { message: 'No significant changes detected to log.' };
    }
  }

  /**
   * Retrieves all inspection records, ordered by creation date descending.
   * Filters results based on the requesting user's role and optionally by status.
   *
   * @param {Role | undefined} userRole - The role of the user making the request.
   * @param {InspectionStatus[] | 'DATABASE' | undefined} [status] - Optional filter by inspection status.
   * @param {number} page - The page number (1-based).
   * @param {number} pageSize - The number of items per page.
   * @returns {Promise<{ data: Inspection[], meta: { total: number, page: number, pageSize: number, totalPages: number } }>} An object containing an array of inspection records and pagination metadata.
   */
  async findAll(
    userRole: Role | undefined,
    status?: InspectionStatus[] | 'DATABASE',
    page: number = 1,
    pageSize: number = 10,
  ): Promise<{
    data: Inspection[];
    meta: { total: number; page: number; pageSize: number; totalPages: number };
  }> {
    this.logger.log(
      `Retrieving inspections for user role: ${userRole ?? 'N/A'}, status: ${Array.isArray(status) ? status.join(',') : (status ?? 'ALL (default)')}, page: ${page}, pageSize: ${pageSize}`,
    );

    const whereClause: Prisma.InspectionWhereInput = {};

    if (status) {
      if (status === 'DATABASE') {
        whereClause.status = { not: InspectionStatus.NEED_REVIEW };
      } else if (Array.isArray(status)) {
        whereClause.status = { in: status };
      } else {
        whereClause.status = status;
      }
    } else {
      if (userRole === Role.CUSTOMER || userRole === Role.DEVELOPER || userRole === Role.INSPECTOR) {
        whereClause.status = InspectionStatus.ARCHIVED;
      }
    }

    const skip = (page - 1) * pageSize;
    if (skip < 0) throw new BadRequestException('Page number must be positive.');

    try {
      const total = await this.prisma.inspection.count({ where: whereClause });
      const inspections = await this.prisma.inspection.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip: skip,
        take: pageSize,
        include: { photos: true },
      });
      this.logger.log(`Retrieved ${inspections.length} inspections of ${total} total for role ${userRole ?? 'N/A'}.`);
      const totalPages = Math.ceil(total / pageSize);
      return { data: inspections, meta: { total, page, pageSize, totalPages } };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      const errorStack = error instanceof Error ? error.stack : 'No stack trace available';
      this.logger.error(`Failed to retrieve inspections: ${errorMessage}`, errorStack);
      throw new InternalServerErrorException('Could not retrieve inspection data.');
    }
  }

  /**
   * Retrieves a single inspection by ID.
   * Applies status-based filtering for non-admin/reviewer roles.
   *
   * @param {string} id - The UUID of the inspection.
   * @param {Role} userRole - The role of the requesting user.
   * @returns {Promise<Inspection>} The found inspection record.
   */
  async findOne(id: string, userRole: Role): Promise<Inspection> {
    this.logger.log(`Retrieving inspection ID: ${id} for user role: ${userRole}`);
    try {
      const inspection = await this.prisma.inspection.findUniqueOrThrow({
        where: { id: id },
        include: { photos: true },
      });

      if (userRole === Role.ADMIN || userRole === Role.REVIEWER) {
        return inspection;
      } else if (inspection.status === InspectionStatus.ARCHIVED) {
        return inspection;
      } else {
        throw new ForbiddenException(
          `You do not have permission to view this inspection in its current status (${inspection.status}).`,
        );
      }
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException(`Inspection with ID "${id}" not found.`);
      }
      if (error instanceof ForbiddenException) throw error;
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      const errorStack = error instanceof Error ? error.stack : 'No stack trace available';
      this.logger.error(`Failed to retrieve inspection ID ${id}: ${errorMessage}`, errorStack);
      throw new InternalServerErrorException(`Could not retrieve inspection ${id}.`);
    }
  }

  /**
   * Approves an inspection, applies the latest logged changes,
   * generates and stores the PDF using PdfService, calculates its hash,
   * and changes status to APPROVED.
   *
   * @param {string} inspectionId - The UUID of the inspection to approve.
   * @param {string} reviewerId - The UUID of the user (REVIEWER/ADMIN) approving.
   * @returns {Promise<Inspection>} The updated inspection record.
   */
  async approveInspection(
    inspectionId: string,
    reviewerId: string,
  ): Promise<Inspection> {
    this.logger.log(`Reviewer ${reviewerId} attempting to approve inspection ${inspectionId}`);

    const inspection = await this.prisma.inspection.findUnique({
      where: { id: inspectionId },
    });

    if (!inspection) {
      throw new NotFoundException(`Inspection with ID "${inspectionId}" not found for approval.`);
    }
    if (inspection.status !== InspectionStatus.NEED_REVIEW && inspection.status !== InspectionStatus.FAIL_ARCHIVE && inspection.status !== InspectionStatus.HAS_PENDING_CHANGES) {
      throw new BadRequestException(
        `Inspection ${inspectionId} cannot be approved. Current status is '${inspection.status}'. Required: '${InspectionStatus.NEED_REVIEW}', '${InspectionStatus.FAIL_ARCHIVE}', or '${InspectionStatus.HAS_PENDING_CHANGES}'.`,
      );
    }

    const frontendReportUrl = `${this.config.getOrThrow<string>('CLIENT_BASE_URL')}/data/${inspection.pretty_id}`;
    let pdfBuffer: Buffer;
    let pdfDetails: { filePath: string; publicUrl: string; uniqueFileName: string };
    let pdfHash: string;

    try {
      this.logger.log(`Generating PDF for inspection ${inspectionId} from URL: ${frontendReportUrl}`);
      pdfBuffer = await this.pdfService.generatePdfFromUrl(frontendReportUrl);

      this.logger.log(`Saving PDF for inspection ${inspectionId}`);
      pdfDetails = await this.pdfService.savePdf(pdfBuffer, inspection.pretty_id);

      this.logger.log(`Calculating hash for PDF of inspection ${inspectionId}`);
      pdfHash = this.pdfService.calculatePdfHash(pdfBuffer);

      this.logger.log(`PDF generated, saved to ${pdfDetails.filePath}, and hash calculated for inspection ${inspectionId}. Public URL: ${pdfDetails.publicUrl}`);

    } catch (error: any) {
      this.logger.error(`PDF processing failed for inspection ${inspectionId}: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`PDF processing failed: ${error.message}`);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        this.logger.debug(`Fetching latest changes map for approval for inspection: ${inspectionId} within transaction.`);
        const latestChangesMap = await this.changeLogProcessorService.getLatestChangesMapForApproval(inspectionId, tx);

        const initialUpdateData: Prisma.InspectionUpdateInput = {
          status: InspectionStatus.APPROVED,
          reviewer: { connect: { id: reviewerId } },
          urlPdf: pdfDetails.publicUrl,
          pdfFileHash: pdfHash,
          approvedAt: new Date(),
          updatedAt: new Date(), // Explicitly update timestamp
        };

        this.logger.debug(`Building final update data for inspection ${inspectionId} using ChangeLogProcessorService.`);
        const finalUpdateData = this.changeLogProcessorService.buildUpdateDataFromChanges(
          inspection, // Pass the full current inspection object from DB
          latestChangesMap,
          initialUpdateData,
        );

        this.logger.debug(`Updating inspection ${inspectionId} in database with final data.`);
        const updatedInspection = await tx.inspection.update({
          where: { id: inspectionId },
          data: finalUpdateData,
        });

        this.logger.log(`Inspection ${inspectionId} approved and updated by reviewer ${reviewerId}.`);
        return updatedInspection;
      });
    } catch (error: any) {
      this.logger.error(`Failed to approve inspection ${inspectionId} in transaction: ${error.message}`, error.stack);
      // Consider specific error handling for Prisma transaction errors if needed
      throw new InternalServerErrorException(`Could not approve inspection: ${error.message}`);
    }
  }


  /**
   * Processes an approved inspection for archiving.
   * This method primarily deals with blockchain minting using existing PDF data.
   *
   * @param {string} inspectionId - The UUID of the inspection to archive.
   * @param {string} userId - The ID of the user initiating the archive (ADMIN/REVIEWER).
   * @returns {Promise<Inspection>} The final updated inspection record.
   */
  async processToArchive(
    inspectionId: string,
    userId: string,
  ): Promise<Inspection> {
    this.logger.log(`User ${userId} starting archive process for inspection ${inspectionId}`);

    const inspection = await this.prisma.inspection.findUnique({
      where: { id: inspectionId },
    });
    if (!inspection) throw new NotFoundException(`Inspection ${inspectionId} not found for archiving.`);
    if (inspection.status !== InspectionStatus.APPROVED) {
      throw new BadRequestException(
        `Inspection ${inspectionId} cannot be archived. Status is ${inspection.status}, requires ${InspectionStatus.APPROVED}.`,
      );
    }
    // pdfFileHash should exist from approveInspection step
    if (!inspection.pdfFileHash) {
        this.logger.error(`Inspection ${inspectionId} is missing pdfFileHash, cannot proceed with archiving.`);
        throw new InternalServerErrorException(`Inspection ${inspectionId} is missing critical PDF hash for archiving.`);
    }


    try {
      let blockchainResult: { txHash: string; assetId: string } | null = null;
      let blockchainSuccess = false;

      try {
        const metadataForNft: MintRequestDto['metadata'] = { // Ensure type matches
          name: `Inspection Report ${inspection.pretty_id}`, // Example name
          image: inspection.urlPdf || '', // Assuming urlPdf can be used as an image/link
          mediaType: "application/pdf", // Example mediaType
          description: `Inspection report for vehicle ${inspection.vehiclePlateNumber} conducted on ${inspection.inspectionDate.toISOString()}`,
          files: [{ // Example file structure
              name: "Inspection PDF",
              mediaType: "application/pdf",
              src: inspection.urlPdf || '',
          }],
          // Custom attributes
          vehiclePlateNumber: inspection.vehiclePlateNumber,
          inspectionDate: inspection.inspectionDate.toISOString(),
          pdfHash: inspection.pdfFileHash, // This is crucial
          ...(inspection.overallRating && { overallRating: inspection.overallRating }),
        };

        // Clean metadataForNft from undefined/null values
        Object.keys(metadataForNft).forEach(key => {
            const K = key as keyof typeof metadataForNft;
            if (metadataForNft[K] === undefined || metadataForNft[K] === null) {
                delete metadataForNft[K];
            }
        });


        this.logger.log(`Calling blockchainService.mintInspectionNft for inspection ${inspectionId}`);
        blockchainResult = await this.blockchainService.mintInspectionNft(metadataForNft);
        blockchainSuccess = true;
        this.logger.log(`Blockchain interaction SUCCESS for inspection ${inspectionId}: TxHash ${blockchainResult.txHash}, AssetID ${blockchainResult.assetId}`);
      } catch (blockchainError: any) {
        this.logger.error(
          `Blockchain interaction FAILED for inspection ${inspectionId}: ${blockchainError.message}`,
          blockchainError.stack,
        );
        // blockchainSuccess remains false
      }

      const finalStatus = blockchainSuccess ? InspectionStatus.ARCHIVED : InspectionStatus.FAIL_ARCHIVE;
      const updateData: Prisma.InspectionUpdateInput = {
        status: finalStatus,
        nftAssetId: blockchainResult?.assetId || null,
        blockchainTxHash: blockchainResult?.txHash || null,
        archivedAt: blockchainSuccess ? new Date() : null,
        updatedAt: new Date(), // Explicitly update timestamp
      };
      const finalInspection = await this.prisma.inspection.update({
        where: { id: inspectionId },
        data: updateData,
      });
      this.logger.log(`Inspection ${inspectionId} final status set to ${finalStatus}.`);
      return finalInspection;

    } catch (error: any) {
      this.logger.error(
        `Archiving process failed for inspection ${inspectionId}: ${error.message}`,
        error.stack,
      );
      // Attempt to revert status if stuck in ARCHIVING (best effort)
      if (inspection.status === InspectionStatus.ARCHIVING) { // Check if it was set to ARCHIVING
          try {
            await this.prisma.inspection.update({
              where: { id: inspectionId },
              data: { status: InspectionStatus.FAIL_ARCHIVE, updatedAt: new Date() },
            });
            this.logger.log(`Inspection ${inspectionId} status reverted to FAIL_ARCHIVE due to error during archiving.`);
          } catch (revertError: any) {
            this.logger.error(
              `Failed to revert status from ARCHIVING for inspection ${inspectionId}: ${revertError.message}`,
              revertError.stack,
            );
          }
      }
      if (error instanceof BadRequestException || error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(`Archiving process failed for inspection ${inspectionId}: ${error.message}`);
    }
  }

  /**
   * Deactivates an archived inspection record.
   * Changes status from ARCHIVED to DEACTIVATED.
   *
   * @param {string} inspectionId - The UUID of the inspection to deactivate.
   * @param {string} userId - The ID of the user performing the action (ADMIN).
   * @returns {Promise<Inspection>} The updated inspection record.
   */
  async deactivateArchive(
    inspectionId: string,
    userId: string,
  ): Promise<Inspection> {
    this.logger.log(`User ${userId} attempting to deactivate inspection ${inspectionId}`);
    try {
      const result = await this.prisma.inspection.updateMany({
        where: { id: inspectionId, status: InspectionStatus.ARCHIVED },
        data: { status: InspectionStatus.DEACTIVATED, deactivatedAt: new Date(), updatedAt: new Date() },
      });

      if (result.count === 0) {
        const currentInspection = await this.prisma.inspection.findUnique({ where: { id: inspectionId } });
        if (!currentInspection) throw new NotFoundException(`Inspection with ID "${inspectionId}" not found.`);
        throw new BadRequestException(
          `Inspection ${inspectionId} cannot be deactivated. Current status: '${currentInspection.status}', Required: '${InspectionStatus.ARCHIVED}'.`,
        );
      }
      this.logger.log(`Inspection ${inspectionId} deactivated by user ${userId}`);
      return this.prisma.inspection.findUniqueOrThrow({ where: { id: inspectionId } });
    } catch (error: any) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      this.logger.error(`Failed to deactivate inspection ${inspectionId}: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Could not deactivate inspection ${inspectionId}.`);
    }
  }

  /**
   * Reactivates a deactivated inspection record.
   * Changes status from DEACTIVATED back to ARCHIVED.
   *
   * @param {string} inspectionId - The UUID of the inspection to reactivate.
   * @param {string} userId - The ID of the user performing the action (ADMIN).
   * @returns {Promise<Inspection>} The updated inspection record.
   */
  async activateArchive(
    inspectionId: string,
    userId: string,
  ): Promise<Inspection> {
    this.logger.log(`User ${userId} attempting to reactivate inspection ${inspectionId}`);
    try {
      const result = await this.prisma.inspection.updateMany({
        where: { id: inspectionId, status: InspectionStatus.DEACTIVATED },
        data: { status: InspectionStatus.ARCHIVED, deactivatedAt: null, updatedAt: new Date() },
      });

      if (result.count === 0) {
        const currentInspection = await this.prisma.inspection.findUnique({ where: { id: inspectionId } });
        if (!currentInspection) throw new NotFoundException(`Inspection with ID "${inspectionId}" not found.`);
        throw new BadRequestException(
          `Inspection ${inspectionId} cannot be reactivated. Current status: '${currentInspection.status}', Required: '${InspectionStatus.DEACTIVATED}'.`,
        );
      }
      this.logger.log(`Inspection ${inspectionId} reactivated by user ${userId}`);
      return this.prisma.inspection.findUniqueOrThrow({ where: { id: inspectionId } });
    } catch (error: any) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      this.logger.error(`Failed to reactivate inspection ${inspectionId}: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Could not reactivate inspection ${inspectionId}.`);
    }
  }
}
