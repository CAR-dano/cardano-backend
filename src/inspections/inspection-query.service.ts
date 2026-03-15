/*
 * --------------------------------------------------------------------------
 * File: inspection-query.service.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Service responsible for read/query operations on inspections.
 * Handles listing, searching, filtering, and caching of inspection data.
 * Extracted from InspectionsService to follow Single Responsibility Principle.
 * --------------------------------------------------------------------------
 */

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import {
  Inspection,
  InspectionStatus,
  Prisma,
  Role,
  Photo,
} from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class InspectionQueryService {
  private readonly logger = new Logger(InspectionQueryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Invalidates the inspection list cache by incrementing the version counter.
   * This is public because the InspectionsService orchestrator also calls it
   * after write operations (create, update, delete, status changes).
   */
  async invalidateListCache(): Promise<void> {
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
   * @returns {Promise<{ data: any[], meta: { total: number, page: number, pageSize: number, totalPages: number } }>} An object containing an array of inspection records and pagination metadata.
   */
  async findAll(
    userRole: Role | undefined,
    status?: string | InspectionStatus[], // Accept string or array
    page: number = 1,
    pageSize: number = 10,
  ): Promise<{
    data: any[];
    meta: { total: number; page: number; pageSize: number; totalPages: number };
  }> {
    this.logger.log(
      `Retrieving inspections for user role: ${userRole ?? 'N/A'}, status: ${
        Array.isArray(status) ? status.join(',') : (status ?? 'ALL (default)')
      }, page: ${page}, pageSize: ${pageSize}`,
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

    // --- CACHING LOGIC START ---
    const cacheParams = {
      userRole,
      status: parsedStatus,
      page,
      pageSize,
    };
    const cacheKeyHash = crypto
      .createHash('md5')
      .update(JSON.stringify(cacheParams))
      .digest('hex');
    const version =
      (await this.redisService.get('inspections:list_version')) || '0';
    const cacheKey = `inspections:list:v${version}:${cacheKeyHash}`;

    try {
      const cachedResult = await this.redisService.get(cacheKey);
      if (cachedResult) {
        this.logger.log(
          `[findAll] Returning cached result for key: ${cacheKey}`,
        );
        return JSON.parse(cachedResult);
      }
    } catch (error) {
      this.logger.warn(
        `[findAll] Failed to retrieve from cache: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    // --- CACHING LOGIC END ---

    try {
      const total = await this.prisma.inspection.count({ where: whereClause });
      const inspections = await this.prisma.inspection.findMany({
        where: whereClause,
        orderBy: {
          createdAt: 'desc', // Order by newest first
        },
        skip: skip,
        take: pageSize,
        select: {
          id: true,
          pretty_id: true,
          vehiclePlateNumber: true,
          inspectionDate: true,
          status: true,
          identityDetails: true,
          vehicleData: true,
          createdAt: true,
          updatedAt: true,
          urlPdf: true,
          blockchainTxHash: true,
        },
      });

      this.logger.log(
        `Retrieved ${
          inspections.length
        } inspections of ${total} total for role ${userRole ?? 'N/A'}.`,
      );

      const totalPages = Math.ceil(total / pageSize);
      const result = {
        data: inspections,
        meta: {
          total,
          page,
          pageSize,
          totalPages,
        },
      };

      // --- CACHE THE RESULT ---
      try {
        await this.redisService.set(cacheKey, JSON.stringify(result), 300); // 5 min TTL
      } catch (error) {
        this.logger.warn(
          `[findAll] Failed to cache result: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      return result;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'An unknown error occurred';
      const errorStack =
        error instanceof Error ? error.stack : 'No stack trace available';
      this.logger.error(
        `Failed to retrieve inspections for role ${
          userRole ?? 'N/A'
        }: ${errorMessage}`,
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

    // --- CACHING LOGIC START ---
    const version =
      (await this.redisService.get('inspections:list_version')) || '0';
    const cacheKey = `inspections:detail:v${version}:${id}`;

    try {
      if (await this.redisService.isHealthy()) {
        const cachedResult = await this.redisService.get(cacheKey);
        if (cachedResult) {
          this.logger.debug(
            `[findOne] Returning cached result for key: ${cacheKey}`,
          );
          return JSON.parse(cachedResult);
        }
      }
    } catch (error) {
      this.logger.warn(
        `[findOne] Failed to retrieve from cache: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    // --- CACHING LOGIC END ---

    try {
      const inspection = await this.prisma.inspection.findUniqueOrThrow({
        where: { id: id },
        select: {
          id: true,
          vehiclePlateNumber: true,
          inspectionDate: true,
          overallRating: true,
          createdAt: true,
          updatedAt: true,
          detailedAssessment: true,
          equipmentChecklist: true,
          identityDetails: true,
          inspectionSummary: true,
          vehicleData: true,
          archivedAt: true,
          blockchainTxHash: true,
          deactivatedAt: true,
          inspectorId: true,
          nftAssetId: true,
          pdfFileHash: true,
          reviewerId: true,
          status: true,
          urlPdf: true,
          bodyPaintThickness: true,
          pretty_id: true,
          notesFontSizes: true,
          branchCityId: true,
          ipfsPdf: true,
          ipfsPdfNoDocs: true,
          pdfFileHashNoDocs: true,
          urlPdfNoDocs: true,
          url_pdf_cloud: true,
          url_pdf_no_docs_cloud: true,
          photos: true, // Include related photos
        },
      });

      // Check authorization based on role and status
      if (
        userRole === Role.ADMIN ||
        userRole === Role.REVIEWER ||
        userRole === Role.SUPERADMIN
      ) {
        this.logger.log(
          `Admin/Reviewer/Superadmin access granted for inspection ${id}`,
        );
      } else if (inspection.status === InspectionStatus.ARCHIVED) {
        this.logger.log(
          `Public/Inspector access granted for ARCHIVED inspection ${id}`,
        );
      } else {
        // If found but not ARCHIVED, and user is not Admin/Reviewer
        this.logger.warn(
          `Access denied for user role ${userRole} on inspection ${id} with status ${inspection.status}`,
        );
        throw new ForbiddenException(
          `You do not have permission to view this inspection in its current status (${inspection.status}).`,
        );
      }

      // --- CACHE THE RESULT ---
      try {
        if (await this.redisService.isHealthy()) {
          await this.redisService.set(
            cacheKey,
            JSON.stringify(inspection),
            300,
          ); // 5 min TTL
        }
      } catch (error) {
        this.logger.warn(
          `[findOne] Failed to cache result: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      return inspection as Inspection;
    } catch (error: unknown) {
      // Use unknown
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Inspection with ID "${id}" not found.`);
      }
      if (
        error instanceof ForbiddenException ||
        (error as any).status === 403 ||
        (error as any).name === 'ForbiddenException'
      ) {
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
   * Finds a single inspection by vehicle plate number (case-insensitive, space-agnostic).
   * This endpoint is publicly accessible and does not require role-based filtering.
   *
   * @param {string} vehiclePlateNumber - The vehicle plate number to search for.
   * @returns {Promise<Inspection | null>} The found inspection record or null if not found.
   */
  async findByVehiclePlateNumber(
    vehiclePlateNumber: string,
  ): Promise<any | null> {
    this.logger.log(
      `Searching for inspection by vehicle plate number: ${vehiclePlateNumber}`,
    );

    // --- CACHING LOGIC START ---
    const plateNormalized = vehiclePlateNumber.toLowerCase().replace(/\s/g, '');
    const version =
      (await this.redisService.get('inspections:list_version')) || '0';
    const cacheKey = `inspections:search:plate:v${version}:${plateNormalized}`;

    try {
      const cachedResult = await this.redisService.get(cacheKey);
      if (cachedResult) {
        this.logger.log(
          `[findByVehiclePlateNumber] Returning cached result for key: ${cacheKey}`,
        );
        return JSON.parse(cachedResult);
      }
    } catch (error) {
      this.logger.warn(
        `[findByVehiclePlateNumber] Failed to retrieve from cache: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    // --- CACHING LOGIC END ---

    try {
      // Single raw query: select all needed fields directly — eliminates the second findUnique round-trip.
      type InspectionRow = {
        id: string;
        pretty_id: string | null;
        vehiclePlateNumber: string | null;
        inspectionDate: Date | null;
        status: string;
        identityDetails: unknown;
        vehicleData: unknown;
        createdAt: Date;
        updatedAt: Date;
        urlPdf: string | null;
        blockchainTxHash: string | null;
      };

      const rows = await this.prisma.$queryRaw<InspectionRow[]>`
        SELECT
          id,
          pretty_id,
          "vehiclePlateNumber",
          "inspectionDate",
          status,
          "identityDetails",
          "vehicleData",
          "createdAt",
          "updatedAt",
          "urlPdf",
          "blockchainTxHash"
        FROM "inspections"
        WHERE lower(replace("vehiclePlateNumber", ' ', '')) = lower(replace(${vehiclePlateNumber}, ' ', ''))
        LIMIT 1;
      `;

      if (rows.length === 0) {
        this.logger.log(
          `No inspection found for plate number: ${vehiclePlateNumber}`,
        );
        return null;
      }

      const inspection = rows[0] as (typeof rows)[0] & {
        status: import('@prisma/client').InspectionStatus;
      };

      this.logger.log(
        `Found inspection ID: ${inspection?.id} for plate number: ${vehiclePlateNumber}`,
      );

      // --- CACHE THE RESULT ---
      if (inspection) {
        try {
          await this.redisService.set(
            cacheKey,
            JSON.stringify(inspection),
            300,
          );
        } catch (error) {
          this.logger.warn(
            `[findByVehiclePlateNumber] Failed to cache result: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

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
   * Sanitizes a keyword for use with PostgreSQL to_tsquery.
   * Converts multi-word input to AND logic (e.g., "Toyota Avanza" -> "Toyota & Avanza")
   * and handles special characters.
   *
   * @param {string} keyword - Raw user input keyword.
   * @returns {string} Sanitized keyword suitable for to_tsquery.
   */
  private sanitizeForTsquery(keyword: string): string {
    const cleaned = keyword
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');

    if (!cleaned) {
      return '';
    }

    const words = cleaned.split(' ');
    if (words.length === 1) {
      return words[0];
    }

    return words.join(' & ');
  }

  /**
   * Finds inspections matching a keyword across multiple fields using PostgreSQL
   * full-text search (tsvector/tsquery) and trigram similarity.
   *
   * @param {string} keyword - The keyword to search for.
   * @param {number} page - The page number (1-based).
   * @param {number} pageSize - The number of items per page.
   * @returns {Promise<{ data: any[], meta: { total: number, page: number, pageSize: number, totalPages: number } }>} A paginated list of found inspection records.
   */
  async searchByKeyword(
    keyword: string,
    page: number = 1,
    pageSize: number = 10,
  ): Promise<{
    data: any[];
    meta: { total: number; page: number; pageSize: number; totalPages: number };
  }> {
    this.logger.log(
      `Searching for inspections with keyword: ${keyword}, page: ${page}, pageSize: ${pageSize}`,
    );

    // If the keyword is empty, return an empty array to avoid scanning the entire table.
    if (!keyword || keyword.trim() === '') {
      return {
        data: [],
        meta: { total: 0, page, pageSize, totalPages: 0 },
      };
    }

    const skip = (page - 1) * pageSize;

    // --- CACHING LOGIC START ---
    const cacheKeyHash = crypto
      .createHash('md5')
      .update(JSON.stringify({ keyword, page, pageSize }))
      .digest('hex');
    const version =
      (await this.redisService.get('inspections:list_version')) || '0';
    const cacheKey = `inspections:search:keyword:v${version}:${cacheKeyHash}`;

    try {
      const cachedResult = await this.redisService.get(cacheKey);
      if (cachedResult) {
        this.logger.log(
          `[searchByKeyword] Returning cached result for key: ${cacheKey}`,
        );
        return JSON.parse(cachedResult);
      }
    } catch (error) {
      this.logger.warn(
        `[searchByKeyword] Failed to retrieve from cache: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    // --- CACHING LOGIC END ---

    try {
      const sanitizedKeyword = this.sanitizeForTsquery(keyword);

      const countQuery = `
        SELECT COUNT(*) as total
        FROM inspections i
        WHERE
          i."pretty_id" % $1
          OR to_tsvector('english',
            COALESCE(i."vehiclePlateNumber", '') || ' ' ||
            COALESCE(i."vehicleData"->>'merekKendaraan', '') || ' ' ||
            COALESCE(i."vehicleData"->>'tipeKendaraan', '') || ' ' ||
            COALESCE(i."identityDetails"->>'namaCustomer', '') || ' ' ||
            COALESCE(i."identityDetails"->>'namaInspektor', '')
          ) @@ to_tsquery('english', $2)
      `;

      const countResult = await this.prisma.$queryRawUnsafe<{ total: bigint }[]>(
        countQuery,
        keyword,
        sanitizedKeyword,
      );
      const total = Number(countResult[0]?.total || 0);

      if (total === 0) {
        const result = {
          data: [],
          meta: { total: 0, page, pageSize, totalPages: 0 },
        };

        try {
          await this.redisService.set(cacheKey, JSON.stringify(result), 300);
        } catch (error) {
          this.logger.warn(
            `[searchByKeyword] Failed to cache empty result: ${error instanceof Error ? error.message : String(error)}`,
          );
        }

        return result;
      }

      const dataQuery = `
        SELECT 
          i.id,
          i.pretty_id as "pretty_id",
          i."vehiclePlateNumber" as "vehiclePlateNumber",
          i."inspectionDate" as "inspectionDate",
          i.status,
          i."identityDetails" as "identityDetails",
          i."vehicleData" as "vehicleData",
          i."createdAt" as "createdAt",
          i."updatedAt" as "updatedAt",
          i."urlPdf" as "urlPdf",
          i."blockchainTxHash" as "blockchainTxHash"
        FROM inspections i
        WHERE
          i."pretty_id" % $1
          OR to_tsvector('english',
            COALESCE(i."vehiclePlateNumber", '') || ' ' ||
            COALESCE(i."vehicleData"->>'merekKendaraan', '') || ' ' ||
            COALESCE(i."vehicleData"->>'tipeKendaraan', '') || ' ' ||
            COALESCE(i."identityDetails"->>'namaCustomer', '') || ' ' ||
            COALESCE(i."identityDetails"->>'namaInspektor', '')
          ) @@ to_tsquery('english', $2)
        ORDER BY i."createdAt" DESC
        LIMIT $3 OFFSET $4
      `;

      const inspections = await this.prisma.$queryRawUnsafe<any[]>(
        dataQuery,
        keyword,
        sanitizedKeyword,
        pageSize,
        skip,
      );

      const totalPages = Math.ceil(total / pageSize);
      const result = {
        data: inspections,
        meta: {
          total,
          page,
          pageSize,
          totalPages,
        },
      };

      // --- CACHE THE RESULT ---
      try {
        await this.redisService.set(cacheKey, JSON.stringify(result), 300);
      } catch (error) {
        this.logger.warn(
          `[searchByKeyword] Failed to cache result: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      return result;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'An unknown error occurred';
      const errorStack =
        error instanceof Error ? error.stack : 'No stack trace available';
      this.logger.error(
        `Failed to search inspections by keyword "${keyword}": ${errorMessage}`,
        errorStack,
      );
      throw new InternalServerErrorException(
        'Could not search inspection data.',
      );
    }
  }

  /**
   * Retrieves the 5 most recent inspections with status ARCHIVED,
   * including one photo with the label "Tampak Depan", vehiclePlateNumber,
   * vehicleData.merekKendaraan, and vehicleData.tipeKendaraan.
   *
   * @returns {Promise<Array<Inspection & { photos: Photo[] }>>} An array of inspection records
   *          with the required photo and vehicle data.
   */
  async findLatestArchivedInspections(): Promise<
    Array<Inspection & { photos: Photo[] }>
  > {
    this.logger.log(
      'Retrieving 5 latest ARCHIVED inspections with "Tampak Depan" photo.',
    );

    try {
      const inspections = await this.prisma.inspection.findMany({
        where: {
          status: InspectionStatus.ARCHIVED,
          photos: {
            some: {
              label: 'Tampak Depan',
            },
          },
        },
        orderBy: {
          archivedAt: 'desc', // Order by archived date to get the latest
        },
        take: 5, // Limit to 5 inspections
        include: {
          photos: {
            where: {
              label: 'Tampak Depan', // Only include the "Tampak Depan" photo
            },
            take: 1, // Ensure only one photo is returned if multiple "Tampak Depan" exist (shouldn't happen if data is clean)
          },
        },
      });

      // Filter out any inspections that somehow ended up without a 'Tampak Depan' photo
      // (though the 'where' clause above should prevent this)
      const filteredInspections = inspections.filter(
        (inspection) => inspection.photos.length > 0,
      );

      this.logger.log(
        `Found ${filteredInspections.length} latest ARCHIVED inspections.`,
      );
      return filteredInspections;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'An unknown error occurred';
      const errorStack =
        error instanceof Error ? error.stack : 'No stack trace available';
      this.logger.error(
        `Failed to retrieve latest archived inspections: ${errorMessage}`,
        errorStack,
      );
      throw new InternalServerErrorException(
        'Could not retrieve latest archived inspection data.',
      );
    }
  }
}
