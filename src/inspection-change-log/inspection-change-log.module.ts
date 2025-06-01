/*
 * --------------------------------------------------------------------------
 * File: inspection-change-log.module.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: NestJS module for managing inspection change logs.
 * Imports necessary modules like PrismaModule for database access.
 * Declares the InspectionChangeLogController to handle routes.
 * Provides and exports the InspectionChangeLogService.
 * --------------------------------------------------------------------------
 */

import { Module } from '@nestjs/common';
import { InspectionChangeLogService } from './inspection-change-log.service';
import { ChangeLogProcessorService } from './change-log-processor.service'; // New service
import { InspectionChangeLogController } from './inspection-change-log.controller';
import { PrismaModule } from '../prisma/prisma.module';
// Import other necessary modules like UserModule if needed for 'changedByUserId' validation/context

@Module({
  imports: [PrismaModule], // Ensure PrismaModule is imported
  controllers: [InspectionChangeLogController], // If you have a controller
  providers: [
    InspectionChangeLogService, // Keep existing service
    ChangeLogProcessorService,  // Add new service
  ],
  exports: [
    InspectionChangeLogService, // Keep existing export
    ChangeLogProcessorService,   // Export new service
  ],
})
export class InspectionChangeLogModule {}
