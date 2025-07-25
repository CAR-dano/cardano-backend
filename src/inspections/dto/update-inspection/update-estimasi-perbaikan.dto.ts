import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateEstimasiPerbaikanDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  namaPart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  harga?: number;
}
