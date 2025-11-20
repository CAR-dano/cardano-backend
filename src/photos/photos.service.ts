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
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import {
  BackblazeService,
  BackblazeUploadResult,
} from '../backblaze/backblaze.service';
import { MetricsService } from '../metrics/metrics.service';

const LOCAL_UPLOAD_ROOT = './uploads';
const LOCAL_INSPECTION_DIRECTORY = 'inspection-photos';

@Injectable()
export class PhotosService {
  private readonly logger = new Logger(PhotosService.name);
  private readonly useBackblaze: boolean;
  private readonly localPublicBaseUrl: string;
  private backblazeMisconfigurationLogged = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly backblazeService: BackblazeService,
    private readonly metrics: MetricsService,
  ) {
    this.useBackblaze =
      this.configService.get<string>('USE_BACKBLAZE_PHOTOS') === 'true';
    this.localPublicBaseUrl = this.configService.get<string>(
      'LOCAL_PHOTO_BASE_URL',
    ) || '/uploads';
  }

  private shouldUseBackblaze(): boolean {
    if (!this.useBackblaze) {
      return false;
    }

    if (!this.backblazeService.isConfigured()) {
      if (!this.backblazeMisconfigurationLogged) {
        this.logger.error(
          'USE_BACKBLAZE_PHOTOS is enabled but Backblaze credentials are missing. Falling back to local storage.',
        );
        this.backblazeMisconfigurationLogged = true;
      }
      return false;
    }

    return true;
  }

  private generateStorageKey(
    inspectionId: string,
    originalName: string,
  ): string {
    const sanitized = originalName
      .split('.')[0]
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();
    const extension = path.extname(originalName) || '.jpg';
    const timestamp = new Date();
    const folder = `${timestamp.getUTCFullYear()}/${String(
      timestamp.getUTCMonth() + 1,
    ).padStart(2, '0')}`;
    const uniqueSuffix = randomUUID().split('-')[0];
    return `${LOCAL_INSPECTION_DIRECTORY}/${folder}/${inspectionId}-${sanitized}-${Date.now()}-${uniqueSuffix}${extension}`;
  }

  private buildLocalPublicUrl(relativePath: string): string {
    const normalizedBase = this.localPublicBaseUrl.replace(/\/$/, '');
    return `${normalizedBase}/${relativePath.replace(/\\/g, '/')}`;
  }

  private resolvePublicUrl(photo: Photo): string | null {
    if (photo.publicUrl) {
      if (/^https?:\/\//i.test(photo.publicUrl)) {
        return photo.publicUrl;
      }
      return this.buildLocalPublicUrl(photo.publicUrl);
    }

    if (!photo.path) {
      return null;
    }

    if (/^https?:\/\//i.test(photo.path)) {
      return photo.path;
    }

    const relativePath = photo.path.startsWith(LOCAL_INSPECTION_DIRECTORY)
      ? photo.path
      : path.join(LOCAL_INSPECTION_DIRECTORY, photo.path);
    return this.buildLocalPublicUrl(relativePath);
  }

  private withPublicUrl(photo: Photo): Photo {
    const publicUrl = this.resolvePublicUrl(photo);
    if (publicUrl === photo.publicUrl) {
      return photo;
    }
    return { ...photo, publicUrl };
  }

  private async persistPhotoBuffer(
    inspectionId: string,
    file: Express.Multer.File,
  ): Promise<{
    storagePath: string;
    publicUrl: string;
    backblazeMetadata: Pick<
      BackblazeUploadResult,
      'fileId' | 'fileName'
    > | null;
  }> {
    if (!file || !file.buffer) {
      throw new BadRequestException('Uploaded file buffer is missing.');
    }

    const storageKey = this.generateStorageKey(
      inspectionId,
      file.originalname,
    );
    const useBackblaze = this.shouldUseBackblaze();
    const provider = useBackblaze ? 'backblaze' : 'local';
    const startTime = Date.now();

    if (useBackblaze) {
      try {
        const result = await this.backblazeService.uploadPhotoBuffer(
          file.buffer,
          storageKey,
          file.mimetype,
        );
        this.metrics.recordPhotoUpload(
          provider,
          true,
          Date.now() - startTime,
        );

        return {
          storagePath: storageKey,
          publicUrl: result.publicUrl,
          backblazeMetadata: { fileId: result.fileId, fileName: result.fileName },
        };
      } catch (error) {
        this.metrics.recordPhotoUpload(
          provider,
          false,
          Date.now() - startTime,
        );
        this.logger.error(
          `Failed to upload photo to Backblaze for inspection ${inspectionId}: ${
            (error as Error)?.message || error
          }`,
          error instanceof Error ? error.stack : undefined,
        );
        throw new InternalServerErrorException(
          'Failed to upload photo to Backblaze.',
        );
      }
    }

    // Local fallback storage
    try {
      const absolutePath = path.join(LOCAL_UPLOAD_ROOT, storageKey);
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.writeFile(absolutePath, file.buffer);
      this.metrics.recordPhotoUpload(
        provider,
        true,
        Date.now() - startTime,
      );

      return {
        storagePath: storageKey,
        publicUrl: this.buildLocalPublicUrl(storageKey),
        backblazeMetadata: null,
      };
    } catch (error) {
      this.metrics.recordPhotoUpload(
        provider,
        false,
        Date.now() - startTime,
      );
      throw error;
    }
  }

  private async deleteFromStorage(
    photo: Pick<Photo, 'path' | 'backblazeFileId' | 'backblazeFileName'>,
  ): Promise<void> {
    if (photo.backblazeFileId && photo.backblazeFileName) {
      try {
        await this.backblazeService.deleteFile(
          photo.backblazeFileId,
          photo.backblazeFileName,
        );
        this.metrics.recordPhotoDelete('backblaze', true);
      } catch (error) {
        this.metrics.recordPhotoDelete('backblaze', false);
        this.logger.error(
          `Failed to delete Backblaze photo ${photo.backblazeFileName}: ${
            (error as Error)?.message || error
          }`,
          error instanceof Error ? error.stack : undefined,
        );
        throw error;
      }
      return;
    }

    if (photo.path) {
      const relativePath = photo.path.startsWith(LOCAL_INSPECTION_DIRECTORY)
        ? photo.path
        : path.join(LOCAL_INSPECTION_DIRECTORY, photo.path);
      const localPath = path.join(LOCAL_UPLOAD_ROOT, relativePath);
      try {
        await fs.unlink(localPath);
        this.metrics.recordPhotoDelete('local', true);
      } catch (fileError: unknown) {
        const err = fileError as NodeJS.ErrnoException;
        if (err?.code !== 'ENOENT') {
          this.metrics.recordPhotoDelete('local', false);
          throw fileError;
        }
        this.logger.warn(
          `Local photo ${localPath} already removed. Skipping deletion.`,
        );
        this.metrics.recordPhotoDelete('local', true);
      }
    }
  }

  private async cleanupPersisted(
    storagePath: string,
    backblazeMetadata: Pick<BackblazeUploadResult, 'fileId' | 'fileName'> | null,
  ): Promise<void> {
    if (backblazeMetadata) {
      try {
        await this.backblazeService.deleteFile(
          backblazeMetadata.fileId,
          backblazeMetadata.fileName,
        );
      } catch (error) {
        this.logger.warn(
          `Failed to cleanup Backblaze upload ${backblazeMetadata.fileName}: ${
            (error as Error)?.message || error
          }`,
        );
      }
      return;
    }

    const localPath = path.join(LOCAL_UPLOAD_ROOT, storagePath);
    try {
      await fs.unlink(localPath);
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err?.code !== 'ENOENT') {
        this.logger.warn(
          `Failed to remove local file ${localPath} during cleanup: ${err?.message}`,
        );
      }
    }
  }

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

    const persisted = await this.persistPhotoBuffer(inspectionId, file);

    try {
      const created = await this.prisma.photo.create({
        data: {
          inspection: { connect: { id: inspectionId } },
          path: persisted.storagePath,
          publicUrl: persisted.publicUrl,
          backblazeFileId: persisted.backblazeMetadata?.fileId,
          backblazeFileName: persisted.backblazeMetadata?.fileName,
          // eslint-disable-next-line prettier/prettier
          label:
            dto.label === '' || dto.label === undefined ? undefined : dto.label,
          category: dto.category, // Add category
          isMandatory: isMandatory, // Add isMandatory
          originalLabel: null,
          needAttention: needAttention,
        },
      });
      return this.withPublicUrl(created);
    } catch (error: unknown) {
      await this.cleanupPersisted(
        persisted.storagePath,
        persisted.backblazeMetadata,
      );
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
      const photos = await this.prisma.photo.findMany({
        where: { inspectionId: inspectionId },
        orderBy: { createdAt: 'asc' }, // Order by creation time
      });
      return photos.map((photo) => this.withPublicUrl(photo));
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
      let persistedReplacement:
        | {
            storagePath: string;
            publicUrl: string;
            backblazeMetadata: Pick<
              BackblazeUploadResult,
              'fileId' | 'fileName'
            > | null;
          }
        | null = null;

        if (newPhotoFile) {
          this.logger.verbose(
            `New file provided for photo ${photoId}. Replacing old file: ${existingPhoto.path}`,
          );
          persistedReplacement = await this.persistPhotoBuffer(
            inspectionId,
            newPhotoFile,
          );
          dataToUpdate.path = persistedReplacement.storagePath;
          dataToUpdate.publicUrl = persistedReplacement.publicUrl;
          dataToUpdate.backblazeFileId =
            persistedReplacement.backblazeMetadata?.fileId ?? null;
          dataToUpdate.backblazeFileName =
            persistedReplacement.backblazeMetadata?.fileName ?? null;
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
      try {
        const updatedPhoto = await this.prisma.photo.update({
          where: { id: photoId },
          data: dataToUpdate,
        });
        this.logger.log(`Successfully updated photo record ID: ${photoId}`);

        if (newPhotoFile) {
          await this.deleteFromStorage(existingPhoto).catch((fileError) => {
            const errorStack =
              fileError instanceof Error ? fileError.stack : undefined;
            this.logger.error(
              `Failed to delete old photo asset for record ${photoId}: ${
                (fileError as Error)?.message || fileError
              }`,
              errorStack,
            );
          });
        }

        return this.withPublicUrl(updatedPhoto);
      } catch (error) {
        if (persistedReplacement) {
          await this.cleanupPersisted(
            persistedReplacement.storagePath,
            persistedReplacement.backblazeMetadata,
          );
        }
        throw error;
      }
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
        select: {
          path: true,
          backblazeFileId: true,
          backblazeFileName: true,
        }, // Only need the storage information
      });

      // Delete the database record
      await this.prisma.photo.delete({
        where: { id: photoId },
      });

      await this.deleteFromStorage(photo).catch((fileError) => {
        const errorStack =
          fileError instanceof Error ? fileError.stack : undefined;
        this.logger.error(
          `Failed to delete stored asset for photo ${photoId}: ${
            (fileError as Error)?.message || fileError
          }`,
          errorStack,
        );
      });

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

    const persistedUploads: {
      storagePath: string;
      publicUrl: string;
      backblazeMetadata: Pick<BackblazeUploadResult, 'fileId' | 'fileName'> | null;
    }[] = [];

    try {
      for (const file of files) {
        const persisted = await this.persistPhotoBuffer(inspectionId, file);
        persistedUploads.push(persisted);
      }

      const createdPhotos = await this.prisma.$transaction(async (tx) => {
        const results: Photo[] = [];
        for (let index = 0; index < persistedUploads.length; index++) {
          const meta = parsedMetadata[index];
          const persisted = persistedUploads[index];
          const created = await tx.photo.create({
            data: {
              inspection: { connect: { id: inspectionId } },
              path: persisted.storagePath,
              publicUrl: persisted.publicUrl,
              backblazeFileId: persisted.backblazeMetadata?.fileId,
              backblazeFileName: persisted.backblazeMetadata?.fileName,
              label:
                meta.label === '' || meta.label === undefined
                  ? undefined
                  : meta.label,
              category: meta.category,
              isMandatory: meta.isMandatory ?? false,
              originalLabel: null,
              needAttention: meta.needAttention ?? false,
            },
          });
          results.push(created);
        }
        return results;
      });

      this.logger.log(
        `Successfully created ${createdPhotos.length} photo records for inspection ${inspectionId}.`,
      );

      return createdPhotos.map((photo) => this.withPublicUrl(photo));
    } catch (error: unknown) {
      await Promise.allSettled(
        persistedUploads.map((persisted) =>
          this.cleanupPersisted(
            persisted.storagePath,
            persisted.backblazeMetadata,
          ),
        ),
      );

      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to batch create photos for inspection ${inspectionId}: ${errorMessage}`,
        errorStack,
      );
      throw new InternalServerErrorException(
        'Could not save batch photo information.',
      );
    }
  }
}
