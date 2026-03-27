import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ValidateNested,
  IsOptional,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UpdateBodyPaintThicknessSideDto } from './update-body-paint-thickness-side.dto';
import { UpdateBodyPaintThicknessRearDto } from './update-body-paint-thickness-rear.dto';

export class UpdateBodyPaintThicknessDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'front must be a non-negative number' })
  @Max(2000, { message: 'front exceeds maximum paint thickness (2000 µm)' })
  front?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateBodyPaintThicknessRearDto)
  rear?: UpdateBodyPaintThicknessRearDto;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateBodyPaintThicknessSideDto)
  right?: UpdateBodyPaintThicknessSideDto;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateBodyPaintThicknessSideDto)
  left?: UpdateBodyPaintThicknessSideDto;
}
