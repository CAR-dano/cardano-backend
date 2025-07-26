import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsString,
  IsArray,
  IsOptional,
  MaxLength,
} from 'class-validator';

export class UpdateTestDriveDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  bunyiGetaran?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  performaStir?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  perpindahanTransmisi?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  stirBalance?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  performaSuspensi?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  performaKopling?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  rpm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(1000, { each: true })
  catatan?: string[];
}
