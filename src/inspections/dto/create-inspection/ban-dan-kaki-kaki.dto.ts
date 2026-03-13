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

export class BanDanKakiKakiDto {
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) banDepan: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) velgDepan: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) discBrake: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) masterRem: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) tieRod: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) gardan: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) banBelakang: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) velgBelakang: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) brakePad: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) crossmember: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) knalpot: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) balljoint: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) karetBoot: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) upperLowerArm: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) shockBreaker: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) linkStabilizer: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) racksteer: number;

  @ApiProperty({ required: false })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(1000, { each: true })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => sanitizeStringArray(value))
  catatan?: string[];
}
