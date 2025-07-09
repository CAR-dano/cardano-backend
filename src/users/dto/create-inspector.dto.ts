/*
 * --------------------------------------------------------------------------
 * File: create-inspector.dto.ts
 * Project: cardano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Data Transfer Object (DTO) for creating a new inspector user.
 * Defines the required and optional fields for creating an inspector account.
 * --------------------------------------------------------------------------
 */

import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  Length,
  MinLength,
} from 'class-validator';

/**
 * DTO for creating a new inspector.
 */
export class CreateInspectorDto {
  /**
   * Email address of the inspector (must be unique).
   * @example 'inspector.john.doe@example.com'
   */
  @ApiProperty({
    description: 'Email address of the inspector (must be unique)',
    example: 'inspector.john.doe@example.com',
  })
  @IsNotEmpty()
  @IsEmail()
  @IsString()
  email: string;

  /**
   * Username for the inspector (must be unique).
   * @example 'inspector_johndoe'
   */
  @ApiProperty({
    description: 'Username for the inspector (must be unique)',
    example: 'inspector_johndoe',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(3)
  username: string;

  /**
   * Full name of the inspector.
   * @example 'John Doe'
   */
  @ApiProperty({
    description: 'Full name of the inspector',
    example: 'John Doe',
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  /**
   * Optional Cardano wallet address for the inspector (must be unique).
   * @example 'addr1q...xyz'
   */
  @ApiProperty({
    description:
      'Optional Cardano wallet address for the inspector (must be unique)',
    example: 'addr1q...xyz',
    required: false,
  })
  @IsOptional()
  @IsString()
  walletAddress?: string;

  @ApiProperty({
    description: 'Optional PIN for the inspector (6 digits number)',
    example: '123456',
    required: false,
  })
  @IsOptional()
  @IsNumberString()
  @Length(6, 6, { message: 'PIN must be a 6-digit number' })
  pin?: string;
}
