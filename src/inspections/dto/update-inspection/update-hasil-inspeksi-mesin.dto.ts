import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNumber, IsString, IsArray, ArrayMaxSize, IsOptional, MaxLength, Min, Max } from 'class-validator';
import { sanitizeStringArray } from '../../../common/sanitize.helper';

export class UpdateHasilInspeksiMesinDto {
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) getaranMesin?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) suaraMesin?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) transmisi?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) pompaPowerSteering?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) coverTimingChain?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) oliPowerSteering?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) accu?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) kompressorAC?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) fan?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) selang?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) karterOli?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) oliRem?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) kabel?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) kondensor?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) radiator?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) cylinderHead?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) oliMesin?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) airRadiator?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) coverKlep?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) alternator?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) waterPump?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) belt?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) oliTransmisi?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) cylinderBlock?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) bushingBesar?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) bushingKecil?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) tutupRadiator?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(1000, { each: true })
  @Transform(({ value }: { value: unknown }) => sanitizeStringArray(value))
  catatan?: string[];
}
