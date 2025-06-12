/*
 * --------------------------------------------------------------------------
 * File: build-mint-tx-response.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Data Transfer Object (DTO) for the response of the endpoint
 * that builds a transaction. This data is sent from the backend to the frontend.
 * --------------------------------------------------------------------------
 */

// Library imports
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for the response of the endpoint that builds a transaction.
 * The backend sends this data to the frontend.
 */
/**
 * Exports the class to make it available for use in other modules.
 */
export class BuildMintTxResponseDto {
  /**
   * The unsigned transaction in CBOR hex string format. This string will be passed to the wallet on the frontend for signing.
   */
  @ApiProperty({
    description:
      'The unsigned transaction in CBOR hex string format. This string will be passed to the wallet on the frontend for signing.',
    example: '84a40082825820...',
  })
  unsignedTx: string; // Represents the unsigned transaction as a string.

  /**
   * The unique Asset ID (PolicyID + AssetNameHex) of the NFT to be created. The frontend needs to temporarily store this to send back during confirmation.
   */
  @ApiProperty({
    description:
      'The unique Asset ID (PolicyID + AssetNameHex) of the NFT to be created. The frontend needs to temporarily store this to send back during confirmation.',
    example:
      '401c967008d42885400991f9225715e1c3a8e43757b1fd36a1328195496e7370656374696f6e4e4654',
  })
  nftAssetId: string; // Represents the NFT Asset ID as a string.
}
