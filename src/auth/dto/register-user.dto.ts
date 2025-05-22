/*
 * --------------------------------------------------------------------------
 * File: register-user.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Data Transfer Object (DTO) for user registration requests.
 * Defines the structure of the data expected from the client when a new user attempts to register.
 * Includes fields for email, username, password, and optional fields like name and wallet address.
 * --------------------------------------------------------------------------
 */

import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsNotEmpty,
  IsOptional,
  Matches,
} from 'class-validator';

export class RegisterUserDto {
  /**
   * The user's email address. Must be a valid email format and unique.
   * Required for this registration type.
   * @example "newuser@example.com"
   */
  @ApiProperty({
    description: "User's unique email address",
    example: 'newuser@example.com',
    required: true,
  })
  @IsEmail() // Validates if the string is an email
  @IsNotEmpty() // Ensures the field is not empty
  email: string;

  /**
   * The user's desired username. Must be unique.
   * Required for this registration type.
   * Should meet certain criteria (e.g., length, allowed characters).
   * @example "newuser123"
   */
  @ApiProperty({
    description: "User's unique username (e.g., alphanumeric, 3-20 characters)",
    example: 'newuser123',
    minLength: 3,
    maxLength: 20,
    pattern: '^[a-zA-Z0-9_]+$', // Example pattern: alphanumeric and underscores only
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3) // Example: minimum length validation
  @MaxLength(20) // Example: maximum length validation
  @Matches(/^[a-zA-Z0-9_]+$/, {
    // Example: regex validation
    message:
      'Username can only contain alphanumeric characters and underscores.',
  })
  username: string;

  /**
   * The user's chosen password.
   * Required for this registration type. Should meet complexity requirements.
   * The actual password will be hashed before storing.
   * @example "P@sswOrd123!"
   */
  @ApiProperty({
    description: "User's password (will be hashed). Minimum 8 characters.",
    example: 'P@sswOrd123!',
    minLength: 8, // Enforce minimum length
    required: true,
    type: String, // Explicitly set type for Swagger
    format: 'password', // Hint for UI tools
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8) // Enforce minimum password length
  // Add more complex password rules here if needed (e.g., using @Matches)
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
  @IsOptional() // Decorator indicating the field can be omitted
  @IsString()
  @IsNotEmpty({ message: 'Name cannot be an empty string if provided' }) // Prevent empty string if sent
  name?: string;

  /**
   * The user's primary Cardano wallet address. Optional during registration.
   * @example "addr1..."
   */
  @ApiProperty({
    description: "User's primary Cardano wallet address (optional)",
    example: 'addr1qx2k8q9p5z4z...',
    required: false,
  })
  @IsOptional()
  @IsString()
  // Add specific Cardano address validation if available/needed
  walletAddress?: string;
}
