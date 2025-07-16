import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class EstimasiPerbaikanDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  namaPart: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  harga: number;
}
