import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class HttpErrorResponseDto {
  @ApiProperty({ example: 400, description: 'HTTP status code' })
  statusCode!: number;

  @ApiProperty({
    oneOf: [
      { type: 'string', example: 'Bad Request' },
      { type: 'array', items: { type: 'string' }, example: ['field is required'] },
    ],
    description: 'Error message (string or array of messages)',
  })
  message!: string | string[];

  @ApiProperty({ example: 'Bad Request', description: 'Error type summary' })
  error!: string;

  @ApiPropertyOptional({ example: '/admin/credit-packages', description: 'Request path' })
  path?: string;

  @ApiPropertyOptional({ example: '2025-01-01T00:00:00.000Z', description: 'Error timestamp (ISO)' })
  timestamp?: string;
}

