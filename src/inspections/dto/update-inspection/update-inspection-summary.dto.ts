import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsBoolean,
  IsArray,
  ArrayMaxSize,
  ValidateNested,
  IsOptional,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { UpdateEstimasiPerbaikanDto } from './update-estimasi-perbaikan.dto';
import {
  sanitizeString,
  sanitizeStringArray,
} from '../../../common/sanitize.helper';

export class UpdateInspectionSummaryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  interiorScore?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  eksteriorScore?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  kakiKakiScore?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  mesinScore?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  penilaianKeseluruhanScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(1000, { each: true })
  @Transform(({ value }: { value: unknown }) => sanitizeStringArray(value))
  interiorNotes?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(1000, { each: true })
  @Transform(({ value }: { value: unknown }) => sanitizeStringArray(value))
  eksteriorNotes?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(1000, { each: true })
  @Transform(({ value }: { value: unknown }) => sanitizeStringArray(value))
  kakiKakiNotes?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(1000, { each: true })
  @Transform(({ value }: { value: unknown }) => sanitizeStringArray(value))
  mesinNotes?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(2000, { each: true })
  @Transform(({ value }: { value: unknown }) => sanitizeStringArray(value))
  deskripsiKeseluruhan?: string[];

  @ApiPropertyOptional() @IsOptional() @IsBoolean() indikasiTabrakan?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() indikasiBanjir?: boolean;
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  indikasiOdometerReset?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => sanitizeString(value) || undefined,
  )
  @IsString()
  @MaxLength(255)
  posisiBan?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => sanitizeString(value) || undefined,
  )
  @IsString()
  @MaxLength(255)
  merkban?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => sanitizeString(value) || undefined,
  )
  @IsString()
  @MaxLength(255)
  tipeVelg?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => sanitizeString(value) || undefined,
  )
  @IsString()
  @MaxLength(255)
  ketebalanBan?: string;

  @ApiPropertyOptional({ type: [UpdateEstimasiPerbaikanDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => UpdateEstimasiPerbaikanDto)
  estimasiPerbaikan?: UpdateEstimasiPerbaikanDto[];
}
