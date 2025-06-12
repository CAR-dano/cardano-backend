import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO untuk respons dari endpoint yang membangun transaksi.
 * Backend akan mengirimkan data ini ke frontend.
 */
export class BuildMintTxResponseDto {
  @ApiProperty({
    description:
      'Transaksi yang belum ditandatangani dalam format CBOR hex string. String ini akan diserahkan ke dompet di frontend untuk ditandatangani.',
    example: '84a40082825820...',
  })
  unsignedTx: string;

  @ApiProperty({
    description:
      'Asset ID unik (PolicyID + AssetNameHex) dari NFT yang akan dibuat. Frontend perlu menyimpan ini sementara untuk dikirim kembali saat konfirmasi.',
    example:
      '401c967008d42885400991f9225715e1c3a8e43757b1fd36a1328195496e7370656374696f6e4e4654',
  })
  nftAssetId: string;
}
