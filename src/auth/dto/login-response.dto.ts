/*
 * --------------------------------------------------------------------------
 * File: login-response.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Data Transfer Object (DTO) for the login response.
 * Defines the structure of the data returned to the client upon successful authentication,
 * including the access token and authenticated user details.
 * --------------------------------------------------------------------------
 */

import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '../../users/dto/user-response.dto'; // Import User DTO

export class LoginResponseDto {
  /**
   * The JSON Web Token (JWT) used for authenticating subsequent requests.
   * Include this token in the 'Authorization: Bearer <token>' header.
   */
  @ApiProperty({
    description: 'JWT access token for subsequent authenticated requests',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  /**
   * Details of the authenticated user (excluding sensitive information).
   */
  @ApiProperty({
    description: 'Authenticated user details',
    type: UserResponseDto, // Use the existing DTO for user details
  })
  user: UserResponseDto;
}
