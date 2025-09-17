/*
 * --------------------------------------------------------------------------
 * File: common.module.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Global NestJS module providing shared services used across
 * the application (e.g., BackblazeService for object storage access).
 * --------------------------------------------------------------------------
 */

import { Global, Module } from '@nestjs/common';
import { BackblazeService } from './services/backblaze.service';

/**
 * @module CommonModule
 * @description Exposes shared infrastructure services globally.
 */
@Global()
@Module({
  providers: [BackblazeService],
  exports: [BackblazeService],
})
export class CommonModule {}
