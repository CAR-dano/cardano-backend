import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsString,
  IsArray,
  IsOptional,
  MaxLength,
} from 'class-validator';

export class UpdateBanDanKakiKakiDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  banDepan?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  velgDepan?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  discBrake?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  masterRem?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  tieRod?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  gardan?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  banBelakang?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  velgBelakang?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  brakePad?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  crossmember?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  knalpot?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  balljoint?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  karetBoot?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  upperLowerArm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  shockBreaker?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  linkStabilizer?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  racksteer?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(1000, { each: true })
  catatan?: string[];
}
