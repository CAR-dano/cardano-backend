/*
 * --------------------------------------------------------------------------
 * File: blockchain-status-response.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Data Transfer Object for the blockchain status response.
 * --------------------------------------------------------------------------
 */
import { ApiProperty } from '@nestjs/swagger';

export class BlockchainStatusResponseDto {
  @ApiProperty({
    description: 'Number of orders already uploaded/minted to the blockchain',
    example: 150,
  })
  mintedToBlockchain: number;

  @ApiProperty({
    description: 'Number of orders waiting to be minted',
    example: 10,
  })
  pendingMint: number;

  @ApiProperty({
    description: 'Number of orders that failed to mint',
    example: 5,
  })
  failedMint: number;
}
