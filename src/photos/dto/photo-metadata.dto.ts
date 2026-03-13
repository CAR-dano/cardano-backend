/*
 * --------------------------------------------------------------------------
 * File: photo-metadata.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Data Transfer Object for a single photo's metadata within a batch upload.
 * Used for validation after parsing the metadata JSON string.
 * --------------------------------------------------------------------------
 */
import { IsString, IsOptional, MaxLength, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { sanitizeString } from '../../common/sanitize.helper';

export class PhotoMetadataDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => sanitizeString(value))
  @IsString()
  @MaxLength(255)
  label?: string;

  @IsOptional()
  @IsBoolean()
  needAttention?: boolean;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => sanitizeString(value))
  @IsString()
  @MaxLength(255)
  category?: string;

  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;
}
