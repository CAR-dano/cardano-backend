import { ApiProperty } from '@nestjs/swagger';
import {
  IsNumber,
  IsString,
  IsNotEmpty,
  IsArray,
  IsOptional,
  MaxLength,
} from 'class-validator';

export class ToolsTestDto {
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  tebalCatBodyDepan: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  tebalCatBodyKiri: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  temperatureAC: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  tebalCatBodyKanan: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  tebalCatBodyBelakang: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  obdScanner: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  tebalCatBodyAtap: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  testAccu: number;

  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(1000, { each: true })
  @IsOptional()
  catatan: string[];
}
