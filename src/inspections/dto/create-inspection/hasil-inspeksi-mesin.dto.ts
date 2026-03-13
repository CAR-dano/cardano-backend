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

export class HasilInspeksiMesinDto {
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) getaranMesin!: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) suaraMesin!: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) transmisi!: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) pompaPowerSteering!: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) coverTimingChain!: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) oliPowerSteering!: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) accu!: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) kompressorAC!: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) fan!: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) selang!: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) karterOli!: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) oliRem!: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) kabel!: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) kondensor!: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) radiator!: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) cylinderHead!: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) oliMesin!: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) airRadiator!: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) coverKlep!: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) alternator!: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) waterPump!: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) belt!: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) oliTransmisi!: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) cylinderBlock!: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) bushingBesar!: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) bushingKecil!: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) tutupRadiator!: number;

  @ApiProperty({ required: false })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(1000, { each: true })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => sanitizeStringArray(value))
  catatan?: string[];
}
