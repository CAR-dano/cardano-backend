import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class BodyPaintThicknessSideDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  @Min(0, { message: 'frontFender must be a non-negative number' })
  @Max(2000, { message: 'frontFender exceeds maximum paint thickness (2000 µm)' })
  frontFender: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  @Min(0, { message: 'frontDoor must be a non-negative number' })
  @Max(2000, { message: 'frontDoor exceeds maximum paint thickness (2000 µm)' })
  frontDoor: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  @Min(0, { message: 'rearDoor must be a non-negative number' })
  @Max(2000, { message: 'rearDoor exceeds maximum paint thickness (2000 µm)' })
  rearDoor: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  @Min(0, { message: 'rearFender must be a non-negative number' })
  @Max(2000, { message: 'rearFender exceeds maximum paint thickness (2000 µm)' })
  rearFender: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  @Min(0, { message: 'sideSkirt must be a non-negative number' })
  @Max(2000, { message: 'sideSkirt exceeds maximum paint thickness (2000 µm)' })
  sideSkirt: number;
}
