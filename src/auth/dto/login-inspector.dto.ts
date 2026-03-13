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
import { Transform } from 'class-transformer';
import { IsString, IsNotEmpty, Length, IsEmail, Matches, MaxLength } from 'class-validator';

export class LoginInspectorDto {
  @ApiProperty({
    description: "Inspector's unique 6-digit PIN",
    example: '123456',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'PIN must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'PIN must contain only digits' })
  pin!: string;

  @ApiProperty({
    description: "Inspector's email address",
    example: 'inspector@example.com',
    required: true,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  email!: string;
}
