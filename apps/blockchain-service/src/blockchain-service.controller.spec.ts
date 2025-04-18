import { Test, TestingModule } from '@nestjs/testing';
import { BlockchainServiceController } from './blockchain-service.controller';
import { BlockchainServiceService } from './blockchain-service.service';

describe('BlockchainServiceController', () => {
  let blockchainServiceController: BlockchainServiceController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [BlockchainServiceController],
      providers: [BlockchainServiceService],
    }).compile();

    blockchainServiceController = app.get<BlockchainServiceController>(BlockchainServiceController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(blockchainServiceController.getHello()).toBe('Hello World!');
    });
  });
});
