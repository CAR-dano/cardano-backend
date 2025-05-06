/**
 * @fileoverview Data Transfer Object (DTO) representing the structure of a complete
 * Inspection record when returned by API endpoints (e.g., GET /inspections, GET /inspections/:id).
 * It defines the shape of the data sent back to the client, potentially excluding
 * sensitive or internal fields from the original Prisma model.
 */
import { Inspection, Prisma } from '@prisma/client'; // Import necessary Prisma types

// Optional: Import UserResponseDto if you plan to embed user details later
// import { UserResponseDto } from '../../users/dto/user-response.dto';

export class InspectionResponseDto {
  /**
   * The unique identifier (UUID) for the inspection record.
   * Primary key.
   */
  id: string;

  /**
   * The UUID of the user (Inspector) who submitted this inspection.
   * Can be null if not linked.
   */
  submittedByUserId: string | null;

  /**
   * The UUID of the user (Reviewer) who last reviewed (approved/rejected) this inspection.
   * Can be null if not yet reviewed.
   */
  reviewerId: string | null;

  /**
   * The license plate number of the inspected vehicle.
   */
  vehiclePlateNumber: string | null;

  /**
   * The date and time the inspection occurred.
   */
  inspectionDate: Date | null;

  /**
   * The overall rating assigned during the inspection.
   */
  overallRating: string | null;

  /**
   * The current status of the inspection in its lifecycle.
   * Uses the InspectionStatus enum values (e.g., "NEED_REVIEW", "APPROVED", "ARCHIVED").
   */
  status: string; // Exposing enum as string in response is common

  /**
   * Object containing identity details (inspector, customer, branch) from the inspection form.
   * Stored as JSON in the database.
   */
  identityDetails: Prisma.JsonValue | null;

  /**
   * Object containing vehicle details (make, model, year, transmission, etc.) from the inspection form.
   * Stored as JSON in the database.
   */
  vehicleData: Prisma.JsonValue | null;

  /**
   * Object containing checklist results for equipment (service book, spare key, etc.) from the inspection form.
   * Stored as JSON in the database.
   */
  equipmentChecklist: Prisma.JsonValue | null;

  /**
   * Object containing summary results (scores, indicators, tire info, estimates) from the inspection form.
   * Stored as JSON in the database.
   */
  inspectionSummary: Prisma.JsonValue | null;

  /**
   * Object containing detailed assessment scores across various categories from the inspection form.
   * Stored as JSON in the database.
   */
  detailedAssessment: Prisma.JsonValue | null;

  /**
   * Object containing body paint thickness measurements from the inspection form.
   * Stored as JSON in the database.
   */
  bodyPaintThickness: Prisma.JsonValue | null;

  /**
   * An array containing metadata for photos associated with this inspection.
   * Each element is expected to be an object (e.g., { path: string, label?: string }).
   * Stored as a JSON array in the database.
   */
  photoPaths: Prisma.JsonValue[]; // Type Json[] from Prisma

  /**
   * The URL pointing to the generated PDF report file (stored off-chain).
   * Null if the report hasn't been generated/archived.
   */
  reportPdfUrl: string | null;

  /**
   * The unique Cardano NFT Asset ID representing this inspection on the blockchain.
   * Null if the NFT has not been minted yet.
   */
  nftAssetId: string | null;

  /**
   * The Cardano transaction hash for the NFT minting process.
   * Null if the transaction hasn't occurred or completed.
   */
  blockchainTxHash: string | null;

  /**
   * The cryptographic hash (e.g., SHA-256) of the generated PDF report file.
   * Null if not yet calculated/stored.
   */
  pdfFileHash: string | null;

  /**
   * The timestamp indicating when the inspection was successfully archived (PDF stored, NFT minted).
   * Null if not yet archived.
   */
  archivedAt: Date | null;

  /**
   * The timestamp indicating when the inspection was deactivated (soft delete).
   * Null if currently active or never archived.
   */
  deactivatedAt: Date | null;

  /**
   * The timestamp when this inspection record was first created in the database.
   */
  createdAt: Date;

  /**
   * The timestamp when this inspection record was last updated in the database.
   */
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
