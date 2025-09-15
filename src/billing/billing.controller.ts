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

    if (status === 'PAID' || status === 'SETTLED') {
      await this.billing.markPaidByExtInvoiceId(invoiceId);
    }
    return { ok: true };
  }
}
