/*
 * --------------------------------------------------------------------------
 * File: public-api.controller.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: NestJS controller for publicly accessible API endpoints.
 * This controller handles requests related to public user data and inspection summaries.
 * It provides endpoints for listing inspectors, retrieving the latest archived inspections,
 * fetching a specific inspection by ID, and accessing inspection change logs.
 * Utilizes various services (UsersService, InspectionsService, PublicApiService)
 * and integrates with Swagger for API documentation.
 * --------------------------------------------------------------------------
 */

// NestJS core modules
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  Param,
  Query,
} from '@nestjs/common';

// Swagger documentation modules
import { ApiOperation, ApiParam, ApiResponse, ApiTags, ApiOkResponse, ApiBadRequestResponse, ApiNotFoundResponse, ApiInternalServerErrorResponse } from '@nestjs/swagger';
import { HttpErrorResponseDto } from '../common/dto/http-error-response.dto';
import { ApiStandardErrors } from '../common/decorators/api-standard-errors.decorator';

// Services
import { UsersService } from '../users/users.service';
import { InspectionsService } from 'src/inspections/inspections.service';
import { PublicApiService } from './public-api.service';

// DTOs (Data Transfer Objects)
import { UserResponseDto } from '../users/dto/user-response.dto';
import { LatestArchivedInspectionResponseDto } from 'src/inspections/dto/latest-archived-inspection-response.dto';
import { InspectionResponseDto } from 'src/inspections/dto/inspection-response.dto';
import { InspectionChangeLogResponseDto } from 'src/inspection-change-log/dto/inspection-change-log-response.dto';

// Prisma types
import { InspectionChangeLog } from '@prisma/client';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';
import { BackblazeService } from '../common/services/backblaze.service';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { AppLogger } from '../logging/app-logger.service';

/**
 * @class PublicApiController
 * @description Controller for public-facing API endpoints.
 * Handles requests for publicly accessible data such as inspector lists and inspection summaries.
 */
@ApiTags('Public API') // Tag for Swagger documentation, categorizing endpoints under 'Public API'
@SkipThrottle()
@Controller('public') // Base path for all routes defined in this controller
export class PublicApiController {
  // Logger instance for logging messages within this controller
  private readonly logger: AppLogger;

  // In-memory cache for deep health checks to keep /public/health fast
  private static deepCache: {
    updatedAt: number;
    storageCheck?: { ok?: boolean; latencyMs?: number; error?: string } | null;
    webhookCheck?:
      | {
          configured?: boolean;
          ok?: boolean;
          statusCode?: number;
          signatureDryRun?: boolean;
          dryRunSignature?: string;
          latencyMs?: number;
          error?: string;
        }
      | null;
    refreshing?: boolean;
  } = { updatedAt: 0, storageCheck: null, webhookCheck: null, refreshing: false };

  private static readonly DEEP_CACHE_TTL_MS = Number(
    process.env.HEALTH_DEEP_TTL_MS || 5000,
  );

  // Lightweight DB ping cache to avoid per-request DB roundtrips under load
  private static dbCache: {
    updatedAt: number;
    result?: { ok: boolean; latencyMs?: number; error?: string } | null;
    refreshing?: boolean;
  } = { updatedAt: 0, result: null, refreshing: false };

  private static readonly DB_CACHE_TTL_MS = Number(
    process.env.HEALTH_DB_TTL_MS || 5000,
  );

  /**
   * @constructor
   * @param usersService Service for user-related operations.
   * @param inspectionsService Service for inspection-related operations.
   * @param publicApiService Service for public API specific operations.
   */
  constructor(
    private readonly usersService: UsersService,
    private readonly inspectionsService: InspectionsService,
    private readonly publicApiService: PublicApiService,
    private readonly prisma: PrismaService,
    private readonly backblaze: BackblazeService,
    private readonly config: ConfigService,
    logger: AppLogger,
  ) {
    // Log controller initialization
    this.logger = logger;
    this.logger.setContext(PublicApiController.name);
    this.logger.log('PublicApiController initialized');
  }

