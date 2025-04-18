import { Controller, Get } from '@nestjs/common';
import { BlockchainServiceService } from './blockchain-service.service';

@Controller()
export class BlockchainServiceController {
  constructor(private readonly blockchainServiceService: BlockchainServiceService) {}

  @Get()
  getHello(): string {
    return this.blockchainServiceService.getHello();
  }
}
