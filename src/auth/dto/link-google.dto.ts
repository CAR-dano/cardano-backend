/*
 * --------------------------------------------------------------------------
 * File: link-google.dto.ts
 * Project: car-dano-backend
 * --------------------------------------------------------------------------
 * Description: DTO for linking a Google account to the currently
 * authenticated user using an ID token obtained from Google Sign-In.
 * --------------------------------------------------------------------------
 */

import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LinkGoogleDto {
  @ApiProperty({
    description: 'Google ID token obtained from the client-side OAuth flow',
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6Ijg2ZD...',
  })
  @IsString()
  @IsNotEmpty()
  idToken!: string;
}
