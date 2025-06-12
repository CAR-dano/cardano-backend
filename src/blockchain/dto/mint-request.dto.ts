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
} from 'class-validator';

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
  @IsString()
  @IsNotEmpty()
  inspectionId: string; // Internal ID of the inspection record

  /**
   * Vehicle Plate Number.
   * Included in NFT metadata.
   */
  @ApiProperty({ description: 'Vehicle Plate Number', example: 'B 123 RI' })
  @IsString()
  @IsNotEmpty()
  vehicleNumber: string; // Vehicle plate number

  /**
   * Inspection Date in ISO String format.
   * Included in NFT metadata.
   */
  @ApiProperty({
    description: 'Inspection Date (ISO String)',
    example: '2025-05-01T14:30:00Z',
  })
  @IsString()
  @IsNotEmpty()
  inspectionDate: string; // Inspection date in ISO string format

  /**
   * ID of the Inspector user who performed the inspection.
   * Included in NFT metadata.
   */
  @ApiProperty({ description: 'ID of the Inspector user', format: 'uuid' })
  @IsString()
  @IsNotEmpty()
  inspectorId: string; // ID of the inspector user

  /**
   * Vehicle Mileage at the time of inspection.
   * Included in NFT metadata.
   */
  @ApiProperty({ description: 'Vehicle Mileage', example: 15000 })
  @IsNumber()
  @IsNotEmpty()
  mileage: number; // Vehicle mileage at the time of inspection

  /**
   * Inspection Status. Should be 'APPROVED' for minting.
   * Included in NFT metadata.
   */
  @ApiProperty({
    description: 'Inspection Status (should be APPROVED)',
    example: 'APPROVED',
  })
  @IsString()
  @IsNotEmpty()
  status: string; // Inspection status (should be APPROVED for minting)

  /**
   * Public URL of the archived PDF report.
   * This URL points to the off-chain inspection report.
   */
  @ApiProperty({ description: 'Public URL of the archived PDF report' })
  @IsUrl()
  @IsNotEmpty()
  pdfUrl: string; // Public URL of the archived PDF report

  /**
   * SHA-256 Hash of the PDF report.
   * Used to verify the integrity of the off-chain report.
   */
  @ApiProperty({ description: 'SHA-256 Hash of the PDF report' })
  @IsString()
  @IsNotEmpty()
  pdfHash: string; // SHA-256 hash of the PDF report

  @ApiProperty({
    description:
      'Display name for the NFT (optional, will be generated if omitted)',
    required: false,
    example: 'CarReport-B123RI',
  })
  @IsOptional()
  @IsString()
  nftDisplayName?: string; // Optional display name for the NFT
}
