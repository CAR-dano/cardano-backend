import { ApiProperty } from '@nestjs/swagger';

export class TransmissionTypeDistributionItemDto {
  @ApiProperty({
    description: 'Type of transmission (e.g., Manual, Otomatis)',
    example: 'Manual',
  })
  type: string;

  @ApiProperty({
    description: 'Number of inspections for this transmission type',
    example: 600,
  })
  count: number;
}

export class TransmissionTypeDistributionResponseDto {
  @ApiProperty({
    description: 'List of transmission type distribution items',
    type: [TransmissionTypeDistributionItemDto],
  })
  data: TransmissionTypeDistributionItemDto[];
}
