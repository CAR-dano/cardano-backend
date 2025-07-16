import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

export class VehicleDataDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  merekKendaraan: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  tipeKendaraan: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  tahun: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  transmisi: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  warnaKendaraan: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  odometer: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  kepemilikan: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  platNomor: string;

  @ApiProperty()
  @Type(() => Date)
  @IsDate()
  @IsNotEmpty()
  pajak1Tahun: Date;

  @ApiProperty()
  @Type(() => Date)
  @IsDate()
  @IsNotEmpty()
  pajak5Tahun: Date;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  biayaPajak: number;
}
