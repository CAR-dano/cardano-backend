/**
 * @fileoverview Module definition for blockchain-related functionalities.
 * Provides BlockchainService and imports ConfigModule for API keys.
 */
import { Module } from '@nestjs/common';
import { BlockchainController } from './blockchain.controller';
import { ConfigModule } from '@nestjs/config'; // Needed to inject ConfigService
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
