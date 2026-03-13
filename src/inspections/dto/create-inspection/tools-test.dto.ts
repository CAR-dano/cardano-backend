import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNumber,
  IsString,
  IsNotEmpty,
  IsArray,
  ArrayMaxSize,
  IsOptional,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { sanitizeStringArray } from '../../../common/sanitize.helper';

export class ToolsTestDto {
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) tebalCatBodyDepan!: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) tebalCatBodyKiri!: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) temperatureAC!: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) tebalCatBodyKanan!: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) tebalCatBodyBelakang!: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) obdScanner!: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) tebalCatBodyAtap!: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) testAccu!: number;

  @ApiProperty({ required: false })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(1000, { each: true })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => sanitizeStringArray(value))
  catatan?: string[];
}
