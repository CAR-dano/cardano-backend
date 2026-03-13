import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, IsNotEmpty, Matches, MaxLength } from 'class-validator';

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
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'adminAddress harus berupa string.' })
  @IsNotEmpty({ message: 'adminAddress tidak boleh kosong.' })
  @MaxLength(255, { message: 'adminAddress tidak boleh melebihi 255 karakter.' })
  @Matches(/^(addr1|addr_test1|stake1|stake_test1)[a-z0-9]+$/, {
    message:
      'adminAddress harus berupa alamat Cardano bech32 yang valid (addr1…, addr_test1…, stake1…, atau stake_test1…)',
  })
  adminAddress: string;
}
