/*
 * --------------------------------------------------------------------------
 * File: credit-packages.module.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: NestJS module bundling admin endpoints and service for
 * managing credit packages.
 * --------------------------------------------------------------------------
 */

import { Module } from '@nestjs/common';
import { CreditPackagesController } from './credit-packages.controller';
import { CreditPackagesService } from './credit-packages.service';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * @module CreditPackagesModule
 * @description Provides admin CRUD for credit packages.
 */
@Module({
  imports: [PrismaModule],
  controllers: [CreditPackagesController],
  providers: [CreditPackagesService],
})
export class CreditPackagesModule {}
