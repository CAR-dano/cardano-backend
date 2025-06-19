import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

/**
 * DTO (Data Transfer Object) untuk request pembangunan transaksi minting.
 * Mendefinisikan data yang harus dikirim oleh frontend ke endpoint 'build-archive-tx'.
 */
export class BuildMintRequestDto {
  @ApiProperty({
    description:
      'Alamat Cardano (bech32) milik admin yang akan menandatangani transaksi. Backend akan menggunakan alamat ini untuk mencari UTXO yang diperlukan.',
    example: 'addr_test1qzae...sjk99',
  })
  @IsString({ message: 'adminAddress harus berupa string.' })
  @IsNotEmpty({ message: 'adminAddress tidak boleh kosong.' })
  adminAddress: string;
}
