/*
 * --------------------------------------------------------------------------
 * File: mint-response.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Data Transfer Object representing the response after a successful NFT minting request.
 * Contains the transaction hash and asset ID of the minted NFT.
 * --------------------------------------------------------------------------
 */
// Library imports
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for the response of a successful NFT minting operation.
 */
export class MintResponseDto {
  /**
   * The transaction hash of the minting process on Cardano.
   * This can be used to track the transaction on a blockchain explorer.
   */
  @ApiProperty({
    description: 'The transaction hash of the minting process on Cardano.',
  })
  txHash: string;

  /**
   * The full Asset ID (PolicyID + HexAssetName) of the minted NFT.
   * This uniquely identifies the minted asset on the Cardano blockchain.
   */
  @ApiProperty({
    description:
      'The full Asset ID (PolicyID + HexAssetName) of the minted NFT.',
  })
  assetId: string;

  /**
   * Message indicating the success of the transaction submission.
   */
  @ApiProperty({ description: 'Message indicating success.' })
  message: string = 'NFT Minting transaction submitted successfully.';
}
