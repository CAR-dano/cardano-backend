import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsString,
  IsArray,
  IsOptional,
  MaxLength,
} from 'class-validator';

export class UpdateToolsTestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  tebalCatBodyDepan?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  tebalCatBodyKiri?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  temperatureAC?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  tebalCatBodyKanan?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  tebalCatBodyBelakang?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  obdScanner?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  tebalCatBodyAtap?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  testAccu?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(1000, { each: true })
  catatan?: string[];
}
