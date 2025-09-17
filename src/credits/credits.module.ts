/*
 * --------------------------------------------------------------------------
 * File: credits.module.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: NestJS module exposing the CreditsService which manages
 * user credit balance consumption records.
 * --------------------------------------------------------------------------
 */

import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CreditsService } from './credits.service';

/**
 * @module CreditsModule
 * @description Provides CreditsService for charging and checking usage.
 */
@Module({
  imports: [PrismaModule],
  providers: [CreditsService],
  exports: [CreditsService],
})
export class CreditsModule {}
