/*
 * --------------------------------------------------------------------------
 * File: generate-pin-response.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Defines the data transfer object (DTO) for the response
 * when generating a new PIN for an inspector. It includes the inspector's
 * data and the newly generated PIN.
 * --------------------------------------------------------------------------
 */
import { ApiProperty } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { UserResponseDto } from './user-response.dto';

export class GeneratePinResponseDto extends UserResponseDto {
  @ApiProperty({
    description: 'The newly generated PIN for the inspector',
    example: '123456',
  })
  pin: string;

  constructor(user: User, pin: string) {
    super(user);
    this.pin = pin;
  }
}
