/*
 * --------------------------------------------------------------------------
 * File: photos.module.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: NestJS module responsible for managing photo-related operations.
 * Imports the PhotosService.
 * Declares no controllers as photo operations are likely handled by other modules (e.g., InspectionsModule).
 * Provides and exports the PhotosService for use in other modules.
 * --------------------------------------------------------------------------
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BackblazeModule } from '../backblaze/backblaze.module';
import { MetricsModule } from '../metrics/metrics.module';
import { PhotosService } from './photos.service';

@Module({
  imports: [ConfigModule, BackblazeModule, MetricsModule],
  controllers: [],
  providers: [PhotosService],
  exports: [PhotosService],
})
export class PhotosModule {}
