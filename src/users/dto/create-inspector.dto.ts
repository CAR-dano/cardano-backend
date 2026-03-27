/*
 * --------------------------------------------------------------------------
 * File: create-inspector.dto.ts
 * Project: cardano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Data Transfer Object (DTO) for creating a new inspector user.
 * --------------------------------------------------------------------------
 */

import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { sanitizeString } from '../../common/sanitize.helper';

export class CreateInspectorDto {
  /**
   * Email address of the inspector (must be unique).
   * @example 'inspector.john.doe@example.com'
   */
  @ApiProperty({
    description: 'Email address of the inspector (must be unique)',
    example: 'inspector.john.doe@example.com',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsNotEmpty()
  @IsEmail()
  @IsString()
  @MaxLength(255)
  email!: string;

  /**
   * Username for the inspector (must be unique, min 3 chars, alphanumeric + underscore).
   * @example 'inspector_johndoe'
   */
  @ApiProperty({
    description:
      'Username for the inspector (must be unique, alphanumeric + underscores, 3-50 chars)',
    example: 'inspector_johndoe',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsNotEmpty()
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message:
      'username can only contain alphanumeric characters and underscores.',
  })
  username!: string;

  /**
   * Full name of the inspector.
   * @example 'John Doe'
   */
  @ApiProperty({
    description: 'Full name of the inspector',
    example: 'John Doe',
  })
  @IsNotEmpty()
  @Transform(({ value }: { value: unknown }) => sanitizeString(value))
  @IsString()
  @MaxLength(255)
  name!: string;

  /**
   * Optional Cardano wallet address for the inspector (must be unique).
   * Must start with a Cardano bech32 prefix: addr1, addr_test1, stake1, or stake_test1.
   * @example 'addr1q...xyz'
   */
  @ApiProperty({
    description:
      'Optional Cardano wallet address for the inspector (must be unique)',
    example: 'addr1q...xyz',
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
   * Optional WhatsApp number. Must start with +62 and be 12-16 digits total.
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
  @IsUUID('4', { message: 'inspectionBranchCityId must be a valid UUID v4' })
  inspectionBranchCityId!: string;
}
