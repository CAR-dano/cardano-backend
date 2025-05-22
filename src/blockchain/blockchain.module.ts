/*
 * --------------------------------------------------------------------------
 * File: blockchain.module.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: NestJS module for blockchain-related functionalities.
 * Imports ConfigModule for configuration access.
 * Declares BlockchainController and provides/exports BlockchainService.
 * --------------------------------------------------------------------------
 */
import { Module } from '@nestjs/common';
import { BlockchainController } from './blockchain.controller';
import { ConfigModule } from '@nestjs/config'; // Required to inject ConfigService
// Import Controller if you create one here
// import { BlockchainController } from './blockchain.controller';
import { BlockchainService } from './blockchain.service';

@Module({
  imports: [ConfigModule], // Import ConfigModule to use ConfigService
  // controllers: [BlockchainController], // Add controller if endpoints are defined here
  providers: [BlockchainService],
  exports: [BlockchainService],
  controllers: [BlockchainController], // Export service to be used by other modules (e.g., InspectionsService)
})
export class BlockchainModule {}
