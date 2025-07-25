import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsDate, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateVehicleDataDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  merekKendaraan?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tipeKendaraan?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  tahun?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  transmisi?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  warnaKendaraan?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  odometer?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  kepemilikan?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  platNomor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  pajak1Tahun?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  pajak5Tahun?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  biayaPajak?: number;
}
