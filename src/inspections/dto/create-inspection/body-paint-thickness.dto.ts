import { ApiProperty } from '@nestjs/swagger';
import { ValidateNested, IsNotEmpty, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { BodyPaintThicknessSideDto } from './body-paint-thickness-side.dto';
import { BodyPaintThicknessRearDto } from './body-paint-thickness-rear.dto';

export class BodyPaintThicknessDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  front: number;

  @ApiProperty()
  @ValidateNested()
  @Type(() => BodyPaintThicknessRearDto)
  @IsNotEmpty()
  rear: BodyPaintThicknessRearDto;

  @ApiProperty()
  @ValidateNested()
  @Type(() => BodyPaintThicknessSideDto)
  @IsNotEmpty()
  right: BodyPaintThicknessSideDto;

  @ApiProperty()
  @ValidateNested()
  @Type(() => BodyPaintThicknessSideDto)
  @IsNotEmpty()
  left: BodyPaintThicknessSideDto;
}
