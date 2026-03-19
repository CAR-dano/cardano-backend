/*
 * --------------------------------------------------------------------------
 * File: inspections.service.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Facade/orchestrator service for inspection operations.
 * Delegates query, PDF, and blockchain responsibilities to dedicated services
 * while retaining core CRUD and approval logic that crosses multiple concerns.
 * --------------------------------------------------------------------------
 */

import {
  Injectable,
  Logger,
  InternalServerErrorException,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInspectionDto } from './dto/create-inspection.dto';
import { UpdateInspectionDto } from './dto/update-inspection/update-inspection.dto';
import { ConfirmMintDto } from './dto/confirm-mint.dto';
import {
  Inspection,
  InspectionStatus,
  Prisma,
  Role,
  InspectionChangeLog,
  Photo,
} from '@prisma/client';
import * as fs from 'fs/promises';
import * as path from 'path';
import { format } from 'date-fns';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { InspectionQueryService } from './inspection-query.service';
import { InspectionPdfService } from './inspection-pdf.service';
import { InspectionBlockchainService } from './inspection-blockchain.service';

@Injectable()
export class InspectionsService {
  private readonly logger = new Logger(InspectionsService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private readonly redisService: RedisService,
    private readonly queryService: InspectionQueryService,
    private readonly pdfService: InspectionPdfService,
    private readonly blockchainService: InspectionBlockchainService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Delegated query methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Retrieves all inspection records with pagination and role-based filtering.
   * Delegates to InspectionQueryService.
   */
  async findAll(
    userRole: Role | undefined,
    status?: string | InspectionStatus[],
    page: number = 1,
    pageSize: number = 10,
  ) {
    return this.queryService.findAll(userRole, status, page, pageSize);
  }

  /**
   * Retrieves a single inspection by ID with role-based access control.
   * Delegates to InspectionQueryService.
   */
  async findOne(id: string, userRole: Role): Promise<Inspection> {
    return this.queryService.findOne(id, userRole);
  }

  /**
   * Finds a single inspection by vehicle plate number (case-insensitive, space-agnostic).
   * Delegates to InspectionQueryService.
   */
  async findByVehiclePlateNumber(
    vehiclePlateNumber: string,
  ): Promise<any | null> {
    return this.queryService.findByVehiclePlateNumber(vehiclePlateNumber);
  }

  /**
   * Finds inspections matching a keyword across multiple fields.
   * Delegates to InspectionQueryService.
   */
  async searchByKeyword(
    keyword: string,
    page: number = 1,
    pageSize: number = 10,
  ) {
    return this.queryService.searchByKeyword(keyword, page, pageSize);
  }

  /**
   * Retrieves the 5 most recent ARCHIVED inspections with "Tampak Depan" photo.
   * Delegates to InspectionQueryService.
   */
  async findLatestArchivedInspections(): Promise<
    Array<Inspection & { photos: Photo[] }>
  > {
    return this.queryService.findLatestArchivedInspections();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Delegated blockchain methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Process an APPROVED inspection into the blockchain archive.
   * Delegates to InspectionBlockchainService.
   */
  async processToArchive(
    inspectionId: string,
    userId: string,
  ): Promise<Inspection> {
    return this.blockchainService.processToArchive(inspectionId, userId);
  }

  /**
   * Deactivate an archived inspection on-chain.
   * Delegates to InspectionBlockchainService.
   */
  async deactivateArchive(
    inspectionId: string,
    superAdminId: string,
  ): Promise<Inspection> {
    return this.blockchainService.deactivateArchive(
      inspectionId,
      superAdminId,
    );
  }

  /**
   * Reactivate a previously deactivated archive on-chain.
   * Delegates to InspectionBlockchainService.
   */
  async activateArchive(
    inspectionId: string,
    superAdminId: string,
  ): Promise<Inspection> {
    return this.blockchainService.activateArchive(
      inspectionId,
      superAdminId,
    );
  }

  /**
   * Build an unsigned archive/mint transaction for the given inspection.
   * Delegates to InspectionBlockchainService.
   */
  async buildArchiveTransaction(inspectionId: string, adminAddress: string) {
    return this.blockchainService.buildArchiveTransaction(inspectionId, adminAddress);
  }

  /**
   * Confirm a previously built archive/mint transaction.
   * Delegates to InspectionBlockchainService.
   */
  async confirmArchive(
    inspectionId: string,
    dto: ConfirmMintDto,
  ): Promise<Inspection> {
    return this.blockchainService.confirmArchive(inspectionId, dto);
  }

  /**
   * Revert an inspection from ARCHIVED or FAIL_ARCHIVE back to APPROVED.
   * Delegates to InspectionBlockchainService.
   */
  async revertInspectionToApproved(
    inspectionId: string,
    superAdminId: string,
  ): Promise<Inspection> {
    return this.blockchainService.revertInspectionToApproved(
      inspectionId,
      superAdminId,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Queue stats (combines PDF + Blockchain)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get current queue statistics for monitoring purposes.
   */
  getQueueStats() {
    return {
      pdfQueue: this.pdfService.getQueueStats(),
      blockchainQueue: this.blockchainService.getQueueStats(),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Core orchestration methods (retained in facade)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Bulk approve multiple inspections with enhanced error handling.
   * Processes inspections sequentially to avoid race conditions and resource exhaustion.
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

    // Invalidate list cache after bulk approval
    await this.queryService.invalidateListCache();

    return {
      successful,
      failed,
      summary,
    };
  }

  /**
   * Helper method to rollback inspection status after error during approval.
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
        `Failed to rollback inspection ${inspectionId} status after approval error: ${rollbackError instanceof Error
          ? rollbackError.message
          : 'Unknown rollback error'
        }`,
        rollbackError instanceof Error ? rollbackError.stack : 'No stack trace',
      );
    }
  }

  /**
   * Helper method to sleep for a given number of milliseconds.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Generates the next custom inspection ID based on branch code and date.
   * Uses Redis atomic counter for thread safety and performance, falling back to DB if Redis is down.
   * Format: BRANCHCODE-DDMMYYYY-SEQ (e.g., YOG-01052025-001)
   */
  private async generateNextInspectionId(
    branchCode: string,
    inspectionDate: Date,
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    const datePrefix = format(inspectionDate, 'ddMMyyyy');
    const idPrefix = `${branchCode.toUpperCase()}-${datePrefix}-`;
    const redisKey = `inspection:sequence:${branchCode.toUpperCase()}:${datePrefix}`;
    const REDIS_TTL = 86400 * 2; // 2 days TTL

    let nextSequence: number | null = null;
    let usedRedis = false;

    // 1. Try to use Redis Atomic Counter (Fast Path)
    try {
      if (await this.redisService.isHealthy()) {
        const incremented = await this.redisService.incr(redisKey, REDIS_TTL);
        if (incremented !== null) {
          nextSequence = incremented;
          usedRedis = true;
          this.logger.verbose(`Generated sequence via Redis for ${redisKey}: ${nextSequence}`);
        }
      }
    } catch (error) {
      this.logger.warn(`Redis sequence generation failed, falling back to DB: ${(error as Error).message}`);
    }

    // 2. Fallback to Database if Redis failed or wasn't initialized
    if (nextSequence === null || nextSequence === 1) {
      try {
        this.logger.log(`Using Database for sequence generation (Fallback/Init) for ${idPrefix}`);
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
            nextSequence: 1,
          },
          select: {
            nextSequence: true,
          },
        });

        const dbSequence = sequenceRecord.nextSequence;

        if (usedRedis && nextSequence === 1 && dbSequence > 1) {
          this.logger.warn(`Redis counter desync detected (Redis: 1, DB: ${dbSequence}). Correcting Redis.`);
          await this.redisService.set(redisKey, dbSequence.toString(), REDIS_TTL);
          nextSequence = dbSequence;
        }
        else if (!usedRedis) {
          nextSequence = dbSequence;
          this.redisService.set(redisKey, dbSequence.toString(), REDIS_TTL).catch(() => { });
        }
        else {
          nextSequence = 1;
        }

      } catch (dbError) {
        this.logger.error(`Database sequence generation failed: ${(dbError as Error).message}`);
        throw dbError;
      }
    }

    // 3. Periodic sync to DB every 10 sequences for disaster recovery
    if (usedRedis && nextSequence !== null && nextSequence > 1 && nextSequence % 10 === 0) {
      try {
        await tx.inspectionSequence.upsert({
          where: {
            branchCode_datePrefix: {
              branchCode: branchCode.toUpperCase(),
              datePrefix: datePrefix,
            },
          },
          update: { nextSequence: nextSequence },
          create: {
            branchCode: branchCode.toUpperCase(),
            datePrefix: datePrefix,
            nextSequence: nextSequence,
          }
        });
      } catch (e) {
        this.logger.warn(`Failed to background sync sequence to DB: ${(e as Error).message}`);
      }
    }

    const nextSequenceStr = nextSequence?.toString().padStart(3, '0') || '000';

    return `${idPrefix}${nextSequenceStr}`;
  }

  /**
   * Creates a new inspection record with initial data (excluding photos).
   * Status defaults to NEED_REVIEW. Requires the ID of the submitting user (inspector).
   */
  async create(
    createInspectionDto: CreateInspectionDto,
    inspectorId: string,
  ): Promise<{ id: string }> {
    this.logger.log(
      `Creating inspection for plate: ${createInspectionDto.vehiclePlateNumber ?? 'N/A'
      } by inspector ${inspectorId}`,
    );

    const { identityDetails } = createInspectionDto;
    const customerName = identityDetails.namaCustomer;

    let effectiveInspectorId = inspectorId;
    if (!effectiveInspectorId) {
      this.logger.warn(
        'No inspectorId from auth. Falling back to ID from createInspectionDto.identityDetails.namaInspektor.',
      );
      effectiveInspectorId = identityDetails.namaInspektor;
    }

    if (!effectiveInspectorId) {
      throw new BadRequestException(
        'Inspector ID is missing. It must be provided either via an authenticated user or in the request body.',
      );
    }

    // 1. Fetch Inspector and Branch City records using UUIDs
    let inspectorName: string | null = null;
    let branchCityName: string | null = null;
    let branchCode = 'XXX';
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
      branchCode = branchCity.code.toUpperCase();
      this.logger.log(
        `Fetched branch city name: ${branchCityName}, code: ${branchCode}`,
      );
    } catch (e: unknown) {
      if (e instanceof BadRequestException) throw e;
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
      : new Date();
    if (isNaN(inspectionDateObj.getTime())) {
      throw new BadRequestException('Invalid inspectionDate format provided.');
    }

    // Step 1: Run transaction WITHOUT cache invalidation to avoid race condition
    const result = await this.prisma.$transaction(
      async (tx) => {
        const customId = await this.generateNextInspectionId(
          branchCode,
          inspectionDateObj,
          tx,
        );
        this.logger.log(`Generated custom inspection ID: ${customId}`);

        // 2. Prepare Data for Database
        const dataToCreate: Prisma.InspectionCreateInput = {
          pretty_id: customId,
          inspector: { connect: { id: effectiveInspectorId } },
          branchCity: { connect: { id: effectiveBranchCityUuid } },

          vehiclePlateNumber: createInspectionDto.vehiclePlateNumber,
          inspectionDate: inspectionDateObj,
          overallRating: createInspectionDto.overallRating != null ? String(createInspectionDto.overallRating) : undefined,

          identityDetails: {
            namaInspektor: inspectorName,
            namaCustomer: customerName,
            cabangInspeksi: branchCityName,
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
        };

        try {
          const newInspection = await tx.inspection.create({
            data: dataToCreate,
          });
          this.logger.log(
            `Inspection created successfully with ID: ${newInspection.id} (pretty_id: ${newInspection.pretty_id})`,
          );

          // ✅ REMOVED: Cache invalidation from inside transaction to eliminate race condition

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

    // ← Transaction COMMITTED here! Inspection is now visible in database

    // Step 2: ✅ Invalidate cache AFTER transaction commit to prevent race condition
    // This ensures concurrent queries will always get fresh data from database
    try {
      await this.queryService.invalidateListCache();
      this.logger.log(
        `Cache invalidated successfully after creating inspection ${result.id}`,
      );
    } catch (cacheError: unknown) {
      // Cache invalidation failure is non-critical - inspection already created successfully
      // Cache will naturally expire after TTL (60 seconds)
      const errorMessage =
        cacheError instanceof Error
          ? cacheError.message
          : 'Unknown cache error';
      this.logger.warn(
        `Failed to invalidate cache after inspection creation (non-critical): ${errorMessage}`,
      );
    }

    return result;
  }

  /**
   * Helper function for deep comparison of JSON objects up to three levels.
   * Logs changes to the provided 'changes' array.
   */
  private logJsonChangesRecursive(
    fieldName: string,
    oldJsonValue: Prisma.JsonValue,
    newJsonValue: Prisma.JsonValue,
    changes: Prisma.InspectionChangeLogCreateManyInput[],
    inspectionId: string,
    userId: string,
    path: string[] = [],
  ) {
    const isObject = (
      val: Prisma.JsonValue,
    ): val is Record<string, Prisma.JsonValue> =>
      typeof val === 'object' && val !== null && !Array.isArray(val);

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

    const oldObj = oldJsonValue as Record<string, Prisma.JsonValue>;
    const newObj = newJsonValue as Record<string, Prisma.JsonValue>;

    for (const key of Object.keys(newObj)) {
      const newValue = newObj[key];

      if (newValue === undefined || newValue === null) {
        continue;
      }

      const currentPathWithKey = [...path, key];
      this.logJsonChangesRecursive(
        fieldName,
        oldObj[key],
        newValue,
        changes,
        inspectionId,
        userId,
        currentPathWithKey,
      );
    }
  }

  /**
   * Logs changes made to an inspection record by a reviewer/admin.
   * Changes are recorded in the InspectionChangeLog table.
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

    const currentIdentityDetails =
      (existingInspection.identityDetails as Prisma.JsonObject) ?? {};

    const needsInspectorLookup =
      updateInspectionDto.inspectorId !== undefined &&
      updateInspectionDto.inspectorId !== existingInspection.inspectorId;
    const needsBranchCityLookup =
      updateInspectionDto.branchCityId !== undefined &&
      updateInspectionDto.branchCityId !== existingInspection.branchCityId;

    const [newInspectorResult, newBranchCityResult] = await Promise.all([
      needsInspectorLookup
        ? this.prisma.user.findUnique({
            where: { id: updateInspectionDto.inspectorId },
            select: { name: true },
          })
        : Promise.resolve(null),
      needsBranchCityLookup
        ? this.prisma.inspectionBranchCity.findUnique({
            where: { id: updateInspectionDto.branchCityId },
            select: { city: true },
          })
        : Promise.resolve(null),
    ]);

    if (needsInspectorLookup) {
      const newInspector = newInspectorResult;
      if (!newInspector) {
        throw new BadRequestException(
          `New inspector with ID "${updateInspectionDto.inspectorId}" not found.`,
        );
      }
      changesToLog.push({
        inspectionId: id,
        changedByUserId: userId,
        fieldName: 'identityDetails',
        subFieldName: 'namaInspektor',
        subsubfieldname: null,
        oldValue: currentIdentityDetails?.namaInspektor ?? Prisma.JsonNull,
        newValue: newInspector.name ?? Prisma.JsonNull,
      });
      this.logger.log(
        `Logged change for identityDetails.namaInspektor to "${newInspector.name}"`,
      );

      changesToLog.push({
        inspectionId: id,
        changedByUserId: userId,
        fieldName: 'inspector',
        subFieldName: null,
        subsubfieldname: null,
        oldValue: existingInspection?.inspectorId ?? Prisma.JsonNull,
        newValue: updateInspectionDto.inspectorId ?? Prisma.JsonNull,
      });
      this.logger.log(
        `Logged change for inspectorId "${updateInspectionDto.inspectorId}"`,
      );
    }

    if (needsBranchCityLookup) {
      const newBranchCity = newBranchCityResult;
      if (!newBranchCity) {
        throw new BadRequestException(
          `New branch city with ID "${updateInspectionDto.branchCityId}" not found.`,
        );
      }
      changesToLog.push({
        inspectionId: id,
        changedByUserId: userId,
        fieldName: 'identityDetails',
        subFieldName: 'cabangInspeksi',
        subsubfieldname: null,
        oldValue: currentIdentityDetails?.cabangInspeksi ?? Prisma.JsonNull,
        newValue: newBranchCity.city ?? Prisma.JsonNull,
      });
      this.logger.log(
        `Logged change for identityDetails.cabangInspeksi to "${newBranchCity.city}"`,
      );

      changesToLog.push({
        inspectionId: id,
        changedByUserId: userId,
        fieldName: 'branchCity',
        subFieldName: null,
        subsubfieldname: null,
        oldValue: existingInspection?.branchCityId ?? Prisma.JsonNull,
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
      changesToLog.push({
        inspectionId: id,
        changedByUserId: userId,
        fieldName: 'identityDetails',
        subFieldName: 'namaCustomer',
        subsubfieldname: null,
        oldValue: currentIdentityDetails?.namaCustomer ?? Prisma.JsonNull,
        newValue: newCustomerName ?? Prisma.JsonNull,
      });
      this.logger.log(
        `Logged change for identityDetails.namaCustomer to "${newCustomerName}"`,
      );
    }

    const jsonFieldsInInspectionModel: Array<
      keyof UpdateInspectionDto & keyof Inspection
    > = [
        'vehicleData',
        'equipmentChecklist',
        'inspectionSummary',
        'detailedAssessment',
        'bodyPaintThickness',
        'notesFontSizes',
      ];

    for (const key of Object.keys(updateInspectionDto)) {
      const dtoKey = key;
      const newValue = (updateInspectionDto as Record<string, unknown>)[dtoKey];
      const oldValue = (existingInspection as Inspection)[
        dtoKey as keyof Inspection
      ];

      if (newValue === undefined) continue;
      if (
        dtoKey === 'inspectorId' ||
        dtoKey === 'branchCityId' ||
        dtoKey === 'identityDetails'
      )
        continue;

      const processedNewValue =
        newValue instanceof Date ? newValue.toISOString() : newValue;
      const processedOldValue =
        oldValue instanceof Date ? oldValue.toISOString() : oldValue;

      if ((jsonFieldsInInspectionModel as string[]).includes(dtoKey)) {
        this.logger.verbose(`Comparing JSON field: ${dtoKey}`);
        this.logJsonChangesRecursive(
          dtoKey,
          processedOldValue,
          processedNewValue,
          changesToLog,
          id,
          userId,
          [],
        );
      } else {
        const oldValToLog =
          processedOldValue === undefined || processedOldValue === null
            ? Prisma.JsonNull
            : processedOldValue;
        const newValToLog =
          processedNewValue === undefined || processedNewValue === null
            ? Prisma.JsonNull
            : processedNewValue;

        if (dtoKey === 'vehiclePlateNumber' && typeof newValue === 'string') {
          const maxLength = 15;
          if (newValue.length > maxLength) {
            throw new BadRequestException(
              `Value for ${dtoKey} exceeds maximum length of ${maxLength} characters.`,
            );
          }
        }
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
   * Approves an inspection, applies the latest logged change for each field,
   * generates and stores the PDF, calculates its hash, and changes status to APPROVED.
   */
  async approveInspection(
    inspectionId: string,
    reviewerId: string,
    token: string | null,
  ): Promise<Inspection> {
    const startTime = Date.now();
    const queueStatsBefore = this.pdfService.getQueueStats();

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
                  typeof value === 'number'
                ) {
                  updateData.overallRating = String(value);
                }
              }
            } else if ((jsonUpdatableFields as string[]).includes(fieldName)) {
              const updateDataAny = updateData as Record<string, unknown>;
              if (
                !updateDataAny[fieldName] ||
                typeof updateDataAny[fieldName] !== 'object' ||
                Array.isArray(updateDataAny[fieldName])
              ) {
                updateDataAny[fieldName] = inspection[fieldName]
                  ? {
                    ...(inspection[fieldName] as Record<
                      string,
                      Prisma.JsonValue
                    >),
                  }
                  : {};
              }

              let current: Record<string, Prisma.JsonValue> = updateDataAny[
                fieldName
              ] as Record<string, Prisma.JsonValue>;
              for (let i = 1; i < parts.length - 1; i++) {
                const part = parts[i];
                if (
                  !current[part] ||
                  typeof current[part] !== 'object' ||
                  Array.isArray(current[part])
                ) {
                  current[part] = {};
                }
                current = current[part] as Record<string, Prisma.JsonValue>;
              }

              const lastPart = parts[parts.length - 1];
              if (
                fieldName === 'inspectionSummary' &&
                parts.length === 2 &&
                lastPart === 'estimasiPerbaikan'
              ) {
                if (typeof value === 'string') {
                  try {
                    current[lastPart] = JSON.parse(value as string);
                    this.logger.log(
                      `Parsed inspectionSummary.estimasiPerbaikan as JSON for inspection ${inspectionId}`,
                    );
                  } catch (e: unknown) {
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
                  current[lastPart] = value;
                }
              } else {
                current[lastPart] = value;
              }
            }
          }

          // 4. Apply the changes to the inspection record
          const finalUpdateData: Prisma.InspectionUpdateInput = {
            ...updateData,
            status: InspectionStatus.APPROVED,
            reviewer: { connect: { id: reviewerId } },
          };

          const updatedInspection = await tx.inspection.update({
            where: { id: inspectionId },
            data: finalUpdateData,
          });
          if (Object.keys(updateData).length > 0) {
            this.logger.log(
              `Applied ${Object.keys(updateData).length} field changes to inspection ${inspectionId}`,
            );
          }

          this.logger.log(
            `Inspection ${inspectionId} database updates completed by reviewer ${reviewerId}`,
          );
          return updatedInspection;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 10000,
          timeout: 30000,
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
          this.pdfService.generateAndSavePdf(fullPdfUrl, fullPdfFileName, token),
          this.pdfService.generateAndSavePdf(noDocsPdfUrl, noDocsPdfFileName, token),
        ]);

        // --- Final Database Update with PDF info and Final Status ---
        const finalUpdateData: Prisma.InspectionUpdateInput = {
          status: InspectionStatus.APPROVED,
          urlPdf: fullPdfResult.pdfPublicUrl,
          pdfFileHash: fullPdfResult.pdfHashString,
          ipfsPdf: `ipfs://${fullPdfResult.pdfCid}`,
          urlPdfNoDocs: noDocsPdfResult.pdfPublicUrl,
          pdfFileHashNoDocs: noDocsPdfResult.pdfHashString,
          ipfsPdfNoDocs: `ipfs://${noDocsPdfResult.pdfCid}`,
        };

        const finalInspection = await this.prisma.inspection.update({
          where: { id: inspectionId },
          data: finalUpdateData,
        });

        const totalTime = Date.now() - startTime;
        const queueStatsAfter = this.pdfService.getQueueStats();

        this.logger.log(
          `Inspection ${inspectionId} approved successfully in ${totalTime}ms. Queue stats: processed=${queueStatsAfter.totalProcessed}, errors=${queueStatsAfter.totalErrors}`,
        );

        // Invalidate list cache after approval
        await this.queryService.invalidateListCache();

        return finalInspection;
      } catch (pdfError: unknown) {
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

      if (
        transactionError instanceof BadRequestException ||
        transactionError instanceof NotFoundException
      ) {
        throw transactionError;
      }

      throw new InternalServerErrorException(
        `Failed to process inspection approval for ${inspectionId}: ${errorMessage}`,
      );
    }
  }

