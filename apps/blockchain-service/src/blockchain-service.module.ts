import { Module } from '@nestjs/common';
import { BlockchainServiceController } from './blockchain-service.controller';
import { BlockchainServiceService } from './blockchain-service.service';

@Module({
  imports: [],
  controllers: [BlockchainServiceController],
  providers: [BlockchainServiceService],
})
export class BlockchainServiceModule {}
