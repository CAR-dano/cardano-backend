import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsDate,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { sanitizeString } from '../../../common/sanitize.helper';

export class VehicleDataDto {
  @ApiProperty()
  @Transform(({ value }: { value: unknown }) => sanitizeString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  merekKendaraan!: string;

  @ApiProperty()
  @Transform(({ value }: { value: unknown }) => sanitizeString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  tipeKendaraan!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  @Min(1900, { message: 'tahun must be 1900 or later' })
  @Max(new Date().getFullYear() + 1, {
    message: 'tahun cannot be in the future',
  })
  tahun!: number;

  @ApiProperty()
  @Transform(({ value }: { value: unknown }) => sanitizeString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  transmisi!: string;

  @ApiProperty()
  @Transform(({ value }: { value: unknown }) => sanitizeString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  warnaKendaraan!: string;

  @ApiProperty()
  @Transform(({ value }: { value: unknown }) => sanitizeString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  odometer!: string;

  @ApiProperty()
  @Transform(({ value }: { value: unknown }) => sanitizeString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  kepemilikan!: string;

  @ApiProperty()
  @Transform(({ value }: { value: unknown }) => sanitizeString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  platNomor!: string;

  @ApiProperty()
  @Type(() => Date)
  @IsDate()
  @IsNotEmpty()
  pajak1Tahun!: Date;

  @ApiProperty()
  @Type(() => Date)
  @IsDate()
  @IsNotEmpty()
  pajak5Tahun!: Date;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  @Min(0, { message: 'biayaPajak must be a non-negative number' })
  biayaPajak!: number;
}
