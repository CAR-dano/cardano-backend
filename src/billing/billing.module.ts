/*
 * --------------------------------------------------------------------------
 * File: billing.module.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: NestJS module wiring billing controller, service and
 * Xendit payment integration.
 * --------------------------------------------------------------------------
 */

import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { XenditService } from './payments/xendit.service';

/**
 * @module BillingModule
 * @description Provides billing endpoints and payment integration.
 */
@Module({
  imports: [PrismaModule],
  controllers: [BillingController],
  providers: [BillingService, XenditService],
})
export class BillingModule {}
