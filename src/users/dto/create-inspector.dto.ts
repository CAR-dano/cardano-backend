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
  IsOptional,
  IsString,
  Length,
  Matches,
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

  /**
   * Optional WhatsApp number for the inspector. Must start with +62 and be between 12-16 digits.
   * @example '+6281234567890'
   */
  @ApiProperty({
    description:
      'Optional WhatsApp number for the inspector. Must start with +62.',
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

  /**
   * The ID of the inspection branch city.
   * @example 'a1b2c3d4-e5f6-7890-1234-567890abcdef'
   */
  @ApiProperty({
    description: 'The ID of the inspection branch city',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  @IsNotEmpty()
  @IsString()
  inspectionBranchCityId: string;
}
