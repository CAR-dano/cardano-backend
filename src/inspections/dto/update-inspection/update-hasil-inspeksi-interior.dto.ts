import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsString, IsArray, IsOptional } from 'class-validator';

export class UpdateHasilInspeksiInteriorDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  stir?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  remTangan?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  pedal?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  switchWiper?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  lampuHazard?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  switchLampu?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  panelDashboard?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  pembukaKapMesin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  pembukaBagasi?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  jokDepan?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  aromaInterior?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  handlePintu?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  consoleBox?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  spionTengah?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  tuasPersneling?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  jokBelakang?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  panelIndikator?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  switchLampuInterior?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  karpetDasar?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  klakson?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  sunVisor?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  tuasTangkiBensin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  sabukPengaman?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  trimInterior?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  plafon?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  catatan?: string[];
}
