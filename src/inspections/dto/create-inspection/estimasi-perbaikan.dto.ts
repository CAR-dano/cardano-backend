import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, MaxLength, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { sanitizeString } from '../../../common/sanitize.helper';

export class EstimasiPerbaikanDto {
  @ApiProperty()
  @Transform(({ value }: { value: unknown }) => sanitizeString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  namaPart: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  @Min(0, { message: 'harga must be a non-negative number' })
  harga: number;
}
