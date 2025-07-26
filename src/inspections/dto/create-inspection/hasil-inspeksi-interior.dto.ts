import { ApiProperty } from '@nestjs/swagger';
import {
  IsNumber,
  IsString,
  IsNotEmpty,
  IsArray,
  IsOptional,
  MaxLength,
} from 'class-validator';

export class HasilInspeksiInteriorDto {
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  stir: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  remTangan: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  pedal: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  switchWiper: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  lampuHazard: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  switchLampu: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  panelDashboard: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  pembukaKapMesin: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  pembukaBagasi: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  jokDepan: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  aromaInterior: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  handlePintu: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  consoleBox: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  spionTengah: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  tuasPersneling: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  jokBelakang: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  panelIndikator: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  switchLampuInterior: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  karpetDasar: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  klakson: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  sunVisor: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  tuasTangkiBensin: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  sabukPengaman: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  trimInterior: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  plafon: number;

  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(1000, { each: true })
  @IsOptional()
  catatan: string[];
}
