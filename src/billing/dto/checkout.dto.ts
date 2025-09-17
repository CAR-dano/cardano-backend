/*
 * --------------------------------------------------------------------------
 * File: dto/checkout.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: DTOs for initiating a billing checkout, including the
 * supported gateway enum.
 * --------------------------------------------------------------------------
 */

import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export enum BillingGateway {
  XENDIT = 'XENDIT',
}

/**
 * @class CheckoutDto
 * @description Request payload for creating a checkout/invoice.
 */
export class CheckoutDto {
  @IsString()
  @IsNotEmpty()
  packageId!: string;

  @IsEnum(BillingGateway)
  gateway!: BillingGateway;
}
