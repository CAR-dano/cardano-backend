/*
 * --------------------------------------------------------------------------
 * File: login-user.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Data Transfer Object (DTO) for user login requests.
 * Defines the structure of the data expected from the client when a user attempts to log in
 * using either their email or username and password.
 * --------------------------------------------------------------------------
 */

import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class LoginUserDto {
  /**
   * The user's registered email address OR username used for login.
   * Required for login.
   * @example "newuser@example.com" or "newuser123"
   */
  @ApiProperty({
    description: "User's email address OR username",
    example: 'user@example.com',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  loginIdentifier: string; // Use a generic name to accept email or username

  /**
   * The user's password.
   * Required for login.
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
  password: string;
}
