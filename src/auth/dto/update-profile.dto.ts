/*
 * --------------------------------------------------------------------------
 * File: update-profile.dto.ts
 * Project: car-dano-backend
 * --------------------------------------------------------------------------
 * Description: DTO for updating the profile information of the currently
 * authenticated user (self-service).
 * --------------------------------------------------------------------------
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({
    description: 'Updated display name for the user',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({
    description: 'Updated WhatsApp number (E.164 or local formatting)',
    maxLength: 32,
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  whatsappNumber?: string;
}
