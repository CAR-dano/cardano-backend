/*
 * --------------------------------------------------------------------------
 * File: inspections.module.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: NestJS module responsible for managing inspection-related features.
 * Imports necessary modules like PrismaModule (for database access), PhotosModule (for photo handling),
 * and BlockchainModule (for blockchain interactions).
 * Declares the InspectionsController to handle routes.
 * Provides the InspectionsService for business logic.
 * --------------------------------------------------------------------------
 */

import { Module } from '@nestjs/common';
import { InspectionsService } from './inspections.service';
import { InspectionsController } from './inspections.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { PhotosModule } from '../photos/photos.module'; // Keep existing
import { BlockchainModule } from '../blockchain/blockchain.module'; // Keep existing
import { ConfigModule } from '@nestjs/config'; // Add ConfigModule

// New Modules to import
import { PdfModule } from '../pdf/pdf.module';
import { SequenceModule } from '../sequences/sequences.module';
import { InspectionChangeLogModule } from '../inspection-change-log/inspection-change-log.module';
import { CsvExportModule } from '../export/csv-export.module';

/**
 * NestJS module for inspection-related features.
 */
@Module({
  imports: [
    PrismaModule,
    ConfigModule, // Ensure ConfigModule is imported as InspectionsService uses ConfigService
    PhotosModule, // Keep existing
    BlockchainModule, // Keep existing

    // Add the new modules
    PdfModule,
    SequenceModule,
    InspectionChangeLogModule, // This provides ChangeLogProcessorService
    CsvExportModule,
  ],
  controllers: [InspectionsController],
  providers: [InspectionsService],
  exports: [InspectionsService], // Export InspectionsService if it's used by other modules
})
export class InspectionsModule {}
