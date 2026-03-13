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

export class TestDriveDto {
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) bunyiGetaran!: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) performaStir!: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) perpindahanTransmisi!: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) stirBalance!: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) performaSuspensi!: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) performaKopling!: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) rpm!: number;

  @ApiProperty({ required: false })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(1000, { each: true })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => sanitizeStringArray(value))
  catatan?: string[];
}
