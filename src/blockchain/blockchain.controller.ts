/*
 * --------------------------------------------------------------------------
 * File: blockchain.controller.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: NestJS controller for handling blockchain-related operations.
 * Provides endpoints for retrieving transaction metadata and NFT data from the Cardano blockchain.
 * Utilizes the BlockchainService to interact with blockchain data providers.
 * --------------------------------------------------------------------------
 */

// NestJS common modules
import { Controller, Get, Param, Logger, HttpStatus } from '@nestjs/common';

// Local services
import { BlockchainService } from './blockchain.service';

// DTOs (Data Transfer Objects)
import { TransactionMetadataResponseDto } from './dto/transaction-metadata-response.dto';
import { NftDataResponseDto } from './dto/nft-data-response.dto';

// Swagger API documentation
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';

@ApiTags('Blockchain Operations')
@Controller('blockchain') // Base path: /api/v1/blockchain
export class BlockchainController {
  private readonly logger = new Logger(BlockchainController.name);

  constructor(private readonly blockchainService: BlockchainService) {}

  /**
   * Retrieves transaction metadata from Blockfrost using the transaction hash.
   *
   * @param txHash The hash of the Cardano transaction.
   * @returns A promise that resolves to an array of TransactionMetadataResponseDto.
   * @throws BadRequestException if the transaction hash is missing.
   * @throws NotFoundException if the transaction or metadata is not found.
   * @throws InternalServerErrorException for Blockfrost API or other errors.
   */
  @Get('metadata/tx/:txHash')
  @ApiOperation({
    summary: 'Get Transaction Metadata by Hash',
    description:
      'Retrieves metadata associated with a specific Cardano transaction hash from Blockfrost.',
  })
  @ApiParam({
    name: 'txHash',
    description: 'Cardano transaction hash',
    type: String,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Metadata retrieved successfully.',
    type: [TransactionMetadataResponseDto],
  }) // Returns array
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Bad Request (Missing txHash).',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Transaction or metadata not found.',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Failed to fetch metadata from Blockfrost.',
  })
  async getTransactionMetadata(
    @Param('txHash') txHash: string,
  ): Promise<TransactionMetadataResponseDto[]> {
    this.logger.log(`Request received to get metadata for TxHash: ${txHash}`);
    return this.blockchainService.getTransactionMetadata(txHash);
  }

  /**
   * Retrieves asset data (including on-chain metadata if available) from Blockfrost using the asset ID.
   *
   * @param assetId The full asset ID (PolicyID + HexAssetName).
   * @returns A promise that resolves to an NftDataResponseDto.
   * @throws BadRequestException if the asset ID is missing.
   * @throws NotFoundException if the asset is not found.
   * @throws InternalServerErrorException for Blockfrost API or other errors.
   */
  @Get('nft/:assetId')
  @ApiOperation({
    summary: 'Get NFT Data by Asset ID',
    description:
      'Retrieves details and on-chain metadata for a specific Cardano asset (NFT) from Blockfrost.',
  })
  @ApiParam({
    name: 'assetId',
    description: 'Full Cardano Asset ID (PolicyID + HexAssetName)',
    type: String,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Asset data retrieved successfully.',
    type: NftDataResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Bad Request (Missing assetId).',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Asset not found.',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Failed to fetch asset data from Blockfrost.',
  })
  async getNftData(
    @Param('assetId') assetId: string,
  ): Promise<NftDataResponseDto> {
    this.logger.log(`Request received to get data for Asset ID: ${assetId}`);
    return this.blockchainService.getNftData(assetId);
  }
}
