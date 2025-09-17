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
import { Controller, Get, Param, HttpStatus, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

// Local services
import { BlockchainService } from './blockchain.service';

// DTOs (Data Transfer Objects)
import { TransactionMetadataResponseDto } from './dto/transaction-metadata-response.dto';
import { NftDataResponseDto } from './dto/nft-data-response.dto';

// Swagger API documentation
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { ApiStandardErrors } from '../common/decorators/api-standard-errors.decorator';
import { HttpErrorResponseDto } from '../common/dto/http-error-response.dto';
import { AppLogger } from '../logging/app-logger.service';

@ApiTags('Blockchain Operations')
@Controller('blockchain') // Base path: /api/v1/blockchain
export class BlockchainController {
  constructor(
    private readonly blockchainService: BlockchainService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(BlockchainController.name);
  }

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
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @UseGuards(ThrottlerGuard)
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
  @ApiOkResponse({
    description: 'Metadata retrieved successfully.',
    type: [TransactionMetadataResponseDto],
  })
  @ApiBadRequestResponse({
    description: 'Bad Request (Missing txHash).',
    type: HttpErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Transaction or metadata not found.',
    type: HttpErrorResponseDto,
  })
  @ApiStandardErrors({ unauthorized: false, forbidden: false })
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
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @UseGuards(ThrottlerGuard)
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
  @ApiOkResponse({
    description: 'Asset data retrieved successfully.',
    type: NftDataResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Bad Request (Missing assetId).',
    type: HttpErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Asset not found.',
    type: HttpErrorResponseDto,
  })
  @ApiStandardErrors({ unauthorized: false, forbidden: false })
  async getNftData(
    @Param('assetId') assetId: string,
  ): Promise<NftDataResponseDto> {
    this.logger.log(`Request received to get data for Asset ID: ${assetId}`);
    return this.blockchainService.getNftData(assetId);
  }
}
