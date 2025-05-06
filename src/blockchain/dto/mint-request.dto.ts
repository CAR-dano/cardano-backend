import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsUrl,
  IsNumber,
  IsOptional,
} from 'class-validator';

export class MintRequestDto {
  @ApiProperty({
    description: 'The internal ID of the inspection record to mint',
    format: 'uuid',
  })
  @IsString()
  @IsNotEmpty()
  inspectionId: string; // ID dari tabel inspections kita

  // Anda bisa mengirim semua data lagi, atau hanya ID dan service mengambil sisanya.
  // Mengirim data relevan bisa lebih baik untuk decoupling.
  @ApiProperty({ description: 'Vehicle Plate Number', example: 'B 123 RI' })
  @IsString()
  @IsNotEmpty()
  vehicleNumber: string;

  @ApiProperty({
    description: 'Inspection Date (ISO String)',
    example: '2025-05-01T14:30:00Z',
  })
  @IsString()
  @IsNotEmpty()
  inspectionDate: string;

  @ApiProperty({ description: 'ID of the Inspector user', format: 'uuid' })
  @IsString()
  @IsNotEmpty()
  inspectorId: string;

  @ApiProperty({ description: 'Vehicle Mileage', example: 15000 })
  @IsNumber()
  @IsNotEmpty()
  mileage: number;

  @ApiProperty({
    description: 'Inspection Status (should be APPROVED)',
    example: 'APPROVED',
  })
  @IsString()
  @IsNotEmpty()
  status: string; // Atau gunakan enum jika perlu validasi ketat

  @ApiProperty({ description: 'Public URL of the archived PDF report' })
  @IsUrl()
  @IsNotEmpty()
  pdfUrl: string;

  @ApiProperty({ description: 'SHA-256 Hash of the PDF report' })
  @IsString()
  @IsNotEmpty()
  pdfHash: string;

  // Optional: Tambahkan field lain jika perlu dimasukkan ke metadata NFT
  @ApiProperty({
    description:
      'Display name for the NFT (optional, will be generated if omitted)',
    required: false,
    example: 'CarReport-B123RI',
  })
  @IsOptional()
  @IsString()
  nftDisplayName?: string;
}