  /**
   * Health check endpoint for public consumers.
   * Returns overall status and component checks (app, db, storage, webhook).
   */
  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Health status (Public)',
    description:
      'Returns status of application and dependencies: app uptime, database ping, object storage reachability, and optional payment webhook reachability with signature dry-run.',
  })
  @ApiOkResponse({ description: 'Health status' })
  @ApiStandardErrors({ unauthorized: false, forbidden: false })
  async getHealth(@Query('deep') deep?: string) {
    const startedAt = Date.now();
    const nowIso = new Date().toISOString();

    // DB ping (cached in basic mode)
    const wantDeep = String(deep).toLowerCase() === 'true';
    const refreshDb = async () => {
      if (PublicApiController.dbCache.refreshing) return;
      PublicApiController.dbCache.refreshing = true;
      const started = Date.now();
      try {
        const res: any = await this.prisma.$queryRaw`SELECT 1 as ok`;
        const ok = Array.isArray(res) && res.length > 0;
        PublicApiController.dbCache.result = {
          ok,
          latencyMs: Date.now() - started,
        };
      } catch (err: any) {
        this.logger.error(`Health DB check failed: ${err?.message ?? err}`);
        PublicApiController.dbCache.result = {
          ok: false,
          latencyMs: Date.now() - started,
          error: String(err?.message ?? err),
        };
      } finally {
        PublicApiController.dbCache.updatedAt = Date.now();
        PublicApiController.dbCache.refreshing = false;
      }
    };

    let dbCheck: any;
    const dbFresh =
      Date.now() - PublicApiController.dbCache.updatedAt <
      PublicApiController.DB_CACHE_TTL_MS;
    if (wantDeep) {
      await refreshDb();
      dbCheck = PublicApiController.dbCache.result;
    } else {
      dbCheck = PublicApiController.dbCache.result ?? { ok: true, note: 'db status unknown; using default OK' };
      if (!dbFresh) {
        // Trigger background refresh
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        refreshDb();
      }
    }

    // Deep checks (storage + webhook)

    const getCachedDeep = () => {
      return {
        storage: PublicApiController.deepCache.storageCheck ?? undefined,
        webhook: PublicApiController.deepCache.webhookCheck ?? undefined,
        cachedAt: PublicApiController.deepCache.updatedAt || undefined,
      };
    };

    const refreshDeep = async () => {
      if (PublicApiController.deepCache.refreshing) return;
      PublicApiController.deepCache.refreshing = true;
      const startedAll = Date.now();
      try {
        // Storage
        const sStarted = Date.now();
        const sRes = await this.backblaze
          .headBucket()
          .catch((err) => ({ ok: false, error: String(err) }));
        const storageCheck = { ...sRes, latencyMs: Date.now() - sStarted } as any;

        // Webhook (with tighter timeout)
        const wStarted = Date.now();
        const url = this.config.get<string>('PAYMENT_WEBHOOK_URL');
        const secret = this.config.get<string>('PAYMENT_WEBHOOK_SECRET');
        let webhookCheck: any;
        if (!url) {
          webhookCheck = { configured: false, ok: false, reason: 'PAYMENT_WEBHOOK_URL not set' };
        } else {
          const headers: Record<string, string> = { 'X-Health-Check': 'true' };
          let dryRunSignature: string | undefined;
          if (secret) {
            const payload = 'health-check';
            dryRunSignature = crypto
              .createHmac('sha256', secret)
              .update(payload)
              .digest('hex');
            headers['X-Signature'] = dryRunSignature;
          }
          const controller = new AbortController();
          const timeoutMs = 800; // tighter timeout than before
          const timeout = setTimeout(() => controller.abort(), timeoutMs);
          try {
            const resp = await fetch(url, {
              method: 'HEAD',
              headers,
              signal: controller.signal as any,
            });
            clearTimeout(timeout);
            webhookCheck = {
              configured: true,
              ok: resp.status < 400,
              statusCode: resp.status,
              signatureDryRun: Boolean(secret),
              dryRunSignature,
            };
          } catch (err: any) {
            clearTimeout(timeout);
            this.logger.warn(
              `Deep health webhook HEAD failed: ${String(err?.message ?? err)}`,
            );
            webhookCheck = {
              configured: Boolean(url),
              ok: false,
              error: String(err?.message ?? err),
              signatureDryRun: Boolean(secret),
              dryRunSignature,
            };
          }
          webhookCheck.latencyMs = Date.now() - wStarted;
        }

        PublicApiController.deepCache.storageCheck = storageCheck;
        PublicApiController.deepCache.webhookCheck = webhookCheck;
        PublicApiController.deepCache.updatedAt = Date.now();
      } catch (e) {
        this.logger.warn(`Deep health refresh failed: ${String(e)}`);
      } finally {
        PublicApiController.deepCache.refreshing = false;
        this.logger.debug(
          `Deep health refreshed in ${Date.now() - startedAll}ms`,
        );
      }
    };

    let storageCheck: any = undefined;
    let webhookCheck: any = undefined;

    if (wantDeep) {
      await refreshDeep();
      const cached = getCachedDeep();
      storageCheck = cached.storage;
      webhookCheck = cached.webhook;
    } else {
      // Basic mode: use cached deep checks if fresh, otherwise return last known and refresh in background
      const isFresh =
        Date.now() - PublicApiController.deepCache.updatedAt <
        PublicApiController.DEEP_CACHE_TTL_MS;
      const cached = getCachedDeep();
      storageCheck = cached.storage;
      webhookCheck = cached.webhook;
      if (!isFresh) {
        // Trigger background refresh without awaiting
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        refreshDeep();
      }
    }

    // Overall status: ok only if all mandatory checks pass
    const mandatoryOk = dbCheck.ok && (storageCheck?.ok !== false || !wantDeep);
    const overall = mandatoryOk ? 'ok' : 'degraded';

    return {
      status: overall,
      components: {
        app: {
          ok: true,
          timestamp: nowIso,
          uptimeSec: Math.round(process.uptime()),
          latencyMs: Date.now() - startedAt,
        },
        database: dbCheck,
        storage: storageCheck,
        paymentWebhook: webhookCheck,
        mode: wantDeep ? 'deep' : 'basic',
      },
    };
  }

  /**
   * Deep health endpoint that performs all external checks synchronously.
   * Useful for scheduled monitoring; not recommended for high-frequency pings.
   */
  @Get('deep-health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deep health status (includes storage/webhook checks)' })
  @ApiOkResponse({ description: 'Deep health status' })
  @ApiStandardErrors({ unauthorized: false, forbidden: false })
  async getDeepHealth() {
    return this.getHealth('true');
  }

  /**
   * Retrieves a list of all inspector users.
   * This endpoint is publicly accessible.
   *
   * @returns {Promise<UserResponseDto[]>} A promise that resolves to an array of UserResponseDto objects representing inspector users.
   */
  @Get('users/inspectors') // Defines the GET endpoint for retrieving all inspectors
  @ApiOperation({
    summary: 'Retrieve all inspector users (Public)',
    description:
      'Fetches a list of all user accounts specifically designated as inspectors. This endpoint is publicly accessible.',
  })
  @ApiOkResponse({ description: 'List of inspector users.', type: [UserResponseDto] })
  @ApiStandardErrors({ unauthorized: false, forbidden: false })
  async findAllInspectors(): Promise<UserResponseDto[]> {
    // Log the incoming public request
    this.logger.log(`Public request: findAllInspectors users`);
    // Fetch all inspector users from the UsersService
    const users = await this.usersService.findAllInspectors();
    // Map the retrieved user entities to UserResponseDto for safe public exposure
    return users.map((user) => new UserResponseDto(user));
  }

  /**
   * Retrieves the 5 most recent inspections with status ARCHIVED.
   * Includes specific details like one photo with the label "Front View",
   * vehicle plate number, vehicle brand, and vehicle type.
   * This endpoint is publicly accessible.
   *
   * @returns {Promise<LatestArchivedInspectionResponseDto[]>} An array of the latest archived inspection summaries.
   * @throws {InternalServerErrorException} If there is a data inconsistency or an internal server error during mapping.
   */
  @Get('latest-archived') // Defines the GET endpoint for retrieving latest archived inspections
  @HttpCode(HttpStatus.OK) // Sets the HTTP status code for successful responses to 200 OK
  @ApiOperation({
    summary: 'Retrieve 5 latest ARCHIVED inspections with specific details',
    description:
      'Retrieves the 5 most recent inspections with status ARCHIVED, including one photo with the label "Front View", vehicle plate number, vehicle brand, and vehicle type.',
  })
  @ApiOkResponse({ description: 'Array of the latest archived inspection summaries.', type: [LatestArchivedInspectionResponseDto] })
  @ApiStandardErrors({ unauthorized: false, forbidden: false })
  async getLatestArchivedInspections(): Promise<
    LatestArchivedInspectionResponseDto[]
  > {
    // Log the incoming request for latest archived inspections
    this.logger.log('[GET /public/latest-archived] Request received');
    // Fetch the latest archived inspections from the InspectionsService
    const inspections =
      await this.inspectionsService.findLatestArchivedInspections();

    // Map the results to the DTO, handling potential errors if the "Front View" photo is missing
    return inspections.map((inspection) => {
      try {
        return new LatestArchivedInspectionResponseDto(inspection);
      } catch (error: any) {
        // Explicitly type error as any to allow access to .message
        // Log the error if mapping fails for a specific inspection
        this.logger.error(
          `Failed to map inspection ${inspection.id} to DTO: ${(error as Error).message}`,
        );
        // Re-throw to indicate a critical data inconsistency for this specific inspection
        throw new InternalServerErrorException(
          `Data inconsistency for inspection ${inspection.id}: ${(error as Error).message}`,
        );
      }
    });
  }

  /**
   * Retrieves a specific inspection by its ID.
   * This endpoint applies role-based visibility rules.
   *
   * @param {string} id The UUID of the inspection to retrieve.
   * @returns {Promise<InspectionResponseDto>} A promise that resolves to the inspection record summary.
   * @throws {NotFoundException} If the inspection with the given ID is not found.
   */
  @Get('inspections/:id') // Defines the GET endpoint for retrieving a single inspection by ID
  @ApiOperation({
    summary: 'Retrieve a specific inspection by ID',
    description:
      'Retrieves a specific inspection by ID, applying role-based visibility rules.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'The UUID of the inspection to retrieve.',
  })
  @ApiOkResponse({ description: 'The inspection record summary.', type: InspectionResponseDto })
  @ApiStandardErrors({ unauthorized: false, forbidden: false })
  async findOne(@Param('id') id: string): Promise<InspectionResponseDto> {
    // Retrieve the inspection using the PublicApiService
    const inspection = await this.publicApiService.findOne(id);
    // Map the retrieved inspection entity to InspectionResponseDto
    return new InspectionResponseDto(inspection);
  }

  /**
   * Retrieves a specific inspection by its ID, excluding photos with sensitive document labels.
   * This endpoint is for public consumption where STNK/BPKB photos should not be visible.
   *
   * @param {string} id The UUID of the inspection to retrieve.
   * @returns {Promise<InspectionResponseDto>} A promise that resolves to the inspection record summary without sensitive documents.
   */
  @Get('inspections/:id/no-docs')
  @ApiOperation({
    summary: 'Retrieve an inspection by ID without sensitive documents',
    description:
      'Retrieves a specific inspection by ID, but excludes photos labeled as "STNK" or "BPKB" for public viewing.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'The UUID of the inspection to retrieve.',
  })
  @ApiOkResponse({ description: 'The inspection record summary without sensitive documents.', type: InspectionResponseDto })
  @ApiStandardErrors({ unauthorized: false, forbidden: false })
  async findOneWithoutDocuments(
    @Param('id') id: string,
  ): Promise<InspectionResponseDto> {
    const inspection = await this.publicApiService.findOneWithoutDocuments(id);
    return new InspectionResponseDto(inspection);
  }

  /**
   * Retrieves change logs for a specific inspection.
   * This endpoint is restricted to ADMIN and REVIEWER roles only.
   *
   * @param {string} inspectionId The ID of the inspection.
   * @returns {Promise<InspectionChangeLog[]>} A promise that resolves to an array of InspectionChangeLog objects.
   * @throws {UnauthorizedException} If the user is not authenticated.
   * @throws {ForbiddenException} If the user does not have the required role.
   * @throws {NotFoundException} If the inspection is not found.
   */
  @Get('inspections/:id/changelog') // Defines the GET endpoint for retrieving inspection change logs
  @ApiOperation({
    summary: 'Get inspection change log',
    description: 'Retrieves the change log entries for a specific inspection.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'The ID of the inspection',
  })
  @ApiOkResponse({ description: 'Successfully retrieved inspection change log.', type: [InspectionChangeLogResponseDto] })
  @ApiStandardErrors({ unauthorized: false, forbidden: false })
  async findChangesByInspectionId(
    @Param('id') inspectionId: string,
  ): Promise<InspectionChangeLog[]> {
    // Retrieve the change logs for the specified inspection ID using PublicApiService
    return this.publicApiService.findChangesByInspectionId(inspectionId);
  }
}
