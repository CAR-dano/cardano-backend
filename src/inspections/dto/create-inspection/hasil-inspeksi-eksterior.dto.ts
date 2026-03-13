import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNumber,
  IsString,
  IsNotEmpty,
  IsArray,
  ArrayMaxSize,
  IsOptional,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { sanitizeStringArray } from '../../../common/sanitize.helper';

export class HasilInspeksiEksteriorDto {
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) bumperDepan: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) kapMesin: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) lampuUtama: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) panelAtap: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) grill: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) lampuFoglamp: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) kacaBening: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) wiperBelakang: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) bumperBelakang: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) lampuBelakang: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) trunklid: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) kacaDepan: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) fenderKanan: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) quarterPanelKanan: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) pintuBelakangKanan: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) spionKanan: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) lisplangKanan: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) sideSkirtKanan: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) daunWiper: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) pintuBelakang: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) fenderKiri: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) quarterPanelKiri: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) pintuDepan: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) kacaJendelaKanan: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) pintuBelakangKiri: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) spionKiri: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) pintuDepanKiri: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) kacaJendelaKiri: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) lisplangKiri: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) sideSkirtKiri: number;

  @ApiProperty({ required: false })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(1000, { each: true })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => sanitizeStringArray(value))
  catatan?: string[];
}
