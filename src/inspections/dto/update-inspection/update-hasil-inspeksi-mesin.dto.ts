import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsString,
  IsArray,
  IsOptional,
  MaxLength,
} from 'class-validator';

export class UpdateHasilInspeksiMesinDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  getaranMesin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  suaraMesin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  transmisi?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  pompaPowerSteering?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  coverTimingChain?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  oliPowerSteering?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  accu?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  kompressorAC?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  fan?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  selang?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  karterOli?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  oliRem?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  kabel?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  kondensor?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  radiator?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  cylinderHead?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  oliMesin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  airRadiator?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  coverKlep?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  alternator?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  waterPump?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  belt?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  oliTransmisi?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  cylinderBlock?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  bushingBesar?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  bushingKecil?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  tutupRadiator?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(1000, { each: true })
  catatan?: string[];
}
