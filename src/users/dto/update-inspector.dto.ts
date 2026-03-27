/*
 * --------------------------------------------------------------------------
 * File: update-inspector.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Defines the data transfer object (DTO) for updating an
 * existing inspector user.
 * --------------------------------------------------------------------------
 */
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsString,
  IsEmail,
  IsOptional,
  MinLength,
  Matches,
  Length,
  IsBoolean,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { sanitizeString } from '../../common/sanitize.helper';

export class UpdateInspectorDto {
  @ApiProperty({
    description: "The inspector's full name",
    example: 'John Doe',
    required: false,
  })
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => sanitizeString(value) || undefined,
  )
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiProperty({
    description:
      "The inspector's username (alphanumeric + underscores, 3-50 chars)",
    example: 'john_doe',
    required: false,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message:
      'username can only contain alphanumeric characters and underscores.',
  })
  username?: string;

  @ApiProperty({
    description: "The inspector's email address",
    example: 'john.doe@example.com',
    required: false,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiProperty({
    description: "The inspector's Cardano wallet address",
    example: 'addr1q9... (Cardano address)',
    required: false,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(255)
  @Matches(/^(addr1|addr_test1|stake1|stake_test1)[a-z0-9]+$/, {
    message:
      'walletAddress must be a valid Cardano bech32 address (addr1…, addr_test1…, stake1…, or stake_test1…)',
  })
  walletAddress?: string;

  @ApiProperty({
    description:
      "The inspector's WhatsApp number. Must start with +62 and be between 12-16 digits.",
    example: '+6281234567890',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(/^\+62\d+$/, {
    message: 'WhatsApp number must start with +62 and only contain digits.',
  })
  @Length(12, 16, {
    message: 'WhatsApp number must be between 12 and 16 characters long.',
  })
  whatsappNumber?: string;

  @ApiProperty({
    description: 'The ID of the inspection branch city',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    required: false,
  })
  @IsOptional()
  @IsUUID('4', { message: 'inspectionBranchCityId must be a valid UUID v4' })
  inspectionBranchCityId?: string;

  @ApiProperty({
    description: 'Set the user account to active or inactive',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
