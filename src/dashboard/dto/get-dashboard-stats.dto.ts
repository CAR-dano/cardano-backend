import { IsString, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GetDashboardStatsDto {
  @ApiProperty({
    description:
      'Start date for custom range (YYYY-MM-DD). Required if range_type is custom.',
    example: '2024-01-01',
    required: false,
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'start_date must be a valid date string in YYYY-MM-DD format' },
  )
  start_date?: string;

  @ApiProperty({
    description:
      'End date for custom range (YYYY-MM-DD). Required if range_type is custom.',
    example: '2024-01-31',
    required: false,
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'end_date must be a valid date string in YYYY-MM-DD format' },
  )
  end_date?: string;

  @ApiProperty({
    description:
      'Timezone for date calculations (e.g., "Asia/Jakarta"). Defaults to "Asia/Jakarta".',
    example: 'Asia/Jakarta',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'timezone must be a string' })
  timezone?: string = 'Asia/Jakarta';
}
