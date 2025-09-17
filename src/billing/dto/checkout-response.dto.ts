/*
 * --------------------------------------------------------------------------
 * File: dto/checkout-response.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: DTO representing billing checkout response including
 * internal purchase and external invoice identifiers and payment URL.
 * --------------------------------------------------------------------------
 */

import { ApiProperty } from '@nestjs/swagger';

/**
 * @class CheckoutResponseDto
 * @description Response returned after creating a checkout/invoice.
 */
export class CheckoutResponseDto {
  @ApiProperty({ description: 'Internal purchase ID' })
  purchaseId!: string;

  @ApiProperty({ description: 'Xendit invoice id' })
  extInvoiceId!: string;

  @ApiProperty({ description: 'Redirect URL to pay invoice' })
  paymentUrl!: string;
}
