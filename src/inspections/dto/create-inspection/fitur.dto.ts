import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNumber,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ArrayMaxSize,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { sanitizeStringArray } from '../../../common/sanitize.helper';

export class FiturDto {
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) airbag!: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) sistemAudio!: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) powerWindow!: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) sistemAC!: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) remAbs!: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) centralLock!: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) electricMirror!: number;

  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0) @Max(10) interior1?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0) @Max(10) interior2?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0) @Max(10) interior3?: number;

  @ApiProperty({ required: false })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(1000, { each: true })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => sanitizeStringArray(value))
  catatan?: string[];
}
