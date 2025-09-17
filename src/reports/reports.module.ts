/*
 * --------------------------------------------------------------------------
 * File: reports.module.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: NestJS module bundling report-related controller and service.
 * Wires Prisma, Credits, and Common modules required for report features.
 * --------------------------------------------------------------------------
 */

import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CreditsModule } from '../credits/credits.module';
import { CommonModule } from '../common/common.module';

/**
 * @module ReportsModule
 * @description Provides report endpoints and supporting services.
 */
@Module({
  imports: [PrismaModule, CreditsModule, CommonModule],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
