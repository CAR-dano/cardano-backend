import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UpdateEstimasiPerbaikanDto } from './update-estimasi-perbaikan.dto';

export class UpdateInspectionSummaryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  interiorScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interiorNotes?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  eksteriorScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  eksteriorNotes?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  kakiKakiScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  kakiKakiNotes?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  mesinScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mesinNotes?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  penilaianKeseluruhanScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  deskripsiKeseluruhan?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  indikasiTabrakan?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  indikasiBanjir?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  indikasiOdometerReset?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  posisiBan?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  merkban?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tipeVelg?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ketebalanBan?: string;

  @ApiPropertyOptional({ type: [UpdateEstimasiPerbaikanDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateEstimasiPerbaikanDto)
  estimasiPerbaikan?: UpdateEstimasiPerbaikanDto[];
}
