import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsDate,
  IsOptional,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { sanitizeString } from '../../../common/sanitize.helper';

export class UpdateVehicleDataDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => sanitizeString(value) || undefined)
  @IsString()
  @MaxLength(255)
  merekKendaraan?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => sanitizeString(value) || undefined)
  @IsString()
  @MaxLength(255)
  tipeKendaraan?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1900, { message: 'tahun must be 1900 or later' })
  @Max(new Date().getFullYear() + 1, { message: 'tahun cannot be in the future' })
  tahun?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => sanitizeString(value) || undefined)
  @IsString()
  @MaxLength(255)
  transmisi?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => sanitizeString(value) || undefined)
  @IsString()
  @MaxLength(255)
  warnaKendaraan?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => sanitizeString(value) || undefined)
  @IsString()
  @MaxLength(255)
  odometer?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => sanitizeString(value) || undefined)
  @IsString()
  @MaxLength(255)
  kepemilikan?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => sanitizeString(value) || undefined)
  @IsString()
  @MaxLength(20)
  platNomor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  pajak1Tahun?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  pajak5Tahun?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'biayaPajak must be a non-negative number' })
  biayaPajak?: number;
}
