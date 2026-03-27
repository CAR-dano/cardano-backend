import { ApiProperty } from '@nestjs/swagger';
import {
  ValidateNested,
  IsNotEmpty,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BodyPaintThicknessSideDto } from './body-paint-thickness-side.dto';
import { BodyPaintThicknessRearDto } from './body-paint-thickness-rear.dto';

export class BodyPaintThicknessDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  @Min(0, { message: 'front must be a non-negative number' })
  @Max(2000, { message: 'front exceeds maximum paint thickness (2000 µm)' })
  front!: number;

  @ApiProperty()
  @ValidateNested()
  @Type(() => BodyPaintThicknessRearDto)
  @IsNotEmpty()
  rear!: BodyPaintThicknessRearDto;

  @ApiProperty()
  @ValidateNested()
  @Type(() => BodyPaintThicknessSideDto)
  @IsNotEmpty()
  right!: BodyPaintThicknessSideDto;

  @ApiProperty()
  @ValidateNested()
  @Type(() => BodyPaintThicknessSideDto)
  @IsNotEmpty()
  left!: BodyPaintThicknessSideDto;
}
