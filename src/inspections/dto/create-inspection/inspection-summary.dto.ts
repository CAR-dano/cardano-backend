/*
 * --------------------------------------------------------------------------
 * File: inspection-summary.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 */
import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsBoolean,
  IsArray,
  ArrayMaxSize,
  ValidateNested,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { EstimasiPerbaikanDto } from './estimasi-perbaikan.dto';
import { sanitizeString, sanitizeStringArray } from '../../../common/sanitize.helper';

export class InspectionSummaryDto {
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  @Max(100)
  interiorScore!: number;

  @ApiProperty({ required: false })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(1000, { each: true })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => sanitizeStringArray(value))
  interiorNotes?: string[];

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  @Max(100)
  eksteriorScore!: number;

  @ApiProperty({ required: false })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(1000, { each: true })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => sanitizeStringArray(value))
  eksteriorNotes?: string[];

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  @Max(100)
  kakiKakiScore!: number;

  @ApiProperty({ required: false })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(1000, { each: true })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => sanitizeStringArray(value))
  kakiKakiNotes?: string[];

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  @Max(100)
  mesinScore!: number;

  @ApiProperty({ required: false })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(1000, { each: true })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => sanitizeStringArray(value))
  mesinNotes?: string[];

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  @Max(100)
  penilaianKeseluruhanScore!: number;

  @ApiProperty({ required: false })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(2000, { each: true })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => sanitizeStringArray(value))
  deskripsiKeseluruhan?: string[];

  @ApiProperty()
  @IsBoolean()
  @IsNotEmpty()
  indikasiTabrakan!: boolean;

  @ApiProperty()
  @IsBoolean()
  @IsNotEmpty()
  indikasiBanjir!: boolean;

  @ApiProperty()
  @IsBoolean()
  @IsNotEmpty()
  indikasiOdometerReset!: boolean;

  @ApiProperty()
  @Transform(({ value }: { value: unknown }) => sanitizeString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  posisiBan!: string;

  @ApiProperty()
  @Transform(({ value }: { value: unknown }) => sanitizeString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  merkban!: string;

  @ApiProperty()
  @Transform(({ value }: { value: unknown }) => sanitizeString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  tipeVelg!: string;

  @ApiProperty()
  @Transform(({ value }: { value: unknown }) => sanitizeString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  ketebalanBan!: string;

  @ApiProperty({ type: [EstimasiPerbaikanDto], required: false })
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => EstimasiPerbaikanDto)
  @IsOptional()
  estimasiPerbaikan?: EstimasiPerbaikanDto[];
}
