/*
 * --------------------------------------------------------------------------
 * File: public-api.service.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: This service handles public API operations related to inspections.
 * It provides methods for retrieving inspection details and their change logs,
 * ensuring data integrity and proper error handling.
 * --------------------------------------------------------------------------
 */

// NestJS common imports
import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { AppLogger } from '../logging/app-logger.service';

// Prisma client imports for database models and types
import { Inspection, Prisma, InspectionChangeLog } from '@prisma/client';

// Local service imports
import { PrismaService } from '../prisma/prisma.service';

/**
 * @Injectable
 * PublicApiService handles public-facing operations related to inspections.
 * It interacts with the PrismaService to fetch and manage inspection data.
 */
@Injectable()
export class PublicApiService {
  // Initialize a logger for this service context
  constructor(private prisma: PrismaService, private readonly logger: AppLogger) {
    this.logger.setContext(PublicApiService.name);
  }

  /**
   * Constructor for PublicApiService.
   * Injects the PrismaService dependency.
   * @param prisma - The PrismaService instance for database interactions.
   */
  

  /**
   * Retrieves a single inspection by its unique ID.
   * This method includes related photos and handles potential database errors.
   *
   * @param id - The UUID of the inspection to retrieve.
   * @returns A promise that resolves to the found Inspection record.
   * @throws {NotFoundException} If an inspection with the given ID is not found in the database.
   * @throws {ForbiddenException} If the user role does not have permission to view the inspection in its current status (though this specific logic is not implemented in the provided snippet, it's included for completeness based on the original JSDoc).
   * @throws {InternalServerErrorException} For any other unexpected errors during the retrieval process.
   */
  async findOne(id: string): Promise<Inspection> {
    try {
      // Attempt to find a unique inspection by ID, including its associated photos.
      const inspection = await this.prisma.inspection.findUniqueOrThrow({
        where: { id: id },
        include: { photos: true }, // Include related photos in the result
        // include: { inspector: true, reviewer: true } // Optional: Include related user data if needed
      });
      return inspection;
    } catch (error: unknown) {
      // Handle specific Prisma client known request errors, such as 'P2025' for record not found.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        // Throw a NotFoundException if the inspection is not found.
        throw new NotFoundException(`Inspection with ID "${id}" not found.`);
      }
      // Re-throw ForbiddenException if it's already an instance of it.
      if (error instanceof ForbiddenException) {
        throw error;
      }
      // Construct a user-friendly error message and capture the stack trace.
      const errorMessage =
        error instanceof Error ? error.message : 'An unknown error occurred';
      const errorStack =
        error instanceof Error ? error.stack : 'No stack trace available';
      // Log the error for debugging purposes.
      this.logger.error(
        `Failed to retrieve inspection ID ${id}: ${errorMessage}`,
        errorStack,
      );
      // Throw a generic InternalServerErrorException for unhandled errors.
      throw new InternalServerErrorException(
        `Could not retrieve inspection ${id}.`,
      );
    }
  }

  /**
   * Retrieves a single inspection by ID, excluding photos with sensitive document labels.
   * This is intended for public-facing endpoints where documents like "STNK" or "BPKB" should not be exposed.
   *
   * @param {string} id - The UUID of the inspection.
   * @returns {Promise<Inspection>} The found inspection record with filtered photos.
   * @throws {NotFoundException} If inspection not found.
   */
  async findOneWithoutDocuments(id: string): Promise<Inspection> {
    this.logger.log(
      `Retrieving public inspection ID: ${id}, excluding sensitive documents`,
    );
    try {
      const inspection = await this.prisma.inspection.findUniqueOrThrow({
        where: { id: id },
        include: { photos: true },
      });

      // Define keywords for filtering photos. Case-insensitive.
      const excludedKeywords = [
        'stnk',
        'bpkb',
        'dokumen',
        'documents',
        'STNK',
        'BPKB',
        'Foto Dokumen',
        'foto dokumen',
      ];

      // Filter out photos that have labels or categories matching the keywords.
      if (inspection.photos) {
        inspection.photos = inspection.photos.filter((photo) => {
          const label = photo.label?.toLowerCase() || '';
          const category = photo.category?.toLowerCase() || '';
          // Return true (keep photo) if no keyword is found in label or category
          return !excludedKeywords.some(
            (keyword) => label.includes(keyword) || category.includes(keyword),
          );
        });
      }

      return inspection;
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Inspection with ID "${id}" not found.`);
      }
      const errorMessage =
        error instanceof Error ? error.message : 'An unknown error occurred';
      const errorStack =
        error instanceof Error ? error.stack : 'No stack trace available';
      this.logger.error(
        `Failed to retrieve public inspection ID ${id}: ${errorMessage}`,
        errorStack,
      );
      throw new InternalServerErrorException(
        `Could not retrieve public inspection ${id}.`,
      );
    }
  }

  /**
   * Retrieves a list of unique change logs for a specific inspection.
   * It first verifies the existence of the inspection and then fetches its change logs,
   * returning only the latest change for each unique field combination.
   *
   * @param inspectionId - The ID of the inspection for which to retrieve change logs.
   * @returns A promise that resolves to an array of unique InspectionChangeLog objects.
   * @throws {NotFoundException} If the inspection with the given ID does not exist.
   */
  async findChangesByInspectionId(
    inspectionId: string,
  ): Promise<InspectionChangeLog[]> {
    // Check if the inspection exists before fetching change logs.
    const inspection = await this.prisma.inspection.findUnique({
      where: { id: inspectionId },
    });
    // If the inspection is not found, throw a NotFoundException.
    if (!inspection) {
      throw new NotFoundException(
        `Inspection with ID "${inspectionId}" not found.`,
      );
    }

    // Retrieve all change logs for the specified inspection, ordered by the latest changes first.
    const changeLogs = await this.prisma.inspectionChangeLog.findMany({
      where: { inspectionId: inspectionId },
      orderBy: { changedAt: 'desc' }, // Order by timestamp in descending order (latest first)
    });

    // Use a Map to store only the latest change log for each unique field combination.
    const latestChangeLogsMap = new Map<string, InspectionChangeLog>();

    // Iterate through the change logs to populate the map.
    for (const log of changeLogs) {
      // Create a unique key based on fieldName, subFieldName, and subsubfieldname.
      const key = `${log.fieldName}-${log.subFieldName}-${log.subsubfieldname}`;
      // If the key is not already in the map, add the current log (which will be the latest due to sorting).
      if (!latestChangeLogsMap.has(key)) {
        latestChangeLogsMap.set(key, log);
      }
    }

    // Convert the map values back to an array and return.
    return Array.from(latestChangeLogsMap.values());
  }
}
