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

export class HasilInspeksiInteriorDto {
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) stir!: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) remTangan!: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) pedal!: number;
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  @Max(10)
  switchWiper!: number;
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  @Max(10)
  lampuHazard!: number;
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  @Max(10)
  switchLampu!: number;
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  @Max(10)
  panelDashboard!: number;
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  @Max(10)
  pembukaKapMesin!: number;
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  @Max(10)
  pembukaBagasi!: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) jokDepan!: number;
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  @Max(10)
  aromaInterior!: number;
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  @Max(10)
  handlePintu!: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) consoleBox!: number;
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  @Max(10)
  spionTengah!: number;
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  @Max(10)
  tuasPersneling!: number;
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  @Max(10)
  jokBelakang!: number;
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  @Max(10)
  panelIndikator!: number;
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  @Max(10)
  switchLampuInterior!: number;
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  @Max(10)
  karpetDasar!: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) klakson!: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) sunVisor!: number;
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  @Max(10)
  tuasTangkiBensin!: number;
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  @Max(10)
  sabukPengaman!: number;
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  @Max(10)
  trimInterior!: number;
  @ApiProperty() @IsNumber() @IsNotEmpty() @Min(0) @Max(10) plafon!: number;

  @ApiProperty({ required: false })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(1000, { each: true })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => sanitizeStringArray(value))
  catatan?: string[];
}
