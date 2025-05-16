/*
 * --------------------------------------------------------------------------
 * File: inspection-change-log.module.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: NestJS module for managing inspection change logs.
 * Imports necessary modules like PrismaModule for database access.
 * Declares the InspectionChangeLogController to handle routes.
 * Provides the InspectionChangeLogService for business logic.
 * Exports InspectionChangeLogService if needed by other modules.
 * --------------------------------------------------------------------------
 */

import { Module } from '@nestjs/common';
import { InspectionChangeLogService } from './inspection-change-log.service';
import { InspectionChangeLogController } from './inspection-change-log.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [InspectionChangeLogController],
  providers: [InspectionChangeLogService],
  exports: [InspectionChangeLogService], // Export if needed by other modules
})
export class InspectionChangeLogModule {}
