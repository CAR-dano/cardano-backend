/*
 * --------------------------------------------------------------------------
 * File: transaction-metadata-response.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Data Transfer Object (DTO) representing a single metadata entry
 * returned by the Blockfrost `/txs/{hash}/metadata` endpoint.
 * Imports necessary modules like ApiProperty for Swagger documentation.
 * Declares the TransactionMetadataResponseDto class with properties for
 * metadata label and content.
 * --------------------------------------------------------------------------
 */

// Library imports
import { ApiProperty } from '@nestjs/swagger';

/**
 * Data Transfer Object (DTO) representing a single metadata entry returned by the
 * Blockfrost `/txs/{hash}/metadata` endpoint.
 */
export class TransactionMetadataResponseDto {
  /**
   * The metadata label (key) as a string. According to CIP-10, this is usually numeric.
   * Example: "721" for NFT metadata standard.
   */
  @ApiProperty({
    description: 'Metadata label (key) as a string (e.g., "721")', // Description for Swagger documentation
    example: '721', // Example value for Swagger documentation
  })
  label: string; // Property to hold the metadata label

  /**
   * The content of the metadata associated with the label.
   * Can be any valid JSON type (object, array, string, number, boolean, null).
   * The structure depends on what was submitted in the transaction.
   * For CIP-25 NFTs under label "721", this would typically be an object:
   * `{ policyId: { assetName: { name: "...", image: "...", ... } } }`
   */
  @ApiProperty({
    description:
      'The JSON metadata content associated with the label. Structure varies.', // Description for Swagger documentation
    example: {
      'a1b2c3d4...': {
        // Policy ID
        TokenNameHex: {
          // Asset Name (Hex) - Note: Blockfrost shows hex here in some contexts, but the lookup key in metadata is often the non-hex name
          name: 'CarInspection-B123RI', // Example name
          image: 'ipfs://QmY65h6y6zUoJjN3ripc4J2PzEvzL2VkiVXz3sCZboqPJw',
          mediaType: 'image/png',
          description: 'NFT Proof of Vehicle Inspection',
          vehicleNumber: 'XYZ123', // Example vehicle number
          pdfHash: 'sha256...', // Example PDF hash
        },
      },
    },
    // We use 'any' here because the structure can be highly variable.
    // For better documentation, you could create more specific nested DTOs if
    // you always expect a certain structure under label '721'.
    type: 'object', // General hint for Swagger, could be array, string etc.
    additionalProperties: true, // Allow additional properties as the structure can vary
    nullable: true, // Metadata could potentially be JSON null
  })
  json_metadata: any; // Property to hold the JSON metadata content
}
