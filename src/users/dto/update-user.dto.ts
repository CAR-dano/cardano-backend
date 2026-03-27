/*
 * --------------------------------------------------------------------------
 * File: update-user.dto.ts
 * Project: cardano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Data Transfer Object (DTO) for updating an existing user's information.
 * --------------------------------------------------------------------------
 */

import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { sanitizeString } from '../../common/sanitize.helper';

/**
 * DTO for updating an existing user.
 */
export class UpdateUserDto {
  /**
   * Optional updated email address for the user (must be unique).
   * @example 'updated.john.doe@example.com'
   */
  @ApiProperty({
    description: 'Optional updated email address for the user (must be unique)',
    example: 'updated.john.doe@example.com',
    required: false,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @IsString()
  @MaxLength(255)
  email?: string;

  /**
   * Optional updated username for the user (must be unique, min 3 chars).
   * @example 'updated_johndoe'
   */
  @ApiProperty({
    description: 'Optional updated username for the user (must be unique)',
    example: 'updated_johndoe',
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
    message: 'username may only contain letters, numbers, and underscores',
  })
  username?: string;

  /**
   * Optional updated full name of the user.
   * @example 'John Doe Updated'
   */
  @ApiProperty({
    description: 'Optional updated full name of the user',
    example: 'John Doe Updated',
    required: false,
  })
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => sanitizeString(value) || undefined,
  )
  @IsString()
  @MaxLength(255)
  name?: string;

  /**
   * Optional updated Cardano wallet address for the user (must be unique).
   * Must start with a Cardano bech32 prefix: addr1, addr_test1, stake1, or stake_test1.
   * @example 'addr1q...xyz_updated'
   */
  @ApiProperty({
    description:
      'Optional updated Cardano wallet address for the user (must be unique)',
    example: 'addr1q...xyz_updated',
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

  /**
   * Optional 6-digit numeric PIN for the user.
   * @example '654321'
   */
  @ApiProperty({
    description: 'Optional PIN for the user (exactly 6 digits)',
    example: '654321',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @Matches(/^\d{6}$/, { message: 'PIN must be exactly 6 digits (0-9)' })
  pin?: string;

  @ApiProperty({
    description: 'Optional refresh token for the user',
    example: 'some_refresh_token',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  // Refresh tokens (JWT or opaque) are bounded in length
  @MaxLength(512, { message: 'refreshToken must not exceed 512 characters' })
  refreshToken?: string;
}
