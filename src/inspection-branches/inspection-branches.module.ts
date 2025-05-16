/*
 * --------------------------------------------------------------------------
 * File: inspection-branches.module.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: NestJS module responsible for managing inspection branches.
 * Imports necessary controllers and services for inspection branch operations.
 * Declares the InspectionBranchesController to handle routes.
 * Provides the InspectionBranchesService for business logic.
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
