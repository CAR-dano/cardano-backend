/*
 * --------------------------------------------------------------------------
 * File: link-wallet.dto.ts
 * Project: car-dano-backend
 * --------------------------------------------------------------------------
 * Description: DTO for linking a Cardano wallet address to the currently
 * authenticated user. Signature verification is expected to be performed
 * server-side when the implementation becomes available.
 * --------------------------------------------------------------------------
 */

import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LinkWalletDto {
  @ApiProperty({
    description: 'Cardano wallet address to associate with the user',
    example: 'addr1qx2k8q9p5z4z...',
  })
  @IsString()
  @IsNotEmpty()
  walletAddress!: string;

  @ApiProperty({
    description: 'Signed payload proving control of the wallet (structure TBD)',
    required: false,
  })
  @IsOptional()
  @IsString()
  signature?: string;
}
