/*
 * --------------------------------------------------------------------------
 * File: update-inspector.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Defines the data transfer object (DTO) for updating an
 * existing inspector user. This DTO includes properties that can be
 * modified by an admin, such as username, email, and wallet address.
 * It uses class-validator decorators to enforce validation rules.
 * --------------------------------------------------------------------------
 */
import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsOptional,
  MinLength,
  Matches,
  Length,
} from 'class-validator';

export class UpdateInspectorDto {
  @ApiProperty({
    description: "The inspector's full name",
    example: 'John Doe',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    description: "The inspector's username",
    example: 'john.doe',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  username?: string;

  @ApiProperty({
    description: "The inspector's email address",
    example: 'john.doe@example.com',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    description: "The inspector's wallet address",
    example: 'addr1q9... (Cardano address)',
    required: false,
  })
  @IsOptional()
  @IsString()
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
  @IsString()
  inspectionBranchCityId?: string;
}
