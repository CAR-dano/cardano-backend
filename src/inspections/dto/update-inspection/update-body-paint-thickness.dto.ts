import { ApiPropertyOptional } from '@nestjs/swagger';
import { ValidateNested, IsOptional, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { UpdateBodyPaintThicknessSideDto } from './update-body-paint-thickness-side.dto';
import { UpdateBodyPaintThicknessRearDto } from './update-body-paint-thickness-rear.dto';

export class UpdateBodyPaintThicknessDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
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
