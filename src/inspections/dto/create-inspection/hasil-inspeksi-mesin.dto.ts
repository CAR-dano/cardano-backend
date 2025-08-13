import { ApiProperty } from '@nestjs/swagger';
import {
  IsNumber,
  IsString,
  IsNotEmpty,
  IsArray,
  IsOptional,
  MaxLength,
} from 'class-validator';

export class HasilInspeksiMesinDto {
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  getaranMesin: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  suaraMesin: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  transmisi: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  pompaPowerSteering: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  coverTimingChain: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  oliPowerSteering: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  accu: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  kompressorAC: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  fan: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  selang: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  karterOli: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  oliRem: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  kabel: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  kondensor: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  radiator: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  cylinderHead: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  oliMesin: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  airRadiator: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  coverKlep: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  alternator: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  waterPump: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  belt: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  oliTransmisi: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  cylinderBlock: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  bushingBesar: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  bushingKecil: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  tutupRadiator: number;

  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(1000, { each: true })
  @IsOptional()
  catatan: string[];
}
