import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsString, IsArray, IsOptional } from 'class-validator';

export class UpdateHasilInspeksiEksteriorDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  bumperDepan?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  kapMesin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  lampuUtama?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  panelAtap?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  grill?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  lampuFoglamp?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  kacaBening?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  wiperBelakang?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  bumperBelakang?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  lampuBelakang?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  trunklid?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  kacaDepan?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  fenderKanan?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  quarterPanelKanan?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  pintuBelakangKanan?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  spionKanan?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  lisplangKanan?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  sideSkirtKanan?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  daunWiper?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  pintuBelakang?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  fenderKiri?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  quarterPanelKiri?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  pintuDepan?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  kacaJendelaKanan?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  pintuBelakangKiri?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  spionKiri?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  pintuDepanKiri?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  kacaJendelaKiri?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  lisplangKiri?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  sideSkirtKiri?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  catatan?: string[];
}
