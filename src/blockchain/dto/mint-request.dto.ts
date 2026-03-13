/*
 * --------------------------------------------------------------------------
 * File: mint-request.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Data Transfer Object for requesting the minting of an NFT for an inspection record.
 * Contains necessary data fields for the minting process.
 * --------------------------------------------------------------------------
 */

// External library imports are grouped together.
import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsUrl,
  IsNumber,
  IsOptional,
  IsUUID,
  IsEnum,
  IsDateString,
  Min,
  MaxLength,
  Matches,
  Length,
} from 'class-validator';
import { InspectionStatus } from '@prisma/client';

/**
 * DTO for requesting the minting of an NFT for a car inspection.
 */
export class MintRequestDto {
  /**
   * The internal ID of the inspection record to mint.
   * This ID links the NFT back to the backend's database record.
   */
  @ApiProperty({
    description: 'The internal ID of the inspection record to mint',
    format: 'uuid',
  })
  @IsUUID('4', { message: 'inspectionId must be a valid UUID v4' })
  @IsNotEmpty()
  inspectionId: string; // Internal ID of the inspection record

  /**
   * Vehicle Plate Number.
   * Included in NFT metadata.
   */
  @ApiProperty({ description: 'Vehicle Plate Number', example: 'B 123 RI' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  vehicleNumber: string; // Vehicle plate number

  /**
   * Inspection Date in ISO String format.
   * Included in NFT metadata.
   */
  @ApiProperty({
    description: 'Inspection Date (ISO String)',
    example: '2025-05-01T14:30:00Z',
  })
  @IsDateString({}, { message: 'inspectionDate must be a valid ISO date string' })
  @IsNotEmpty()
  inspectionDate: string; // Inspection date in ISO string format

  /**
   * ID of the Inspector user who performed the inspection.
   * Included in NFT metadata.
   */
  @ApiProperty({ description: 'ID of the Inspector user', format: 'uuid' })
  @IsUUID('4', { message: 'inspectorId must be a valid UUID v4' })
  @IsNotEmpty()
  inspectorId: string; // ID of the inspector user

  /**
   * Vehicle Mileage at the time of inspection.
   * Included in NFT metadata.
   */
  @ApiProperty({ description: 'Vehicle Mileage', example: 15000 })
  @IsNumber()
  @Min(0, { message: 'mileage must be a non-negative number' })
  @IsNotEmpty()
  mileage: number; // Vehicle mileage at the time of inspection

  /**
   * Inspection Status. Should be 'APPROVED' for minting.
   * Included in NFT metadata.
   */
  @ApiProperty({
    description: 'Inspection Status (should be APPROVED)',
    enum: InspectionStatus,
    example: InspectionStatus.APPROVED,
  })
  @IsEnum(InspectionStatus, {
    message: `status must be a valid InspectionStatus value: ${Object.values(InspectionStatus).join(', ')}`,
  })
  @IsNotEmpty()
  status: InspectionStatus; // Inspection status (should be APPROVED for minting)

  /**
   * Public URL of the archived PDF report.
   * This URL points to the off-chain inspection report.
   */
  @ApiProperty({ description: 'Public URL of the archived PDF report' })
  @IsUrl({}, { message: 'pdfUrl must be a valid URL' })
  @IsNotEmpty()
  pdfUrl: string; // Public URL of the archived PDF report

  /**
   * SHA-256 Hash of the PDF report.
   * Used to verify the integrity of the off-chain report.
   */
  @ApiProperty({
    description: 'SHA-256 Hash of the PDF report (64 lowercase hex characters)',
    example: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
  })
  @IsString()
  @IsNotEmpty()
  @Length(64, 64, { message: 'pdfHash must be exactly 64 characters (SHA-256 hex)' })
  @Matches(/^[a-f0-9]+$/, { message: 'pdfHash must contain only lowercase hex characters' })
  pdfHash: string; // SHA-256 hash of the PDF report

  @ApiProperty({
    description:
      'Display name for the NFT (optional, will be generated if omitted)',
    required: false,
    example: 'CarReport-B123RI',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  nftDisplayName?: string; // Optional display name for the NFT
}
