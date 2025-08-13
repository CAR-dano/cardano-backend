/*
 * --------------------------------------------------------------------------
 * File: photos.service.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Service handling business logic for inspection photos.
 * Interacts with PrismaService to create, retrieve, and delete photo records.
 * --------------------------------------------------------------------------
 */

/**
 * @fileoverview Service handling business logic for inspection photos.
 * Interacts with PrismaService to create, retrieve, and delete photo records.
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
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { PhotoMetadataDto } from './dto/photo-metadata.dto';
const UPLOAD_PATH = './uploads/inspection-photos'; // Define consistently

@Injectable()
export class PhotosService {
  private readonly logger = new Logger(PhotosService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Ensures that an inspection with the given ID exists in the database.
   * Throws a NotFoundException if the inspection is not found.
   *
   * @param inspectionId The unique identifier of the inspection to check.
   * @param tx Optional Prisma transaction client to use for the query.
   * @throws NotFoundException if the inspection with the specified ID does not exist.
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
   * Creates a new photo record associated with a specific inspection.
   * Uploads the file and saves the photo metadata to the database.
   *
   * @param inspectionId The ID of the parent inspection.
   * @param file The uploaded file object from Multer.
   * @param dto The DTO containing additional photo information like label and needAttention flag.
   * @param userId Optional ID of the user performing the action.
   * @returns A promise that resolves to the created Photo record.
   * @throws NotFoundException if the inspection does not exist.
   * @throws InternalServerErrorException if saving the photo information fails.
   */
  async addPhoto(
    inspectionId: string,
    file: Express.Multer.File,
    dto: AddPhotoDto,
  ): Promise<Photo> {
    await this.ensureInspectionExists(inspectionId);

    // Parse boolean strings to boolean
    const needAttention = dto.needAttention === 'true';
    const isMandatory = dto.isMandatory === 'true';

    try {
      return await this.prisma.photo.create({
        data: {
          inspection: { connect: { id: inspectionId } },
          path: file.filename,
          // eslint-disable-next-line prettier/prettier
          label:
            dto.label === '' || dto.label === undefined ? undefined : dto.label,
          category: dto.category, // Add category
          isMandatory: isMandatory, // Add isMandatory
          originalLabel: null,
          needAttention: needAttention,
        },
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to save photo record for inspection ${inspectionId}: ${errorMessage}`,
        errorStack,
      );
      throw new InternalServerErrorException(
        'Could not save photo information.',
      );
    }
  }

  /**
   * Finds all photo records associated with a specific inspection ID.
   *
   * @param inspectionId The unique identifier (UUID) of the inspection.
   * @returns A promise that resolves to an array of Photo records ordered by creation time.
   * @throws NotFoundException if the inspection does not exist.
   * @throws InternalServerErrorException if retrieving the photos fails.
   */
  async findForInspection(inspectionId: string): Promise<Photo[]> {
    this.logger.log(`Retrieving all photos for inspection ID: ${inspectionId}`);
    await this.ensureInspectionExists(inspectionId); // Ensure inspection exists
    try {
      return await this.prisma.photo.findMany({
        where: { inspectionId: inspectionId },
        orderBy: { createdAt: 'asc' }, // Order by creation time
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to retrieve photos for inspection ${inspectionId}: ${errorMessage}`,
        errorStack,
      );
      throw new InternalServerErrorException('Could not retrieve photos.');
    }
  }

  /**
   * Updates an existing photo record, potentially replacing the associated file and/or metadata.
   * Ensures the photo belongs to the specified inspection before updating.
   *
   * @param inspectionId The ID of the parent inspection (for verification).
   * @param photoId The ID of the photo record to update.
   * @param updatePhotoDto DTO containing optional new label and needAttention flag.
   * @param newPhotoFile Optional new photo file to replace the old one.
   * @param userId Optional ID of the user performing the action.
   * @returns A promise that resolves to the updated photo record.
   * @throws NotFoundException if the photo or inspection is not found.
   * @throws BadRequestException if no valid fields are provided for update.
   * @throws InternalServerErrorException if the database update or file deletion fails.
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
        dataToUpdate.label =
          updatePhotoDto.label === '' ? undefined : updatePhotoDto.label;
        this.logger.verbose(
          `Updating label for photo ${photoId} to "${dataToUpdate.label}"`,
        );
      }

      if (updatePhotoDto.needAttention !== undefined) {
        const needAttentionBool = updatePhotoDto.needAttention === 'true';
        dataToUpdate.needAttention = needAttentionBool;
        this.logger.verbose(
          `Updating needAttention for photo ${photoId} to ${needAttentionBool}`,
        );
      }

      if (updatePhotoDto.displayInPdf !== undefined) {
        const displayInPdfBool = updatePhotoDto.displayInPdf === 'true';
        dataToUpdate.displayInPdf = displayInPdfBool;
        this.logger.verbose(
          `Updating displayInPdf for photo ${photoId} to ${displayInPdfBool}`,
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
        } catch (fileError: unknown) {
          // Log the error, but don't fail the overall operation since DB is updated
          const errorStack =
            fileError instanceof Error ? fileError.stack : undefined;
          this.logger.error(
            `Failed to delete old photo file ${fullOldPath} after updating record ${photoId}`,
            errorStack,
          );
          // TODO: Consider adding a mechanism to retry deletion or flag orphaned files
        }
      }

      return updatedPhoto;
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        // Handles error from findUniqueOrThrow if initial find fails
        throw new NotFoundException(
          `Photo with ID "${photoId}" not found for inspection "${inspectionId}".`,
        );
      }
      if (error instanceof BadRequestException) {
        throw error; // Re-throw validation errors
      }
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to update photo ${photoId}: ${errorMessage}`,
        errorStack,
      );
      throw new InternalServerErrorException(
        `Could not update photo ${photoId}.`,
      );
    }
  }

  /**
   * Deletes a specific photo record and its corresponding file (if stored locally).
   *
   * @param photoId The unique identifier (UUID) of the photo to delete.
   * @param userId Optional ID of the user performing the action (for authorization checks later).
   * @returns A promise that resolves when the photo and its file are successfully deleted.
   * @throws NotFoundException if the photo with the specified ID is not found.
   * @throws InternalServerErrorException if the database deletion or file deletion fails.
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
      } catch (fileError: unknown) {
        // Log the error but maybe don't fail the whole operation if DB record deleted?
        const errorStack =
          fileError instanceof Error ? fileError.stack : undefined;
        this.logger.error(
          `Failed to delete photo file ${filePath} after deleting DB record ${photoId}`,
          errorStack,
        );
      }
      // --- End File Deletion ---

      this.logger.log(`Successfully deleted photo record ID: ${photoId}`);
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        // Record to delete not found
        throw new NotFoundException(`Photo with ID "${photoId}" not found.`);
      }
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to delete photo ${photoId}: ${errorMessage}`,
        errorStack,
      );
      throw new InternalServerErrorException(
        `Could not delete photo ${photoId}.`,
      );
    }
  }

  /**
   * Adds a batch of photos and their metadata to an inspection.
   * Parses metadata JSON string, matches with uploaded files by order,
   * and creates multiple Photo records within a transaction.
   *
   * @param inspectionId The ID of the parent inspection.
   * @param files An array of uploaded file objects.
   * @param metadataJsonString A JSON string representing an array of metadata objects for each photo.
   * @param userId Optional ID of the user performing the action.
   * @returns A promise that resolves to an array of the created Photo records.
   * @throws BadRequestException if no files or metadata are provided, or if metadata format is invalid or counts do not match.
   * @throws NotFoundException if the inspection does not exist.
   * @throws InternalServerErrorException if the batch creation of photo records fails.
   */
  async addMultiplePhotos(
    inspectionId: string,
    files: Express.Multer.File[],
    metadataJsonString: string,
  ): Promise<Photo[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No photo files provided.');
    }
    if (!metadataJsonString) {
      throw new BadRequestException('Missing metadata JSON string.');
    }

    let parsedMetadata: any[];

    try {
      parsedMetadata = JSON.parse(metadataJsonString);

      if (!Array.isArray(parsedMetadata)) {
        throw new Error('Metadata is not a valid JSON array.');
      }
      if (parsedMetadata.length !== files.length) {
        throw new BadRequestException(
          `Metadata count (${parsedMetadata.length}) does not match photo count (${files.length}).`,
        );
      }

      const validationErrors: { photoIndex: number; errors: string[] }[] = [];
      for (let i = 0; i < parsedMetadata.length; i++) {
        const metadataObject = parsedMetadata[i];
        const metadataDto = plainToInstance(PhotoMetadataDto, metadataObject);
        const errors = await validate(metadataDto);
        if (errors.length > 0) {
          validationErrors.push({
            photoIndex: i,
            errors: errors
              .map((e) => (e.constraints ? Object.values(e.constraints) : []))
              .flat(),
          });
        }
      }

      if (validationErrors.length > 0) {
        throw new BadRequestException({
          message: 'Validation failed for photo metadata.',
          errors: validationErrors,
        });
      }
    } catch (error: unknown) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new BadRequestException(`Invalid metadata format: ${errorMessage}`);
    }

    await this.ensureInspectionExists(inspectionId); // Ensure inspection exists

    // Prepare data for batch creation
    const photosToCreate: Prisma.PhotoCreateManyInput[] = files.map(
      (file, index) => {
        const meta = parsedMetadata[index];
        return {
          inspectionId: inspectionId, // Link each photo to the inspection
          path: file.filename,
          label:
            meta.label === '' || meta.label === undefined
              ? undefined
              : meta.label,
          category: meta.category, // Add category
          isMandatory: meta.isMandatory ?? false, // Add isMandatory
          originalLabel: null,
          needAttention: meta.needAttention ?? false,
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
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to batch create photos for inspection ${inspectionId}: ${errorMessage}`,
        errorStack,
      );
      // TODO: Consider cleanup of successfully uploaded files if DB operation fails? Complex.
      throw new InternalServerErrorException(
        'Could not save batch photo information.',
      );
    }
  }
}
