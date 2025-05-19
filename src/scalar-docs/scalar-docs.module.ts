/*
 * --------------------------------------------------------------------------
 * File: scalar-docs.module.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: NestJS module for the Scalar API documentation.
 * Imports and provides the ScalarDocsController.
 * --------------------------------------------------------------------------
 */

import { Module } from '@nestjs/common';
import { ScalarDocsController } from './scalar-docs.controller';

@Module({
  controllers: [ScalarDocsController],
})
export class ScalarDocsModule {}
