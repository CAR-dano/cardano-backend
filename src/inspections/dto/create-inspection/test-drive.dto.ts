import { ApiProperty } from '@nestjs/swagger';
import {
  IsNumber,
  IsString,
  IsNotEmpty,
  IsArray,
  IsOptional,
  MaxLength,
} from 'class-validator';

export class TestDriveDto {
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  bunyiGetaran: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  performaStir: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  perpindahanTransmisi: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  stirBalance: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  performaSuspensi: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  performaKopling: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  rpm: number;

  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(1000, { each: true })
  @IsOptional()
  catatan: string[];
}
