/*
 * --------------------------------------------------------------------------
 * File: login-inspector.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: DTO for inspector login requests using a PIN and email.
 * --------------------------------------------------------------------------
 */
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Length, IsEmail } from 'class-validator';

export class LoginInspectorDto {
  @ApiProperty({
    description: "Inspector's unique 6-digit PIN",
    example: '123456',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'PIN must be exactly 6 digits' })
  pin: string;

  @ApiProperty({
    description: "Inspector's email address",
    example: 'inspector@example.com',
    required: true,
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
