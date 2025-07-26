import { ApiProperty } from '@nestjs/swagger';
import {
  IsNumber,
  IsString,
  IsNotEmpty,
  IsArray,
  IsOptional,
  MaxLength,
} from 'class-validator';

export class HasilInspeksiEksteriorDto {
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  bumperDepan: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  kapMesin: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  lampuUtama: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  panelAtap: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  grill: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  lampuFoglamp: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  kacaBening: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  wiperBelakang: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  bumperBelakang: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  lampuBelakang: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  trunklid: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  kacaDepan: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  fenderKanan: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  quarterPanelKanan: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  pintuBelakangKanan: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  spionKanan: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  lisplangKanan: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  sideSkirtKanan: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  daunWiper: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  pintuBelakang: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  fenderKiri: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  quarterPanelKiri: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  pintuDepan: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  kacaJendelaKanan: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  pintuBelakangKiri: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  spionKiri: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  pintuDepanKiri: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  kacaJendelaKiri: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  lisplangKiri: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  sideSkirtKiri: number;

  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(1000, { each: true })
  @IsOptional()
  catatan: string[];
}