  /**
   * Permanently deletes an inspection, its related photos, change logs, and all associated files from disk.
   * This is a destructive operation intended only for SUPERADMIN use.
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
        filePathsToDelete.push(path.join(UPLOAD_PATH, photo.path));
      }
    });
    if (inspection.urlPdf) {
      filePathsToDelete.push(
        path.join(PDF_ARCHIVE_PATH, path.basename(inspection.urlPdf)),
      );
    }
    if (inspection.urlPdfNoDocs) {
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
      // Invalidate list cache
      await this.queryService.invalidateListCache();
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
        const inspection = await tx.inspection.findUnique({
          where: { id: inspectionId },
        });

        if (!inspection) {
          throw new NotFoundException(
            `Inspection with ID "${inspectionId}" not found for status rollback.`,
          );
        }

        if (inspection.status === InspectionStatus.NEED_REVIEW) {
          throw new BadRequestException(
            `Inspection ${inspectionId} is already in NEED_REVIEW status. No rollback needed.`,
          );
        }

        const originalStatus = inspection.status;

        const updatedInspection = await tx.inspection.update({
          where: { id: inspectionId },
          data: {
            status: InspectionStatus.NEED_REVIEW,
            updatedAt: new Date(),
          },
        });

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

      // Invalidate list cache
      await this.queryService.invalidateListCache();

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
}
