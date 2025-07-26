import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsNotEmpty,
  IsOptional,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EstimasiPerbaikanDto } from './estimasi-perbaikan.dto';

export class InspectionSummaryDto {
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  interiorScore: number;

  @ApiProperty({ required: false })
  @IsArray()
  @IsString({ each: true })
  @MaxLength(1000, { each: true })
  @IsOptional()
  interiorNotes?: string[];

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  eksteriorScore: number;

  @ApiProperty({ required: false })
  @IsArray()
  @IsString({ each: true })
  @MaxLength(1000, { each: true })
  @IsOptional()
  eksteriorNotes?: string[];

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  kakiKakiScore: number;

  @ApiProperty({ required: false })
  @IsArray()
  @IsString({ each: true })
  @MaxLength(1000, { each: true })
  @IsOptional()
  kakiKakiNotes?: string[];

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  mesinScore: number;

  @ApiProperty({ required: false })
  @IsArray()
  @IsString({ each: true })
  @MaxLength(1000, { each: true })
  @IsOptional()
  mesinNotes?: string[];

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  penilaianKeseluruhanScore: number;

  @ApiProperty({ required: false })
  @IsArray()
  @IsString({ each: true })
  @MaxLength(2000, { each: true })
  @IsOptional()
  deskripsiKeseluruhan?: string[];

  @ApiProperty()
  @IsBoolean()
  @IsNotEmpty()
  indikasiTabrakan: boolean;

  @ApiProperty()
  @IsBoolean()
  @IsNotEmpty()
  indikasiBanjir: boolean;

  @ApiProperty()
  @IsBoolean()
  @IsNotEmpty()
  indikasiOdometerReset: boolean;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  posisiBan: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  merkban: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  tipeVelg: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  ketebalanBan: string;

  @ApiProperty({ type: [EstimasiPerbaikanDto], required: false })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EstimasiPerbaikanDto)
  @IsOptional()
  estimasiPerbaikan?: EstimasiPerbaikanDto[];
}
