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
import { PhotosModule } from '../photos/photos.module';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { IpfsModule } from '../ipfs/ipfs.module';

/**
 * NestJS module for inspection-related features.
 */
@Module({
  imports: [PrismaModule, PhotosModule, BlockchainModule, IpfsModule],
  controllers: [InspectionsController],
  providers: [InspectionsService],
})
export class InspectionsModule {}
