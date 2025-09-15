import { ApiProperty } from '@nestjs/swagger';

export class HttpErrorResponseDto {
  @ApiProperty({ example: 400, description: 'HTTP status code.' })
  statusCode: number;

  @ApiProperty({
    example: ['Validation failed', 'vehiclePlateNumber must be a string'],
    description: 'Array of human-readable error messages.',
    isArray: true,
    type: String,
  })
  message: string[];

  @ApiProperty({ example: 'Bad Request', description: 'Error name/label.' })
  error: string;

  @ApiProperty({ example: '/inspections', description: 'Request path.' })
  path: string;

  @ApiProperty({
    example: '2025-09-15T12:34:56.789Z',
    description: 'ISO timestamp of when the error occurred.',
  })
  timestamp: string;
}

