/*
 * --------------------------------------------------------------------------
 * File: photos.service.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: NestJS service responsible for managing inspection photos.
 * Interacts with PrismaService to handle photo records and file system
 * operations for local storage.
 * Provides methods for adding, retrieving, updating, and deleting photos,
 * including batch operations.
 * --------------------------------------------------------------------------
 */

import {
  Injectable,
  Logger,
  InternalServerErrorException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Photo, Prisma } from '@prisma/client';
import { AddPhotoDto } from './dto/add-photo.dto';
import { UpdatePhotoDto } from './dto/update-photo.dto';
// Import file system operations if deleting local files
import * as fs from 'fs/promises';
import * as path from 'path';
const UPLOAD_PATH = './uploads/inspection-photos'; // Define consistently

@Injectable()
export class PhotosService {
  private readonly logger = new Logger(PhotosService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Ensures that an inspection with the given ID exists.
   * Throws a NotFoundException if the inspection is not found.
   *
   * @param inspectionId The ID of the inspection to check.
   * @param tx Optional Prisma transaction client to use for the check.
   * @throws NotFoundException if the inspection with the given ID does not exist.
   */
  private async ensureInspectionExists(
    inspectionId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const prismaClient = tx || this.prisma;
    const inspection = await prismaClient.inspection.findUnique({
      where: { id: inspectionId },
      select: { id: true }, // Only select ID for existence check
    });
    if (!inspection) {
      throw new NotFoundException(
        `Inspection with ID "${inspectionId}" not found.`,
      );
    }
  }

  /**
   * Creates a new Photo record in the database and associates it with an inspection.
   *
   * @param inspectionId The ID of the parent inspection.
   * @param file The uploaded file object from Multer.
   * @param dto DTO containing the custom label and needAttention flag for the photo.
   * @param userId Optional ID of the user performing the action.
   * @returns A promise that resolves to the created Photo record.
   * @throws NotFoundException if the inspection does not exist.
   * @throws InternalServerErrorException if the photo record could not be saved.
   */
  async addPhoto(
    inspectionId: string,
    file: Express.Multer.File,
    dto: AddPhotoDto,
    userId?: string,
  ): Promise<Photo> {
    this.logger.log(
      `User ${userId || 'N/A'} adding photo (label: ${dto.label}) for inspection ${inspectionId}`,
    );
    await this.ensureInspectionExists(inspectionId);

    // Parse needAttention string to boolean
    const needAttention = dto.needAttention === 'true';

    try {
      return await this.prisma.photo.create({
        data: {
          inspection: { connect: { id: inspectionId } },
          path: file.filename,
          label: dto.label,
          originalLabel: null,
          needAttention: needAttention,
          // submittedByUserId: userId,
        },
      });
    } catch (error: any) {
      this.logger.error(
        `Failed to save photo record for inspection ${inspectionId}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw new InternalServerErrorException(
        'Could not save photo information.',
      );
    }
  }

  /**
   * Retrieves all Photo records associated with a specific inspection.
   * Ensures the inspection exists before attempting to retrieve photos.
   *
   * @param inspectionId The UUID of the inspection.
   * @returns A promise that resolves to an array of Photo records, ordered by creation time.
   * @throws NotFoundException if the inspection does not exist.
   * @throws InternalServerErrorException if the photos could not be retrieved.
   */
  async findForInspection(inspectionId: string): Promise<Photo[]> {
    this.logger.log(`Retrieving all photos for inspection ID: ${inspectionId}`);
    await this.ensureInspectionExists(inspectionId); // Ensure inspection exists
    try {
      return await this.prisma.photo.findMany({
        where: { inspectionId: inspectionId },
        orderBy: { createdAt: 'asc' }, // Order by creation time
      });
    } catch (error: any) {
      this.logger.error(
        `Failed to retrieve photos for inspection ${inspectionId}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw new InternalServerErrorException('Could not retrieve photos.');
    }
  }

  /**
   * Updates an existing photo record in the database, optionally replacing the associated file and/or metadata.
   * Ensures the photo belongs to the specified inspection.
   *
   * @param inspectionId The ID of the parent inspection (for verification).
   * @param photoId The ID of the photo record to update.
   * @param updatePhotoDto DTO containing optional new label and needAttention flag.
   * @param newPhotoFile Optional new photo file to replace the old one.
   * @param userId Optional ID of the user performing the action.
   * @returns A promise that resolves to the updated Photo record.
   * @throws NotFoundException if the photo or inspection is not found.
   * @throws BadRequestException if no valid fields are provided for update.
   * @throws InternalServerErrorException if the photo could not be updated or the old file could not be deleted.
   */
  async updatePhoto(
    inspectionId: string, // Include inspectionId for verification
    photoId: string,
    updatePhotoDto: UpdatePhotoDto,
    newPhotoFile?: Express.Multer.File,
    userId?: string,
  ): Promise<Photo> {
    this.logger.log(
      `User ${userId || 'N/A'} attempting to update photo ID: ${photoId} for inspection ${inspectionId}`,
    );
    this.logger.debug('Update DTO:', updatePhotoDto);
    this.logger.debug('New file provided:', !!newPhotoFile);

    try {
      // 1. Find the existing photo record, ensuring it belongs to the correct inspection
      const existingPhoto = await this.prisma.photo.findUniqueOrThrow({
        where: {
          id: photoId,
          inspectionId: inspectionId, // Verify it belongs to the specified inspection
        },
      });
      this.logger.verbose(
        `Found existing photo [ID: ${photoId}, Path: ${existingPhoto.path}]`,
      );

      // 2. Prepare data for update object
      const dataToUpdate: Prisma.PhotoUpdateInput = {};
      let oldFilePath: string | null = null; // Store path of file to be deleted

      // 3. Handle Metadata Update
      if (updatePhotoDto.label !== undefined) {
        dataToUpdate.label = updatePhotoDto.label;
        this.logger.verbose(
          `Updating label for photo ${photoId} to "${updatePhotoDto.label}"`,
        );
      }

      if (updatePhotoDto.needAttention !== undefined) {
        const needAttentionBool = updatePhotoDto.needAttention === 'true';
        dataToUpdate.needAttention = needAttentionBool;
        this.logger.verbose(
          `Updating needAttention for photo ${photoId} to ${needAttentionBool}`,
        );
      }

      // 4. Handle File Replacement
      if (newPhotoFile) {
        this.logger.verbose(
          `New file provided: ${newPhotoFile.filename}. Replacing old file: ${existingPhoto.path}`,
        );
        dataToUpdate.path = newPhotoFile.filename; // Set the new path in the update data
        oldFilePath = existingPhoto.path; // Mark the old file path for deletion AFTER DB update
      }

      // 5. Check if there's anything to update
      if (Object.keys(dataToUpdate).length === 0) {
        this.logger.warn(
          `Update request for photo ${photoId} received, but no changes detected.`,
        );
        // Return existing photo data if nothing changed
        return existingPhoto;
        // Or throw BadRequestException
        // throw new BadRequestException('No valid fields provided for update.');
      }

      // 6. Perform the Database Update
      this.logger.debug(
        `Data prepared for Prisma update on photo ${photoId}:`,
        JSON.stringify(dataToUpdate),
      );
      const updatedPhoto = await this.prisma.photo.update({
        where: { id: photoId },
        data: dataToUpdate,
      });
      this.logger.log(`Successfully updated photo record ID: ${photoId}`);

      // 7. Delete Old File (AFTER successful DB update)
      if (oldFilePath) {
        const fullOldPath = path.join(UPLOAD_PATH, oldFilePath);
        this.logger.log(`Attempting to delete old file: ${fullOldPath}`);
        try {
          await fs.unlink(fullOldPath);
          this.logger.log(`Successfully deleted old file: ${fullOldPath}`);
        } catch (fileError: any) {
          // Log the error, but don't fail the overall operation since DB is updated
          this.logger.error(
            `Failed to delete old photo file ${fullOldPath} after updating record ${photoId}`,
            (fileError as Error).stack,
          );
          // TODO: Consider adding a mechanism to retry deletion or flag orphaned files
        }
      }

      return updatedPhoto;
    } catch (error: any) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        // Handles error from findUniqueOrThrow if initial find fails
        throw new NotFoundException(
          `Photo with ID "${photoId}" not found for inspection "${inspectionId}".`,
        );
      }
      if (error instanceof BadRequestException) throw error; // Re-throw validation errors
      this.logger.error(
        `Failed to update photo ${photoId}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw new InternalServerErrorException(
        `Could not update photo ${photoId}.`,
      );
    }
  }

  /**
   * Deletes a specific Photo record from the database and its corresponding file from local storage.
   *
   * @param photoId The UUID of the photo to delete.
   * @param userId Optional ID of the user performing the action (for auth checks later).
   * @returns A promise that resolves when the photo and file are deleted.
   * @throws NotFoundException if the photo with the given ID is not found.
   * @throws InternalServerErrorException if the photo record could not be deleted or the file could not be removed.
   */
  async deletePhoto(photoId: string, userId?: string): Promise<void> {
    this.logger.log(
      `User ${userId || 'N/A'} attempting to delete photo ID: ${photoId}`,
    );
    try {
      // Find the photo first to get its path for deletion
      const photo = await this.prisma.photo.findUniqueOrThrow({
        where: { id: photoId },
        select: { path: true }, // Only need the path
      });

      // Delete the database record
      await this.prisma.photo.delete({
        where: { id: photoId },
      });

      // --- Delete file from local storage ---
      // IMPORTANT: Only do this if using local diskStorage. Skip if using S3 etc.
      // Consider error handling here (what if DB delete works but file delete fails?)
      const filePath = path.join(UPLOAD_PATH, photo.path); // Assuming UPLOAD_PATH is defined globally/imported
      try {
        await fs.unlink(filePath);
        this.logger.log(`Successfully deleted photo file: ${filePath}`);
      } catch (fileError: any) {
        // Log the error but maybe don't fail the whole operation if DB record deleted?
        this.logger.error(
          `Failed to delete photo file ${filePath} after deleting DB record ${photoId}`,
          (fileError as Error).stack,
        );
      }
      // --- End File Deletion ---

      this.logger.log(`Successfully deleted photo record ID: ${photoId}`);
    } catch (error: any) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        // Record to delete not found
        throw new NotFoundException(`Photo with ID "${photoId}" not found.`);
      }
      this.logger.error(
        `Failed to delete photo ${photoId}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw new InternalServerErrorException(
        `Could not delete photo ${photoId}.`,
      );
    }
  }

  /**
   * Adds a batch of photos and their metadata to an inspection.
   * Parses the metadata JSON string, matches metadata with uploaded files by order,
   * and creates multiple Photo records within a database transaction.
   *
   * @param inspectionId The ID of the parent inspection.
   * @param files An array of uploaded file objects.
   * @param metadataJsonString A JSON string representing an array of metadata objects,
   *                           where each object should have a `label` (string) and
   *                           optionally `needAttention` (boolean).
   * @param userId Optional user ID of the user performing the action.
   * @returns A promise that resolves to an array of the created Photo records.
   * @throws BadRequestException if no files or metadata are provided, if metadata format is invalid,
   *                             or if metadata count does not match file count.
   * @throws NotFoundException if the inspection does not exist.
   * @throws InternalServerErrorException if the batch photo records could not be saved.
   */
  async addMultiplePhotos(
    inspectionId: string,
    files: Express.Multer.File[],
    metadataJsonString: string,
    userId?: string,
  ): Promise<Photo[]> {
    this.logger.log(
      `User ${userId || 'N/A'} adding BATCH of ${files?.length} photos to inspection ${inspectionId}`,
    );
    if (!files || files.length === 0)
      throw new BadRequestException('No photo files provided.');
    if (!metadataJsonString)
      throw new BadRequestException('Missing metadata JSON string.');

    let parsedMetadata: { label: string; needAttention?: boolean }[]; // Use a simple type for metadata
    try {
      parsedMetadata = JSON.parse(metadataJsonString);
      if (!Array.isArray(parsedMetadata))
        throw new Error('Metadata is not a valid JSON array.');
      if (parsedMetadata.length !== files.length) {
        throw new BadRequestException(
          `Metadata count (${parsedMetadata.length}) does not match photo count (${files.length}).`,
        );
      }
      // Optional: More detailed validation of each metadata object
      parsedMetadata.forEach((meta, i) => {
        if (!meta || typeof meta.label !== 'string' || meta.label.trim() === '')
          throw new BadRequestException(
            `Invalid label at metadata index ${i}.`,
          );
        if (
          meta.needAttention !== undefined &&
          typeof meta.needAttention !== 'boolean'
        )
          throw new BadRequestException(
            `Invalid needAttention at metadata index ${i}.`,
          );
      });
    } catch (error: any) {
      throw new BadRequestException(
        `Invalid metadata format: ${(error as Error).message}`,
      );
    }

    await this.ensureInspectionExists(inspectionId); // Ensure inspection exists

    // Prepare data for batch creation
    const photosToCreate: Prisma.PhotoCreateManyInput[] = files.map(
      (file, index) => {
        const meta = parsedMetadata[index];
        return {
          inspectionId: inspectionId, // Link each photo to the inspection
          path: file.filename,
          label: meta.label,
          originalLabel: null,
          needAttention: meta.needAttention ?? false,
          // submittedByUserId: userId, // Add if tracking
        };
      },
    );

    this.logger.debug(
      `Prepared ${photosToCreate.length} photo records for batch create.`,
    );

    try {
      // Use createMany for potentially better performance (though it doesn't return created records by default)
      // Or loop with create inside a transaction if you need the returned records
      const result = await this.prisma.photo.createMany({
        data: photosToCreate,
        skipDuplicates: false, // Throw error if something tries to create duplicate (based on unique constraints, if any)
      });

      this.logger.log(
        `Successfully created ${result.count} photo records for inspection ${inspectionId}.`,
      );

      // Since createMany doesn't return records, fetch them if needed for response
      // This adds an extra query but might be necessary.
      // A possible optimization: if filenames are unique and predictable, construct response without re-fetching.
      return this.prisma.photo.findMany({
        where: {
          inspectionId: inspectionId,
          // Filter specifically for the photos just added if possible (e.g., using createdAt range, tricky)
          // Or filter by path if filenames are reliably stored/unique
          path: { in: photosToCreate.map((p) => p.path) },
        },
        orderBy: { createdAt: 'asc' },
      });
    } catch (error: any) {
      this.logger.error(
        `Failed to batch create photos for inspection ${inspectionId}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      // TODO: Consider cleanup of successfully uploaded files if DB operation fails? Complex.
      throw new InternalServerErrorException(
        'Could not save batch photo information.',
      );
    }
  }
}
