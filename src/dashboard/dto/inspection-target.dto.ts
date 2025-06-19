/*
 * --------------------------------------------------------------------------
 * File: inspection-target.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Data Transfer Object for representing an InspectionTarget.
 * --------------------------------------------------------------------------
 */
import { ApiProperty } from '@nestjs/swagger';
import { TargetPeriod } from '@prisma/client';

export class InspectionTargetDto {
  @ApiProperty({
    description: 'Unique identifier of the inspection target',
    example: 'clx0x0x0x0x0x0x0x0x0x0x0',
  })
  id: string;

  @ApiProperty({
    description: 'The target number of inspections',
    example: 100,
  })
  targetValue: number;

  @ApiProperty({
    description: 'The period for which the target is set (month, week, or day)',
    enum: TargetPeriod,
    example: TargetPeriod.MONTH,
  })
  period: TargetPeriod;

  @ApiProperty({
    description: 'The date for which the target is set (YYYY-MM-DD)',
    example: '2025-05-01T00:00:00.000Z',
  })
  targetDate: Date;

  @ApiProperty({
    description: 'Timestamp when the target was created',
    example: '2025-05-28T10:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Timestamp when the target was last updated',
    example: '2025-05-28T10:00:00.000Z',
  })
  updatedAt: Date;
}
