/*
 * --------------------------------------------------------------------------
 * File: http-error-response.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Standardized error response DTO for Swagger/OpenAPI
 * documentation. Matches the shape produced by AllExceptionsFilter.
 * --------------------------------------------------------------------------
 */

import { ApiProperty } from '@nestjs/swagger';

export class HttpErrorResponseDto {
  @ApiProperty({ example: 400, description: 'HTTP status code.' })
  statusCode!: number;

  @ApiProperty({
    example: ['Validation failed', 'vehiclePlateNumber must be a string'],
    description: 'Array of human-readable error messages.',
    isArray: true,
    type: String,
  })
  message!: string[];

  @ApiProperty({ example: 'Bad Request', description: 'Error name/label.' })
  error!: string;

  @ApiProperty({
    example: 'GEN-006',
    description:
      'Machine-readable error code for programmatic error identification. See ErrorCode enum for all codes.',
  })
  errorCode!: string;

  @ApiProperty({
    example: '/api/v1/inspections',
    description: 'Request path that triggered the error.',
  })
  path!: string;

  @ApiProperty({
    example: '2025-09-15T12:34:56.789Z',
    description: 'ISO timestamp of when the error occurred.',
  })
  timestamp!: string;
}
