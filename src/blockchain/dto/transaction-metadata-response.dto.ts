/*
 * --------------------------------------------------------------------------
 * File: transaction-metadata-response.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Data Transfer Object (DTO) representing a single metadata entry
 * returned by the Blockfrost `/txs/{hash}/metadata` endpoint.
 * Contains the metadata label and its associated JSON content.
 * --------------------------------------------------------------------------
 */

import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO representing a single metadata entry returned by the Blockfrost
 * `/txs/{hash}/metadata` endpoint.
 */
export class TransactionMetadataResponseDto {
  /**
   * The metadata label (key) as a string. According to CIP-10, this is usually numeric.
   * Example: "721" for NFT metadata standard.
   */
  @ApiProperty({
    description: 'Metadata label (key) as a string (e.g., "721")',
    example: '721',
  })
  label: string;

  /**
   * The content of the metadata associated with the label.
   * Can be any valid JSON type (object, array, string, number, boolean, null).
   * The structure depends on what was submitted in the transaction.
   * For CIP-25 NFTs under label "721", this would typically be an object:
   * `{ policyId: { assetName: { name: "...", image: "...", ... } } }`
   */
  @ApiProperty({
    description:
      'The JSON metadata content associated with the label. Structure varies.',
    example: {
      'a1b2c3d4...': {
        // Policy ID
        TokenNameHex: {
          // Asset Name (Hex) - Note: Blockfrost shows hex here in some contexts, but the lookup key in metadata is often the non-hex name
          name: 'CarInspection-B123RI', // Example name
          inspectionId: 'uuid...',
          inspectionDate: 'YYYY-MM-DD',
          vehicleNumber: 'XYZ123',
          vehicleBrand: 'Toyota',
          vehicleModel: 'Camry',
          overallRating: 'Excellent',
          pdfUrl: 'https://example.com/report.pdf',
          pdfHash: 'sha256...',
          inspectorId: 'inspector-uuid...',
        },
      },
    },
    // We use 'any' here because the structure can be highly variable.
    // For better documentation, you could create more specific nested DTOs if
    // you always expect a certain structure under label '721'.
    type: 'object', // General hint, could be array, string etc.
    additionalProperties: true, // Allow additional properties as the structure can vary
    nullable: true, // Metadata could potentially be JSON null
  })
  json_metadata: any;
}
