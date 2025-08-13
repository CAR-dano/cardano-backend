import { ApiProperty } from '@nestjs/swagger';
import {
  IsNumber,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  MaxLength,
} from 'class-validator';

export class FiturDto {
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  airbag: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  sistemAudio: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  powerWindow: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  sistemAC: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  interior1?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  interior2?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  interior3?: number;

  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(1000, { each: true })
  @IsOptional()
  catatan: string[];

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  remAbs: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  centralLock: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  electricMirror: number;
}
