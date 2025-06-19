/*
 * --------------------------------------------------------------------------
 * File: nft-data-response.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Data Transfer Object representing the detailed response structure for an asset (NFT)
 * from the Blockfrost `/assets/{asset}` endpoint. Includes standard CIP-25/CIP-68 metadata
 * and potentially legacy metadata.
 * --------------------------------------------------------------------------
 */

// Library imports
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Represents the structure commonly found within the `onchain_metadata` field
 * for NFTs following CIP-25 or similar standards.
 * All properties are optional as per the standard.
 */
class NftOnchainMetadataDto {
  /**
   * Required display name for the NFT (CIP-25).
   */
  @ApiPropertyOptional({
    description: 'Required display name for the NFT (CIP-25).',
  })
  name?: string;

  /**
   * URL (often IPFS) or array of URLs pointing to the NFT's primary media.
   */
  @ApiPropertyOptional({
    description:
      "URL (often IPFS) or array of URLs pointing to the NFT's primary media.",
  })
  image?: string | string[];

  /**
   * MIME type of the asset specified in "image".
   */
  @ApiPropertyOptional({
    description: 'MIME type of the asset specified in "image".',
  })
  mediaType?: string;

  /**
   * Description of the NFT.
   */
  @ApiPropertyOptional({ description: 'Description of the NFT.' })
  description?: string | string[];

  // --- CAR-dano Specific Metadata (Example) ---
  // Add specific properties that YOU include in the metadata during minting
  /**
   * Original Inspection Record ID.
   */
  @ApiPropertyOptional({
    description: 'Original Inspection Record ID.',
    format: 'uuid',
  })
  inspectionId?: string;

  /**
   * Vehicle Plate Number.
   */
  @ApiPropertyOptional({ description: 'Vehicle Plate Number.' })
  vehicleNumber?: string;

  /**
   * Date of Inspection in ISO String format.
   */
  @ApiPropertyOptional({ description: 'Date of Inspection (ISO String).' })
  inspectionDate?: string;

  /**
   * Brand of the Vehicle.
   */
  @ApiPropertyOptional({ description: 'Brand of the Vehicle.' })
  vehicleBrand?: string;

  /**
   * Model of the Vehicle.
   */
  @ApiPropertyOptional({ description: 'Model of the Vehicle.' })
  vehicleModel?: string;

  /**
   * Overall Rating given during the inspection.
   */
  @ApiPropertyOptional({ description: 'Overall Rating given.' })
  overallRating?: string;

  /**
   * URL to the off-chain PDF report.
   */
  @ApiPropertyOptional({ description: 'URL to the off-chain PDF report.' })
  pdfUrl?: string;

  /**
   * SHA-256 Hash of the PDF report.
   */
  @ApiPropertyOptional({ description: 'SHA-256 Hash of the PDF report.' })
  pdfHash?: string;

  /**
   * ID of the inspector user.
   */
  @ApiPropertyOptional({
    description: 'ID of the inspector user.',
    format: 'uuid',
  })
  inspectorId?: string;

  // Allow other custom properties that might be included
  [key: string]: unknown;
}

/**
 * Main DTO for the response of `/assets/{assetId}`.
 */
export class NftDataResponseDto {
  /**
   * The concatenated Asset ID (Policy ID + Hex-encoded Asset Name).
   * @example "f0f0f0...4d7941737365744e616d65"
   */
  @ApiProperty({
    description: 'Concatenated Policy ID and Hex-encoded Asset Name.',
    example: 'f0f0f0...4d7941737365744e616d65',
  })
  asset: string;

  /**
   * The Policy ID of the asset's minting policy.
   */
  @ApiProperty({ description: 'Policy ID of the minting policy.' })
  policy_id: string;

  /**
   * The Asset Name in hexadecimal encoding.
   */
  @ApiProperty({ description: 'Hex-encoded Asset Name.' })
  asset_name: string | null; // Can be null for the ADA asset itself

  /**
   * The CIP-14 asset fingerprint.
   */
  @ApiProperty({ description: 'CIP-14 asset fingerprint.' })
  fingerprint: string;

  /**
   * Current circulating quantity of the asset. Should be "1" for a standard NFT.
   */
  @ApiProperty({
    description: 'Current circulating quantity (usually "1" for NFTs).',
  })
  quantity: string;

  /**
   * The transaction hash of the initial minting event.
   */
  @ApiProperty({ description: 'Transaction hash of the initial mint.' })
  initial_mint_tx_hash: string;

  /**
   * The total number of minting and burning transactions for this asset.
   */
  @ApiProperty({ description: 'Total number of mint and burn transactions.' })
  mint_or_burn_count: number;

  /**
   * On-chain metadata conforming to the CIP-25 or CIP-68 NFT standard.
   * Can be null if no standard metadata is found.
   */
  @ApiPropertyOptional({
    type: NftOnchainMetadataDto,
    description: 'Standard on-chain metadata (CIP-25/CIP-68).',
    nullable: true,
  })
  onchain_metadata?: NftOnchainMetadataDto | null;

  /**
   * Legacy or non-standard on-chain metadata associated with the asset.
   * Can be null. Structure varies.
   */
  @ApiPropertyOptional({
    type: 'object',
    description: 'Legacy or non-standard on-chain metadata.',
    nullable: true,
    additionalProperties: true,
  })
  metadata?: unknown; // Use 'unknown' for potentially unstructured legacy metadata
}
