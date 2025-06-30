import {
  Injectable,
  Logger,
  InternalServerErrorException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Inspection, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InspectionChangeLog } from '@prisma/client';

@Injectable()
export class PublicApiService {
  // Initialize a logger for this service context
  private readonly logger = new Logger(PublicApiService.name);
  // Inject PrismaService dependency via constructor
  constructor(private prisma: PrismaService) {}

  /**
   * Retrieves a single inspection by ID.
   * Applies status-based filtering for non-admin/reviewer roles.
   *
   * @param {string} id - The UUID of the inspection.
   * @returns {Promise<Inspection>} The found inspection record.
   * @throws {NotFoundException} If inspection not found.
   * @throws {ForbiddenException} If user role doesn't have permission to view the inspection in its current status.
   */
  async findOne(id: string): Promise<Inspection> {
    try {
      const inspection = await this.prisma.inspection.findUniqueOrThrow({
        where: { id: id },
        include: { photos: true }, // Include related photos
        // include: { inspector: true, reviewer: true } // Include related users if needed
      });
      return inspection;
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

  async findChangesByInspectionId(
    inspectionId: string,
  ): Promise<InspectionChangeLog[]> {
    // Optional: Check if the inspection exists first if you want to throw NotFoundException
    const inspection = await this.prisma.inspection.findUnique({
      where: { id: inspectionId },
    });
    if (!inspection) {
      throw new NotFoundException(
        `Inspection with ID "${inspectionId}" not found.`,
      );
    }

    const changeLogs = await this.prisma.inspectionChangeLog.findMany({
      where: { inspectionId: inspectionId },
      orderBy: { changedAt: 'desc' }, // Order by timestamp descending (latest first)
    });

    const latestChangeLogsMap = new Map<string, InspectionChangeLog>();

    for (const log of changeLogs) {
      const key = `${log.fieldName}-${log.subFieldName}-${log.subsubfieldname}`;
      if (!latestChangeLogsMap.has(key)) {
        latestChangeLogsMap.set(key, log);
      }
    }

    return Array.from(latestChangeLogsMap.values());
  }
}
