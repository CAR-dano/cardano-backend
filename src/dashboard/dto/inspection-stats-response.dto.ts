import { ApiProperty } from '@nestjs/swagger';

export class InspectionStatsPeriodData {
  @ApiProperty({ description: 'Total number of inspections' })
  total: number;

  @ApiProperty({ description: 'Number of approved inspections' })
  approved: number;

  @ApiProperty({ description: 'Number of inspections needing review' })
  needReview: number;

  @ApiProperty({
    description: 'Percentage of inspections reviewed (approved out of total)',
  })
  percentageReviewed: string;
}

export class InspectionStatsResponseDto {
  @ApiProperty({
    type: InspectionStatsPeriodData,
    description: 'Statistics for all time',
  })
  allTime: InspectionStatsPeriodData;

  @ApiProperty({
    type: InspectionStatsPeriodData,
    description: 'Statistics for the current month',
  })
  thisMonth: InspectionStatsPeriodData;

  @ApiProperty({
    type: InspectionStatsPeriodData,
    description: 'Statistics for the current week',
  })
  thisWeek: InspectionStatsPeriodData;

  @ApiProperty({
    type: InspectionStatsPeriodData,
    description: 'Statistics for today',
  })
  today: InspectionStatsPeriodData;
}
