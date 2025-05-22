/*
 * --------------------------------------------------------------------------
 * File: inspection-branches.module.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: NestJS module for the inspection branches feature.
 * Imports and provides the necessary controllers and services for managing
 * inspection branch cities.
 * --------------------------------------------------------------------------
 */

import { Module } from '@nestjs/common';
import { InspectionBranchesController } from './inspection-branches.controller';
import { InspectionBranchesService } from './inspection-branches.service';

@Module({
  controllers: [InspectionBranchesController],
  providers: [InspectionBranchesService],
})
export class InspectionBranchesModule {}
