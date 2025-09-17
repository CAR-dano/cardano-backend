/*
 * --------------------------------------------------------------------------
 * File: change-password.dto.ts
 * Project: car-dano-backend
 * --------------------------------------------------------------------------
 * Description: DTO for changing the password of the currently authenticated
 * user. Requires the existing password (unless none is set) and the desired
 * new password.
 * --------------------------------------------------------------------------
 */

import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({
    description:
      'Current password. Optional when no password has been set before.',
    minLength: 8,
    required: false,
  })
  @IsOptional()
  @IsString()
  currentPassword?: string;

  @ApiProperty({
    description: 'New password to be set for the account.',
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'Password must contain at least one letter and one number.',
  })
  newPassword!: string;
}
