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
import { NotFoundException, InternalServerErrorException } from '@nestjs/common';

const mockBlockchainService = {
  getTransactionMetadata: jest.fn(),
  getNftData: jest.fn(),
};

describe('BlockchainController', () => {
  let controller: BlockchainController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BlockchainController],
      providers: [
        {
          provide: BlockchainService,
          useValue: mockBlockchainService,
        },
      ],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<BlockchainController>(BlockchainController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // -------------------------------------------------------------------------
  describe('getTransactionMetadata', () => {
    it('should return transaction metadata for a valid txHash', async () => {
      const txHash = 'abc123hash';
      const mockMetadata = [{ label: '674', json_metadata: { msg: ['Test NFT'] } }];
      mockBlockchainService.getTransactionMetadata.mockResolvedValue(mockMetadata);

      const result = await controller.getTransactionMetadata(txHash);

      expect(mockBlockchainService.getTransactionMetadata).toHaveBeenCalledWith(txHash);
      expect(result).toEqual(mockMetadata);
    });

    it('should throw NotFoundException when transaction not found', async () => {
      mockBlockchainService.getTransactionMetadata.mockRejectedValue(
        new NotFoundException('Transaction not found'),
      );

      await expect(controller.getTransactionMetadata('bad-hash')).rejects.toThrow(NotFoundException);
    });

    it('should throw InternalServerErrorException on Blockfrost API error', async () => {
      mockBlockchainService.getTransactionMetadata.mockRejectedValue(
        new InternalServerErrorException('Blockfrost API error'),
      );

      await expect(controller.getTransactionMetadata('some-hash')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should return empty array when no metadata exists', async () => {
      mockBlockchainService.getTransactionMetadata.mockResolvedValue([]);

      const result = await controller.getTransactionMetadata('tx-no-metadata');

      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  describe('getNftData', () => {
    it('should return NFT data for a valid asset ID', async () => {
      const assetId = 'policy123assetname456';
      const mockNftData = {
        asset: assetId,
        policyId: 'policy123',
        assetName: 'assetname456',
        fingerprint: 'asset1abc',
        quantity: '1',
        onchainMetadata: { name: 'Test NFT' },
      };
      mockBlockchainService.getNftData.mockResolvedValue(mockNftData);

      const result = await controller.getNftData(assetId);

      expect(mockBlockchainService.getNftData).toHaveBeenCalledWith(assetId);
      expect(result).toEqual(mockNftData);
    });

    it('should throw NotFoundException when asset not found', async () => {
      mockBlockchainService.getNftData.mockRejectedValue(
        new NotFoundException('Asset not found'),
      );

      await expect(controller.getNftData('invalid-asset')).rejects.toThrow(NotFoundException);
    });

    it('should throw InternalServerErrorException on API failure', async () => {
      mockBlockchainService.getNftData.mockRejectedValue(
        new InternalServerErrorException('API failure'),
      );

      await expect(controller.getNftData('asset-id')).rejects.toThrow(InternalServerErrorException);
    });
  });
});
