import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNumber, IsString, IsArray, IsOptional, MaxLength, Min, Max } from 'class-validator';
import { sanitizeStringArray } from '../../../common/sanitize.helper';

export class UpdateToolsTestDto {
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) tebalCatBodyDepan?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) tebalCatBodyKiri?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) temperatureAC?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) tebalCatBodyKanan?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) tebalCatBodyBelakang?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) obdScanner?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) tebalCatBodyAtap?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) testAccu?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(1000, { each: true })
  @Transform(({ value }: { value: unknown }) => sanitizeStringArray(value))
  catatan?: string[];
}
