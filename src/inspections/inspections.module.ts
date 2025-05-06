/**
 * @fileoverview Module definition for inspection-related features.
 * Imports PrismaModule for database access, declares InspectionsController,
 * provides InspectionsService, and potentially MulterModule if needed globally (optional).
 */

import { Module } from '@nestjs/common';
import { InspectionsService } from './inspections.service';
import { InspectionsController } from './inspections.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { PhotosModule } from '../photos/photos.module';
import { BlockchainModule } from '../blockchain/blockchain.module';

@Module({
  imports: [PrismaModule, PhotosModule, BlockchainModule],
  controllers: [InspectionsController],
  providers: [InspectionsService],
})
export class InspectionsModule {}
