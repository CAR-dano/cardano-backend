/*
 * --------------------------------------------------------------------------
 * File: login-user.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Data Transfer Object (DTO) for user login requests.
 * --------------------------------------------------------------------------
 */

import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class LoginUserDto {
  /**
   * The user's registered email address OR username used for login.
   * @example "newuser@example.com" or "newuser123"
   */
  @ApiProperty({
    description: "User's email address OR username",
    example: 'user@example.com',
    required: true,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  loginIdentifier!: string;

  /**
   * The user's password.
   * @example "P@sswOrd123!"
   */
  @ApiProperty({
    description: "User's password",
    example: 'P@sswOrd123!',
    required: true,
    type: String,
    format: 'password',
  })
  @IsString()
  @IsNotEmpty()
  // MaxLength prevents bcrypt DoS attack via extremely long password strings
  @MaxLength(72, { message: 'password must not exceed 72 characters' })
  password!: string;
}
