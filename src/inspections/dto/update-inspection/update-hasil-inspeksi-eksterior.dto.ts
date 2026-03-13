import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNumber, IsString, IsArray, ArrayMaxSize, IsOptional, MaxLength, Min, Max } from 'class-validator';
import { sanitizeStringArray } from '../../../common/sanitize.helper';

export class UpdateHasilInspeksiEksteriorDto {
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) bumperDepan?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) kapMesin?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) lampuUtama?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) panelAtap?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) grill?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) lampuFoglamp?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) kacaBening?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) wiperBelakang?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) bumperBelakang?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) lampuBelakang?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) trunklid?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) kacaDepan?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) fenderKanan?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) quarterPanelKanan?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) pintuBelakangKanan?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) spionKanan?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) lisplangKanan?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) sideSkirtKanan?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) daunWiper?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) pintuBelakang?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) fenderKiri?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) quarterPanelKiri?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) pintuDepan?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) kacaJendelaKanan?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) pintuBelakangKiri?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) spionKiri?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) pintuDepanKiri?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) kacaJendelaKiri?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) lisplangKiri?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10) sideSkirtKiri?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(1000, { each: true })
  @Transform(({ value }: { value: unknown }) => sanitizeStringArray(value))
  catatan?: string[];
}
