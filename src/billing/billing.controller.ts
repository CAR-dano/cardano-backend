/*
 * --------------------------------------------------------------------------
 * File: billing.controller.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: NestJS controller for billing endpoints.
 * Provides endpoints to list active credit packages, create checkout
 * (Xendit invoice) for purchasing credits, and handle Xendit webhooks.
 * --------------------------------------------------------------------------
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus,
  Param,
  Query,
} from '@nestjs/common';
import { BillingService } from './billing.service';
import { CheckoutDto, BillingGateway } from './dto/checkout.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags, ApiCreatedResponse, ApiBadRequestResponse, ApiInternalServerErrorResponse, ApiOkResponse } from '@nestjs/swagger';
import { ApiAuthErrors, ApiStandardErrors } from '../common/decorators/api-standard-errors.decorator';
import { HttpErrorResponseDto } from '../common/dto/http-error-response.dto';
import { CheckoutResponseDto } from './dto/checkout-response.dto';
import { WebhookEventsService } from './webhook-events.service';
import { Role } from '@prisma/client';
import { ApiParam, ApiQuery } from '@nestjs/swagger';
import { PurchaseItemResponseDto, PurchaseListResponseDto } from './dto/purchase-response.dto';

/**
 * @class BillingController
 * @description Controller exposing billing operations (packages, checkout, webhook).
 */
@ApiTags('Billing')
@Controller('billing')
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly config: ConfigService,
    private readonly webhookEvents: WebhookEventsService,
  ) {}

  /**
   * Lists all active credit packages available for purchase.
   * Public endpoint; returns list of packages.
   */
  @Get('packages')
  @ApiOperation({ summary: 'List active credit packages' })
  @ApiOkResponse({ description: 'Packages list' })
  @ApiStandardErrors({ unauthorized: false, forbidden: false })
  async listPackages() {
    const packagesList = await this.billing.listPackages();
    return { packages: packagesList };
  }

  /**
   * Creates a checkout session (Xendit invoice) for a selected credit package.
   * Requires authentication; currently supports Xendit gateway only.
   *
   * @param dto Checkout input specifying package and gateway
   * @param userId Authenticated user ID
   * @returns CheckoutResponseDto containing purchaseId, extInvoiceId, and paymentUrl
   */
  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JwtAuthGuard')
  @ApiOperation({ summary: 'Create checkout (Xendit invoice) for a credit package' })
  @ApiBody({ type: CheckoutDto })
  @ApiCreatedResponse({ description: 'Checkout created; returns payment URL', type: CheckoutResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed or bad payload.', type: HttpErrorResponseDto })
  @ApiAuthErrors()
  async checkout(
    @Body() dto: CheckoutDto,
    @GetUser('id') userId: string,
  ) {
    if (dto.gateway !== BillingGateway.XENDIT) {
      throw new Error('Only XENDIT gateway is supported');
    }
    const result = await this.billing.createCheckout(userId, dto.packageId);
    return result as CheckoutResponseDto;
  }

  /**
   * Handles Xendit webhooks. Validates a shared callback token and updates purchase status
   * when invoice transitions to PAID/SETTLED. Idempotent by design.
   *
   * @param body Webhook payload
   * @param callbackToken Shared secret for validation
   * @returns Acknowledgement object
   */
  @Post('webhook/xendit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xendit webhook handler (idempotent)' })
  @ApiOkResponse({ description: 'Webhook processed' })
  @ApiStandardErrors({ unauthorized: false, forbidden: false })
  async xenditWebhook(
    @Body() body: any,
    @Headers('x-callback-token') callbackToken: string,
  ) {
    const expected = this.config.get<string>('XENDIT_CALLBACK_TOKEN');
    if (!expected || callbackToken !== expected) {
      // Intentionally reply 403 (but do not leak whether expected is set)
      return { ok: false };
    }
    // Handle various payload shapes
    const data = body?.data || body || {};
    const invoiceId = data.id || body?.id;
    const status = (data.status || body?.status || '').toUpperCase();
    if (!invoiceId) return { ok: true };

    // Build persistent idempotency key
    const eventType: string | undefined = data.event || body?.event || undefined;
    const timeKey = data.updated || body?.updated || data.paid_at || body?.paid_at || '';
    const eventKey = ['XENDIT', invoiceId, (eventType || status).toUpperCase(), timeKey].filter(Boolean).join(':');

    // Record or short-circuit on duplicates
    let rec: { isDuplicate: boolean; id?: string };
    try {
      rec = await this.webhookEvents.recordNewOrDuplicate({
        dedupeKey: eventKey,
        gateway: 'XENDIT',
        extInvoiceId: invoiceId,
        eventType: eventType || `INVOICE_${status}`,
        payload: body,
        headers: undefined,
        payloadHash: undefined,
      });
    } catch (_e) {
      // If DB is not ready, proceed but still rely on business idempotency
      rec = { isDuplicate: false };
    }
    if (rec.isDuplicate) return { ok: true, duplicate: true };

    if (status === 'PAID' || status === 'SETTLED') {
      try {
        await this.billing.markPaidByExtInvoiceId(invoiceId);
        if (rec.id) await this.webhookEvents.markProcessed(rec.id, 'SUCCESS');
      } catch (err: any) {
        if (rec.id) await this.webhookEvents.markError(rec.id, String(err?.message ?? err));
        // Reply OK to avoid excessive retries if purchase update is already applied
        return { ok: true, error: true };
      }
    } else if (status === 'EXPIRED') {
      try {
        await this.billing.markExpiredByExtInvoiceId(invoiceId);
        if (rec.id) await this.webhookEvents.markProcessed(rec.id, 'SUCCESS');
      } catch (err: any) {
        if (rec.id) await this.webhookEvents.markError(rec.id, String(err?.message ?? err));
        return { ok: true, error: true };
      }
    } else if (status === 'FAILED') {
      try {
        await this.billing.markFailedByExtInvoiceId(invoiceId);
        if (rec.id) await this.webhookEvents.markProcessed(rec.id, 'SUCCESS');
      } catch (err: any) {
        if (rec.id) await this.webhookEvents.markError(rec.id, String(err?.message ?? err));
        return { ok: true, error: true };
      }
    }
    return { ok: true };
  }

  /**
   * Returns a single purchase (with package info). Non-admins can only fetch their own.
   */
  @Get('purchases/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JwtAuthGuard')
  @ApiOperation({ summary: 'Get purchase detail (current user or admin)' })
  @ApiParam({ name: 'id', description: 'Purchase ID' })
  @ApiOkResponse({ description: 'Purchase found', type: PurchaseItemResponseDto })
  @ApiAuthErrors()
  async getPurchase(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @GetUser('role') role: Role,
  ) {
    const p = await this.billing.getPurchaseById(id, userId, role);
    return new PurchaseItemResponseDto(p);
  }

  /**
   * Lists recent purchases for the current user (most recent first).
   */
  @Get('purchases')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JwtAuthGuard')
  @ApiOperation({ summary: 'List recent purchases for current user' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max items (1-100), default 10' })
  @ApiOkResponse({ description: 'Purchases list', type: PurchaseListResponseDto })
  @ApiAuthErrors()
  async listPurchases(
    @Query('limit') limit: string,
    @GetUser('id') userId: string,
  ) {
    const list = await this.billing.listMyPurchases(userId, Number(limit));
    return new PurchaseListResponseDto(list);
  }
}
