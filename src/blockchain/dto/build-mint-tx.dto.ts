import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class InspectionDataDto {
  @ApiProperty({
    description: 'Nomor plat kendaraan.',
    example: 'B 1234 XYZ',
  })
  @IsString()
  @IsNotEmpty()
  vehicleNumber: string;

  @ApiProperty({
    description: 'Hash SHA-256 dari konten file PDF.',
    example: 'a1b2c3...',
  })
  @IsString()
  @IsNotEmpty()
  pdfHash: string;

  @ApiProperty({
    description: 'Nama yang akan ditampilkan untuk NFT.',
    example: 'Inspeksi Mobil 2025',
  })
  @IsString()
  @IsNotEmpty()
  nftDisplayName: string;
}

export class BuildMintTxDto {
  @ApiProperty({
    description:
      'Alamat Cardano (bech32) milik admin yang akan menandatangani transaksi.',
    example: 'addr_test1q...',
  })
  @IsString()
  @IsNotEmpty()
  adminAddress: string;

  @ApiProperty({
    description: 'Data inspeksi yang akan dimasukkan ke dalam metadata NFT.',
  })
  @IsObject()
  @ValidateNested() // Memastikan objek di dalamnya juga divalidasi
  @Type(() => InspectionDataDto) // Diperlukan untuk class-validator agar tahu cara memvalidasi objek nested
  inspectionData: InspectionDataDto;
}
