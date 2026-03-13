import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class BodyPaintThicknessRearDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  @Min(0, { message: 'trunk must be a non-negative number' })
  @Max(2000, { message: 'trunk exceeds maximum paint thickness (2000 µm)' })
  trunk: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  @Min(0, { message: 'bumper must be a non-negative number' })
  @Max(2000, { message: 'bumper exceeds maximum paint thickness (2000 µm)' })
  bumper: number;
}
