/*
 * --------------------------------------------------------------------------
 * File: inspector-response.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: DTO for responding to an inspector creation request.
 * Extends the base UserResponseDto to include the generated plaintext PIN.
 * --------------------------------------------------------------------------
 */

import { ApiProperty } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { UserResponseDto } from './user-response.dto';

/**
 * DTO for responding to an inspector creation request, including the PIN.
 */
export class InspectorResponseDto extends UserResponseDto {
  /**
   * The generated plaintext PIN for the new inspector.
   * This is only returned immediately after creation.
   * @example "123456"
   */
  @ApiProperty({
    description:
      'The generated plaintext PIN for the new inspector. Only returned on creation.',
    example: '123456',
  })
  pin: string;

  /**
   * Constructor to map from a Prisma User entity and include the plain PIN.
   * @param user The Prisma User entity.
   * @param plainPin The generated plaintext PIN.
   */
  constructor(user: User, plainPin: string) {
    super(user);
    this.pin = plainPin;
  }
}
