/*
 * --------------------------------------------------------------------------
 * File: inspection-blockchain.service.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Service responsible for blockchain minting, archive management,
 * and NFT operations for inspections. Manages a sequential minting queue
 * with circuit breaker pattern to prevent UTXO conflicts.
 * Extracted from InspectionsService to follow Single Responsibility Principle.
 * --------------------------------------------------------------------------
 */

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  BlockchainService,
  InspectionNftMetadata,
} from '../blockchain/blockchain.service';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { Inspection, InspectionStatus, Prisma } from '@prisma/client';
import { BuildMintTxDto } from '../blockchain/dto/build-mint-tx.dto';
import { ConfirmMintDto } from './dto/confirm-mint.dto';
import * as crypto from 'crypto';

interface NftMetadata {
  vehicleNumber: string | null;
  pdfHash: string | null;
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

@Injectable()
export class InspectionBlockchainService {
  private readonly logger = new Logger(InspectionBlockchainService.name);
  private readonly blockchainQueue = new BlockchainMintingQueue(1);

  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchainService: BlockchainService,
    private readonly config: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Get current queue statistics for monitoring purposes
   */
  getQueueStats() {
    return this.blockchainQueue.stats;
  }

  /**
   * Hash a vehicle number using SHA-256 and return hex string.
   * Use this when you need to store a privacy-preserving identifier on-chain.
   */
  hashVehicleNumber(vehicleNumber: string): string {
    if (!vehicleNumber || typeof vehicleNumber !== 'string') return '';
    const normalized = vehicleNumber.trim().toUpperCase();
    return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
  }

  /**
   * Helper to produce a small object to include in NFT metadata attributes.
   * Returns { hash, alg } where alg is the hashing algorithm used.
   */
  getVehicleNumberHashForMetadata(vehicleNumber: string) {
    const hash = this.hashVehicleNumber(vehicleNumber);
    return { vehicleNumberHash: hash, vehicleNumberAlg: 'sha256' };
  }

  /**
   * Normalize vehicle fields like brand/type: trim, collapse spaces, title-case.
   */
  normalizeVehicleField(input?: string | null): string | undefined {
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
   * Invalidates the cached list of inspections by incrementing the cache version.
   * This is called whenever an inspection is created, deleted, or its status changes.
   */
  private async invalidateListCache(): Promise<void> {
    try {
      await this.redisService.incr('inspections:list_version');
      this.logger.debug(
        'Inspection list cache invalidated (version incremented)',
      );
    } catch (error) {
      this.logger.error('Failed to invalidate inspection list cache', error);
    }
  }

  /**
   * Processes an approved inspection to the blockchain archive.
   * Validates, prepares NFT metadata, mints via the blockchain queue,
   * and updates the DB accordingly.
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
            `Failed to parse vehicleData for inspection ${inspectionId}: ${err instanceof Error ? err.message : String(err)
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
        const metadataAny = metadataForNft as unknown as Record<string, unknown>;
        Object.keys(metadataAny).forEach((key) =>
          metadataAny[key] === undefined || metadataAny[key] === null
            ? delete metadataAny[key]
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
        `Final archive result for inspection ${inspectionId}: status=${finalStatus}, blockchainResult=${blockchainSuccess ? 'SUCCESS' : 'FAILED'}`,
      );

      // Invalidate list cache
      await this.invalidateListCache();

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
        await this.invalidateListCache(); // Invalidate cache after rollback
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
      // Use update() with conditional where — returns record directly, eliminating post-query findUniqueOrThrow.
      // If the record doesn't match (not found or wrong status), Prisma throws P2025 / P2018.
      const updated = await this.prisma.inspection.update({
        where: {
          id: inspectionId,
          status: InspectionStatus.ARCHIVED,
        },
        data: {
          status: InspectionStatus.DEACTIVATED,
          deactivatedAt: new Date(),
        },
      }).catch(async (err: unknown) => {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          (err.code === 'P2025' || err.code === 'P2018')
        ) {
          // Record not found or condition not matched — distinguish between missing vs wrong status
          const exists = await this.prisma.inspection.findUnique({
            where: { id: inspectionId },
            select: { status: true },
          });
          if (!exists) {
            throw new NotFoundException(
              `Inspection with ID "${inspectionId}" not found.`,
            );
          }
          throw new BadRequestException(
            `Inspection ${inspectionId} cannot be deactivated because its current status is '${exists.status}', not '${InspectionStatus.ARCHIVED}'.`,
          );
        }
        throw err;
      });

      this.logger.log(
        `Inspection ${inspectionId} successfully deactivated (hidden)`,
      );

      // Invalidate list cache
      await this.invalidateListCache();

      return updated;
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
      // Use update() with conditional where — returns record directly, eliminating post-query findUniqueOrThrow.
      const updated = await this.prisma.inspection.update({
        where: {
          id: inspectionId,
          status: InspectionStatus.DEACTIVATED,
        },
        data: {
          status: InspectionStatus.ARCHIVED,
          deactivatedAt: null,
        },
      }).catch(async (err: unknown) => {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          (err.code === 'P2025' || err.code === 'P2018')
        ) {
          const exists = await this.prisma.inspection.findUnique({
            where: { id: inspectionId },
            select: { status: true },
          });
          if (!exists) {
            throw new NotFoundException(
              `Inspection with ID "${inspectionId}" not found.`,
            );
          }
          throw new BadRequestException(
            `Inspection ${inspectionId} cannot be reactivated because its current status is '${exists.status}', not '${InspectionStatus.ARCHIVED}'.`,
          );
        }
        throw err;
      });

      this.logger.log(
        `Inspection ${inspectionId} reactivated by user ${userId}`,
      );
      // Invalidate list cache
      await this.invalidateListCache();
      return updated;
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
    const updatedInspection = await this.prisma.inspection.update({
      where: { id: inspectionId },
      data: {
        status: InspectionStatus.ARCHIVED,
        nftAssetId: confirmDto.nftAssetId,
        blockchainTxHash: confirmDto.txHash,
        archivedAt: new Date(),
      },
    });

    // Invalidate list cache
    await this.invalidateListCache();

    return updatedInspection;
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

      // Invalidate list cache after status change
      await this.invalidateListCache();

      return updatedInspection;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      this.logger.error(
        `Failed to revert inspection ${inspectionId} to APPROVED: ${error instanceof Error ? error.message : 'Unknown error'
        }`,
        error instanceof Error ? error.stack : 'No stack trace',
      );
      throw new InternalServerErrorException(
        `Failed to revert inspection ${inspectionId} to APPROVED.`,
      );
    }
  }
}
