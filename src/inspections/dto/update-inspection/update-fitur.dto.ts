import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsString, IsArray, IsOptional } from 'class-validator';

export class UpdateFiturDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  airbag?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  sistemAudio?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  powerWindow?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  sistemAC?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  interior1?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  interior2?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  interior3?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  catatan?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  remAbs?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  centralLock?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  electricMirror?: number;
}
