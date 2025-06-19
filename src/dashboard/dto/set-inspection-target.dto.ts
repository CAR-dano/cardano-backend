/*
 * --------------------------------------------------------------------------
 * File: set-inspection-target.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Data Transfer Object for setting inspection targets.
 * --------------------------------------------------------------------------
 */
import { IsEnum, IsInt, IsNotEmpty, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TargetPeriod } from '@prisma/client';

export class SetInspectionTargetDto {
  @ApiProperty({
    description: 'The period for which the target is set (month, week, or day)',
    enum: TargetPeriod,
    example: TargetPeriod.MONTH,
  })
  @IsNotEmpty()
  @IsEnum(TargetPeriod)
  period: TargetPeriod;

  @ApiProperty({
    description: 'The target number of inspections for the specified period',
    example: 100,
    minimum: 0,
  })
  @IsNotEmpty()
  @IsInt()
  @Min(0)
  targetValue: number;
}
