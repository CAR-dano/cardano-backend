/*
 * --------------------------------------------------------------------------
 * File: build-mint-tx.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Data Transfer Objects (DTOs) for building a mint transaction on the Cardano blockchain.
 * Defines the structure for inspection data to be included in NFT metadata and the overall
 * transaction details required for minting.
 * --------------------------------------------------------------------------
 */

// Library imports
import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsObject,
  ValidateNested,
  Matches,
  MaxLength,
  Length,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

/**
 * DTO for inspection data to be included in NFT metadata.
 */
class InspectionDataDto {
  /**
   * The vehicle's license plate number.
   */
  @ApiProperty({
    description: "The vehicle's license plate number.",
    example: 'B 1234 XYZ',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  vehicleNumber!: string;

  /**
   * The SHA-256 hash of the PDF file content (64 lowercase hex characters).
   */
  @ApiProperty({
    description: 'The SHA-256 hash of the PDF file content.',
    example: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
  })
  @IsString()
  @IsNotEmpty()
  @Length(64, 64, {
    message: 'pdfHash must be exactly 64 characters (SHA-256 hex)',
  })
  @Matches(/^[a-f0-9]+$/, {
    message: 'pdfHash must contain only lowercase hex characters',
  })
  pdfHash!: string;

  /**
   * The display name for the NFT.
   */
  @ApiProperty({
    description: 'The display name for the NFT.',
    example: 'Inspeksi Mobil 2025',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  nftDisplayName!: string;
}

/**
 * DTO for building a mint transaction.
 */
export class BuildMintTxDto {
  /**
   * The Cardano address (bech32) of the admin who will sign the transaction.
   */
  @ApiProperty({
    description:
      'The Cardano address (bech32) of the admin who will sign the transaction.',
    example: 'addr_test1q...',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Matches(/^(addr1|addr_test1|stake1|stake_test1)[a-z0-9]+$/, {
    message: 'adminAddress must be a valid Cardano bech32 address',
  })
  adminAddress!: string;

  /**
   * The inspection data to be included in the NFT metadata.
   */
  @ApiProperty({
    description: 'The inspection data to be included in the NFT metadata.',
  })
  @IsObject()
  @ValidateNested()
  @Type(() => InspectionDataDto)
  inspectionData!: InspectionDataDto;
}
