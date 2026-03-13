import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateBodyPaintThicknessRearDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'trunk must be a non-negative number' })
  @Max(2000, { message: 'trunk exceeds maximum paint thickness (2000 µm)' })
  trunk?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'bumper must be a non-negative number' })
  @Max(2000, { message: 'bumper exceeds maximum paint thickness (2000 µm)' })
  bumper?: number;
}
