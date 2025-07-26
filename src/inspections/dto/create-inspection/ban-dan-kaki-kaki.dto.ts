import { ApiProperty } from '@nestjs/swagger';
import {
  IsNumber,
  IsString,
  IsNotEmpty,
  IsArray,
  IsOptional,
  MaxLength,
} from 'class-validator';

export class BanDanKakiKakiDto {
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  banDepan: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  velgDepan: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  discBrake: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  masterRem: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  tieRod: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  gardan: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  banBelakang: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  velgBelakang: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  brakePad: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  crossmember: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  knalpot: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  balljoint: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  karetBoot: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  upperLowerArm: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  shockBreaker: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  linkStabilizer: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  racksteer: number;

  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(1000, { each: true })
  @IsOptional()
  catatan: string[];
}
