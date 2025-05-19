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
import { PhotosService } from './photos.service';

@Module({
  controllers: [],
  providers: [PhotosService],
  exports: [PhotosService],
})
export class PhotosModule {}
