/*
 * --------------------------------------------------------------------------
 * File: inspection-response.dto.ts
 * Project: cardano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Data Transfer Object (DTO) representing the structure of a complete
 * Inspection record when returned by API endpoints. Defines the shape of the data
 * sent back to the client, potentially excluding sensitive or internal fields.
 * --------------------------------------------------------------------------
 */
import { Inspection, Prisma } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

// Optional: Import UserResponseDto if you plan to embed user details later
// import { UserResponseDto } from '../../users/dto/user-response.dto';

export class InspectionResponseDto {
  /**
   * The unique identifier (UUID) for the inspection record.
   * Primary key.
   */
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    description: 'The unique identifier (UUID) for the inspection record.',
  })
  id: string;

  /**
   * The UUID of the user (Inspector) who submitted this inspection.
   * Can be null if not linked.
   */
  @ApiProperty({
    example: 'f9e8d7c6-b5a4-3210-fedc-ba9876543210',
    description:
      'The UUID of the user (Inspector) who submitted this inspection.',
    nullable: true,
  })
  submittedByUserId: string | null;

  /**
   * The UUID of the user (Reviewer) who last reviewed (approved/rejected) this inspection.
   * Can be null if not yet reviewed.
   */
  @ApiProperty({
    example: '10293847-5678-90ab-cdef-1234567890ab',
    description:
      'The UUID of the user (Reviewer) who last reviewed (approved/rejected) this inspection.',
    nullable: true,
  })
  reviewerId: string | null;

  /**
   * The license plate number of the inspected vehicle.
   */
  @ApiProperty({
    example: 'AB 1231 RI',
    description: 'The license plate number of the inspected vehicle.',
    nullable: true,
  })
  vehiclePlateNumber: string | null;

  /**
   * The date and time the inspection occurred.
   */
  @ApiProperty({
    example: '2025-05-01T14:30:00Z',
    description: 'The date and time the inspection occurred.',
    nullable: true,
  })
  inspectionDate: Date | null;

  /**
   * The overall rating assigned during the inspection.
   */
  @ApiProperty({
    example: 'B+',
    description: 'The overall rating assigned during the inspection.',
    nullable: true,
  })
  overallRating: string | null;

  /**
   * The current status of the inspection in its lifecycle.
   * Uses the InspectionStatus enum values (e.g., "NEED_REVIEW", "APPROVED", "ARCHIVED").
   */
  @ApiProperty({
    example: 'APPROVED',
    description: 'The current status of the inspection in its lifecycle.',
  })
  status: string; // Exposing enum as string in response is common

  /**
   * Object containing identity details (inspector, customer, branch) from the inspection form.
   * Stored as JSON in the database.
   */
  @ApiProperty({
    example: { namaInspektor: 'Maulana', namaCustomer: 'Budi S.' },
    description: 'Object containing identity details from the inspection form.',
    nullable: true,
  })
  identityDetails: Prisma.JsonValue | null;

  /**
   * Object containing vehicle details (make, model, year, transmission, etc.) from the inspection form.
   * Stored as JSON in the database.
   */
  @ApiProperty({
    description: 'Object containing vehicle details from the inspection form.',
    nullable: true,
  })
  vehicleData: Prisma.JsonValue | null;

  /**
   * Object containing checklist results for equipment (service book, spare key, etc.) from the inspection form.
   * Stored as JSON in the database.
   */
  @ApiProperty({
    description:
      'Object containing checklist results for equipment from the inspection form.',
    nullable: true,
  })
  equipmentChecklist: Prisma.JsonValue | null;

  /**
   * Object containing summary results (scores, indicators, tire info, estimates) from the inspection form.
   * Stored as JSON in the database.
   */
  @ApiProperty({
    description: 'Object containing summary results from the inspection form.',
    nullable: true,
  })
  inspectionSummary: Prisma.JsonValue | null;

  /**
   * Object containing detailed assessment scores across various categories from the inspection form.
   * Stored as JSON in the database.
   */
  @ApiProperty({
    description:
      'Object containing detailed assessment scores from the inspection form.',
    nullable: true,
  })
  detailedAssessment: Prisma.JsonValue | null;

  /**
   * Object containing body paint thickness measurements from the inspection form.
   * Stored as JSON in the database.
   */
  @ApiProperty({
    description:
      'Object containing body paint thickness measurements from the inspection form.',
    nullable: true,
  })
  bodyPaintThickness: Prisma.JsonValue | null;

  /**
   * An array containing metadata for photos associated with this inspection.
   * Each element is expected to be an object (e.g., { path: string, label?: string }).
   * Stored as a JSON array in the database.
   */
  @ApiProperty({
    example: [{ path: '/uploads/photo1.jpg', label: 'front' }],
    description:
      'An array containing metadata for photos associated with this inspection.',
    type: 'array',
    items: { type: 'object' },
  })
  photoPaths: Prisma.JsonValue[]; // Type Json[] from Prisma

  /**
   * The URL pointing to the generated PDF report file (stored off-chain).
   * Null if the report hasn't been generated/archived.
   */
  @ApiProperty({
    example: 'https://example.com/reports/report-abc.pdf',
    description:
      'The URL pointing to the generated PDF report file (stored off-chain).',
    nullable: true,
  })
  reportPdfUrl: string | null;

  /**
   * The unique Cardano NFT Asset ID representing this inspection on the blockchain.
   * Null if the NFT has not been minted yet.
   */
  @ApiProperty({
    example: 'asset1abcdef...',
    description:
      'The unique Cardano NFT Asset ID representing this inspection on the blockchain.',
    nullable: true,
  })
  nftAssetId: string | null;

  /**
   * The Cardano transaction hash for the NFT minting process.
   * Null if the transaction hasn't occurred or completed.
   */
  @ApiProperty({
    example: 'tx1abcdef...',
    description: 'The Cardano transaction hash for the NFT minting process.',
    nullable: true,
  })
  blockchainTxHash: string | null;

  /**
   * The cryptographic hash (e.g., SHA-256) of the generated PDF report file.
   * Null if not yet calculated/stored.
   */
  @ApiProperty({
    example: 'a1b2c3d4e5f67890...',
    description:
      'The cryptographic hash (e.g., SHA-256) of the generated PDF report file.',
    nullable: true,
  })
  pdfFileHash: string | null;

  /**
   * The timestamp indicating when the inspection was successfully archived (PDF stored, NFT minted).
   * Null if not yet archived.
   */
  @ApiProperty({
    example: '2025-05-01T15:00:00Z',
    description:
      'The timestamp indicating when the inspection was successfully archived.',
    nullable: true,
  })
  archivedAt: Date | null;

  /**
   * The timestamp indicating when the inspection was deactivated (soft delete).
   * Null if currently active or never archived.
   */
  @ApiProperty({
    example: '2025-05-02T10:00:00Z',
    description:
      'The timestamp indicating when the inspection was deactivated (soft delete).',
    nullable: true,
  })
  deactivatedAt: Date | null;

  /**
   * The timestamp when this inspection record was first created in the database.
   */
  @ApiProperty({
    example: '2025-05-01T14:00:00Z',
    description:
      'The timestamp when this inspection record was first created in the database.',
  })
  createdAt: Date;

  /**
   * The timestamp when this inspection record was last updated in the database.
   */
  @ApiProperty({
    example: '2025-05-01T14:35:00Z',
    description:
      'The timestamp when this inspection record was last updated in the database.',
  })
  updatedAt: Date;

  /**
   * Constructor to facilitate mapping from a Prisma Inspection entity.
   * Uses Object.assign for straightforward mapping of properties with the same name.
   * Can be extended to explicitly map or exclude fields if needed.
   * @param {Partial<Inspection>} inspection - The Prisma Inspection entity or a partial object.
   */
  constructor(partial: Partial<Inspection>) {
    // Copies properties from the Prisma entity to this DTO instance
    Object.assign(this, partial);

    // Example: If you included user relations in the service query and want to map them to UserResponseDto
    // if (partial.submittedByUser) {
    //   this.submittedByUser = new UserResponseDto(partial.submittedByUser); // Assuming UserResponseDto exists
    // }
    // if (partial.reviewer) {
    //   this.reviewer = new UserResponseDto(partial.reviewer);
    // }
  }
}
