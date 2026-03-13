/*
 * --------------------------------------------------------------------------
 * File: create-admin.dto.ts
 * Project: cardano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Data Transfer Object (DTO) for creating a new admin user.
 * --------------------------------------------------------------------------
 */

import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { Role } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import { sanitizeString } from '../../common/sanitize.helper';

export class CreateAdminDto {
  @ApiProperty({
    description: 'The username for the new user (alphanumeric + underscores, 3-50 chars).',
    example: 'newadmin',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'username can only contain alphanumeric characters and underscores.',
  })
  username!: string;

  @ApiProperty({
    description: 'The email address for the new user.',
    example: 'newadmin@example.com',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  email!: string;

  @ApiProperty({
    description: 'The full name of the new user.',
    example: 'New Admin',
    required: false,
  })
  @IsNotEmpty()
  @Transform(({ value }: { value: unknown }) => sanitizeString(value))
  @IsString()
  @MaxLength(255)
  name!: string;

  @ApiProperty({
    description:
      'The password for the new user. Minimum 12 characters. ' +
      'Must contain uppercase, lowercase, digit, and special character.',
    example: 'P@sswOrd123!',
  })
  @IsString()
  @MinLength(12, { message: 'password must be at least 12 characters' })
  // MaxLength 72 prevents bcrypt DoS (bcrypt silently truncates beyond 72 bytes)
  @MaxLength(72, { message: 'password must not exceed 72 characters' })
  @IsNotEmpty()
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&\-_#^()[\]{}|~`<>,.;:'"\\\/+= ])[A-Za-z\d@$!%*?&\-_#^()[\]{}|~`<>,.;:'"\\\/+= ]{12,}$/,
    {
      message:
        'password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    },
  )
  password!: string;

  @ApiProperty({
    description: 'The role to assign to the new user.',
    enum: [Role.ADMIN, Role.SUPERADMIN],
    example: Role.ADMIN,
  })
  @IsIn([Role.ADMIN, Role.SUPERADMIN])
  @IsNotEmpty()
  role!: Role;
}
