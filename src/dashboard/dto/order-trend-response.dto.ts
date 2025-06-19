import { ApiProperty } from '@nestjs/swagger';

export class OrderTrendItemDto {
  @ApiProperty({
    description:
      'Label for the period (e.g., "00:00-02:00", "DD-MM-YYYY", "Jan")',
    example: '00:00-02:00',
  })
  period_label: string;

  @ApiProperty({
    description: 'Start of the period in ISO8601 UTC format',
    example: '2024-01-01T00:00:00Z',
  })
  period_start: Date;

  @ApiProperty({
    description: 'End of the period in ISO8601 UTC format',
    example: '2024-01-01T01:59:59Z',
  })
  period_end: Date;

  @ApiProperty({
    description: 'Total count of orders for the period',
    example: 150,
  })
  count: number;
}

export class OrderTrendSummaryDto {
  @ApiProperty({
    description: 'Total number of orders in the selected range',
    example: 1234,
  })
  total_orders: number;

  @ApiProperty({
    description: 'Actual start date used for the query in ISO8601 UTC format',
    example: '2024-01-01T00:00:00Z',
  })
  actual_start_date_used: string;

  @ApiProperty({
    description: 'Actual end date used for the query in ISO8601 UTC format',
    example: '2024-01-31T23:59:59Z',
  })
  actual_end_date_used: string;
}

export class OrderTrendResponseDto {
  @ApiProperty({
    description: 'Array of order trend data points',
    type: [OrderTrendItemDto],
  })
  data: OrderTrendItemDto[];

  @ApiProperty({
    description: 'Summary statistics for the order trend data',
    type: OrderTrendSummaryDto,
  })
  summary: OrderTrendSummaryDto;
}
