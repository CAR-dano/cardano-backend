/*
 * --------------------------------------------------------------------------
 * File: register-user.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Data Transfer Object (DTO) for user registration requests.
 * --------------------------------------------------------------------------
 */

import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsNotEmpty,
  IsOptional,
  Matches,
} from 'class-validator';
import { sanitizeString } from '../../common/sanitize.helper';

export class RegisterUserDto {
  /**
   * The user's email address. Must be a valid email format and unique.
   * @example "newuser@example.com"
   */
  @ApiProperty({
    description: "User's unique email address",
    example: 'newuser@example.com',
    required: true,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  email: string;

  /**
   * The user's desired username. Must be unique, 3-20 chars, alphanumeric + underscore.
   * @example "newuser123"
   */
  @ApiProperty({
    description: "User's unique username (alphanumeric + underscores, 3-20 chars)",
    example: 'newuser123',
    minLength: 3,
    maxLength: 20,
    pattern: '^[a-zA-Z0-9_]+$',
    required: true,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(20)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username can only contain alphanumeric characters and underscores.',
  })
  username: string;

  /**
   * The user's chosen password. Minimum 8 characters. Will be hashed before storage.
   * @example "P@sswOrd123!"
   */
  @ApiProperty({
    description: "User's password (will be hashed). Minimum 8 characters.",
    example: 'P@sswOrd123!',
    minLength: 8,
    required: true,
    type: String,
    format: 'password',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(255)
  password: string;

  /**
   * The user's display name. Optional during registration.
   * @example "John Doe"
   */
  @ApiProperty({
    description: "User's display name (optional)",
    example: 'John Doe',
    required: false,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => sanitizeString(value) || undefined)
  @IsString()
  @IsNotEmpty({ message: 'Name cannot be an empty string if provided' })
  @MaxLength(255)
  name?: string;

  /**
   * The user's primary Cardano wallet address. Optional during registration.
   * Must start with a Cardano bech32 prefix: addr1, addr_test1, stake1, or stake_test1.
   * @example "addr1..."
   */
  @ApiProperty({
    description: "User's primary Cardano wallet address (optional)",
    example: 'addr1qx2k8q9p5z4z...',
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
}
