/*
 * --------------------------------------------------------------------------
 * File: update-user.dto.ts
 * Project: cardano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Data Transfer Object (DTO) for updating an existing user's information.
 * Defines the optional fields that can be updated for a user.
 * --------------------------------------------------------------------------
 */

import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

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
  @IsEmail()
  @IsString()
  email?: string;

  /**
   * Optional updated username for the user (must be unique).
   * @example 'updated_johndoe'
   */
  @ApiProperty({
    description: 'Optional updated username for the user (must be unique)',
    example: 'updated_johndoe',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
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
  @IsString()
  name?: string;

  /**
   * Optional updated Cardano wallet address for the user (must be unique).
   * @example 'addr1q...xyz_updated'
   */
  @ApiProperty({
    description:
      'Optional updated Cardano wallet address for the user (must be unique)',
    example: 'addr1q...xyz_updated',
    required: false,
  })
  @IsOptional()
  @IsString()
  walletAddress?: string;

  @ApiProperty({
    description: 'Optional PIN for the user (6 digits)',
    example: '654321',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(6)
  pin?: string;

  @ApiProperty({
    description: 'Optional refresh token for the user',
    example: 'some_refresh_token',
    required: false,
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}