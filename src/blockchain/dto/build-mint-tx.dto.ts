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
import { ApiProperty } from '@nestjs/swagger'; // Import ApiProperty for Swagger documentation
import {
  IsString, // Import IsString validator
  IsNotEmpty, // Import IsNotEmpty validator
  IsObject, // Import IsObject validator
  ValidateNested, // Import ValidateNested validator for nested objects
} from 'class-validator';
import { Type } from 'class-transformer'; // Import Type for class-transformer

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
  @IsString() // Validate that vehicleNumber is a string
  @IsNotEmpty() // Validate that vehicleNumber is not empty
  vehicleNumber: string;

  /**
   * The SHA-256 hash of the PDF file content.
   */
  @ApiProperty({
    description: 'The SHA-256 hash of the PDF file content.',
    example: 'a1b2c3...',
  })
  @IsString() // Validate that pdfHash is a string
  @IsNotEmpty() // Validate that pdfHash is not empty
  pdfHash: string;

  /**
   * The SHA-256 hash of the PDF file content without confidential data.
   */
  @ApiProperty({
    description:
      'The SHA-256 hash of the PDF file content without confidential data.',
    example: 'd4e5f6...',
  })
  @IsString()
  @IsNotEmpty()
  pdfHashNonConfidential: string;

  /**
   * The display name for the NFT.
   */
  @ApiProperty({
    description: 'The display name for the NFT.',
    example: 'Inspeksi Mobil 2025',
  })
  @IsString() // Validate that nftDisplayName is a string
  @IsNotEmpty() // Validate that nftDisplayName is not empty
  nftDisplayName: string;
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
  @IsString() // Validate that adminAddress is a string
  @IsNotEmpty() // Validate that adminAddress is not empty
  adminAddress: string;

  /**
   * The inspection data to be included in the NFT metadata.
   */
  @ApiProperty({
    description: 'The inspection data to be included in the NFT metadata.',
  })
  @IsObject() // Validate that inspectionData is an object
  @ValidateNested() // Ensures the nested object is also validated
  @Type(() => InspectionDataDto) // Required for class-validator to know how to validate the nested object
  inspectionData: InspectionDataDto;
}
