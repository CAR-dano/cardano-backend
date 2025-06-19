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
// NestJS libraries
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// Local application files
import { BlockchainController } from './blockchain.controller';
import { BlockchainService } from './blockchain.service';

@Module({
  imports: [ConfigModule], // Import ConfigModule to use ConfigService
  providers: [BlockchainService],
  exports: [BlockchainService],
  controllers: [BlockchainController], // Export service to be used by other modules (e.g., InspectionsService)
})
/**
 * NestJS module for blockchain-related functionalities.
 * Configures and provides the BlockchainService and BlockchainController.
 */
export class BlockchainModule {}
