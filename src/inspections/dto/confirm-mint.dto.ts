import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Length, Matches } from 'class-validator';

/**
 * DTO untuk endpoint yang mengonfirmasi bahwa proses minting telah berhasil dikirim
 * oleh frontend. Backend akan menggunakan data ini untuk memperbarui database.
 */
export class ConfirmMintDto {
  @ApiProperty({
    description:
      'Hash dari transaksi minting yang telah berhasil disubmit ke blockchain.',
    example: '2d7a5e678bdbe2f93ca12378028e6fb6ae7987f210bc5d1ce8ba134bbf66a9b3',
  })
  @IsString()
  @IsNotEmpty()
  @Length(64, 64, { message: 'txHash must be exactly 64 characters (Cardano transaction hash)' })
  @Matches(/^[a-f0-9]+$/, { message: 'txHash must contain only lowercase hex characters' })
  txHash: string;

  @ApiProperty({
    description:
      'Asset ID unik dari NFT yang baru saja di-mint. Nilai ini didapat dari respons endpoint "build-tx" sebelumnya.',
    example:
      '401c967008d42885400991f9225715e1c3a8e43757b1fd36a1328195496e7370656374696f6e4e4654',
  })
  @IsString()
  @IsNotEmpty()
  // Cardano asset IDs are hex-encoded: policy ID (56 chars) + asset name (0–64 chars) = 56–120 hex chars
  @Length(56, 120, { message: 'nftAssetId must be between 56 and 120 characters (Cardano asset ID)' })
  @Matches(/^[a-f0-9]+$/, { message: 'nftAssetId must contain only lowercase hex characters' })
  nftAssetId: string;
}
