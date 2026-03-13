import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, MaxLength, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { sanitizeString } from '../../../common/sanitize.helper';

export class UpdateEstimasiPerbaikanDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => sanitizeString(value))
  @IsString()
  @MaxLength(255)
  namaPart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'harga must be a non-negative number' })
  harga?: number;
}
