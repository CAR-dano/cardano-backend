/*
 * --------------------------------------------------------------------------
 * File: blockchain.controller.spec.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Unit tests for the BlockchainController.
 * Tests the basic functionality and definition of the controller.
 * --------------------------------------------------------------------------
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BlockchainController } from './blockchain.controller';
import { BlockchainService } from './blockchain.service';
import { ThrottlerGuard } from '@nestjs/throttler';

describe('BlockchainController', () => {
  let controller: BlockchainController;
  let service: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BlockchainController],
      providers: [
        {
          provide: BlockchainService,
          useValue: {
            getTransactionMetadata: jest.fn(),
            getNftData: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<BlockchainController>(BlockchainController);
    service = module.get<BlockchainService>(BlockchainService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
