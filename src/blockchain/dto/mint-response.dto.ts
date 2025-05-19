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
import { ApiProperty } from '@nestjs/swagger';

export class MintResponseDto {
  @ApiProperty({
    description: 'The transaction hash of the minting process on Cardano.',
  })
  txHash: string;

  @ApiProperty({
    description:
      'The full Asset ID (PolicyID + HexAssetName) of the minted NFT.',
  })
  assetId: string;

  @ApiProperty({ description: 'Message indicating success.' })
  message: string = 'NFT Minting transaction submitted successfully.';
}
